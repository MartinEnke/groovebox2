// src/engine/useAudioEngine.js
import { useEffect, useMemo, useRef } from "react";
import { INSTRUMENTS } from "../constants/instruments";
import { PPQ } from "../constants/sequencer";
import { dbToGain } from "../utils/misc";
import { fetchAndDecode, createClickBuffer, makeImpulseResponse } from "../utils/audio";

/**
 * Encapsulates the entire WebAudio graph:
 * - Master & sum bus (analyser, comp, limiter, makeup)
 * - Per-instrument post (mute/vol), mix, duck chain
 * - Global FX buses (delay x3, reverb x3) + per-instrument sends
 * - Pack buffer cache + sample playback + choke
 * - Metronome clicks
 */
export function useAudioEngine() {
  // Core
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);

  const pitchMapRef = useRef(Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]))); // semitones

  const sumHpRef = useRef(null); // high-pass (low-cut)
  const sumLpRef = useRef(null); // low-pass (high-cut)

  // Sum bus
  const sumInRef = useRef(null);
  const analyserRef = useRef(null);
  const compRef = useRef(null);
  const limiterRef = useRef(null);
  const makeupRef = useRef(null);

  // Per-instrument nodes/maps
  const postMuteGainsRef = useRef(new Map());  // instId -> GainNode (post/vol/mute)
  const mixGainsRef = useRef(new Map());       // instId -> GainNode (sum of voices)
  const duckGainsRef = useRef(new Map());      // targetId -> Map<triggerId, GainNode>
  const activeVoicesRef = useRef(new Map());   // instId -> Set<{src, gain}>

  // FX buses
  const delayBusesRef = useRef({ N16: null, N8: null, N3_4: null });
  const delaySendGainsRef = useRef(new Map()); // instId -> {N16,N8,N3_4}
  const reverbConvRef = useRef({ S: null, M: null, L: null });
  const reverbWetGainRef = useRef({ S: null, M: null, L: null });
  const reverbSendGainsRef = useRef(new Map()); // instId -> {S,M,L}

  // Per-instrument saturation insert (waveshaper)
const satNodesRef = useRef(new Map()); // instId -> { dry, pre, shaper, post, sum }
const satModeRef  = useRef(Object.fromEntries(INSTRUMENTS.map(i => [i.id, "tape"])));
const satWetRef   = useRef(Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0])));

// build a shaping curve (different flavors)
function makeSatCurve(k = 0, mode = "tape", blend = 1) {
    const n = 2048; // enough resolution, cheap to recompute
    const curve = new Float32Array(n);
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1; // -1..+1
      let y;
      if (k <= 0.0001) { y = x; }
      else {
        switch (mode) {
          case "hard": // arctan-ish
            y = Math.atan(k * x) * (2 / Math.PI);
            break;
          case "warm": // soft clip
            y = ((1 + k) * x) / (1 + k * Math.abs(x));
            break;
          case "tape": // subtle: blend linear with soft tanh
          default: {
            const nonlin = Math.tanh(k * x) / Math.tanh(k);
            const b = Math.max(0, Math.min(1, blend));     // 0..1
            y = (1 - b) * x + b * nonlin;                  // mostly linear
          break;
          }
        }
      }
      curve[i] = clamp(y);
    }
    return curve;
  }


  // Local remember modes so setWet can work without UI passing mode each time
  const delayModeRef = useRef(Object.fromEntries(INSTRUMENTS.map(i => [i.id, "N8"])));
  const reverbModeRef = useRef(Object.fromEntries(INSTRUMENTS.map(i => [i.id, "M"])));

  // Packs / buffers
  const selectedPackRef = useRef(null);
  const bufferCacheRef = useRef(new Map()); // packId -> Map(instId -> AudioBuffer)

  // Metronome click buffers
  const metClickRef = useRef({ hi: null, lo: null });

  // ---------- init / teardown ----------
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    // Master & sum
    const master = ctx.createGain(); master.gain.value = 0.9; masterGainRef.current = master;

    const sumIn = ctx.createGain(); sumIn.gain.value = 1.0; sumInRef.current = sumIn;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyserRef.current = analyser;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.25; comp.knee.value = 3;
    compRef.current = comp;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.0; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
    limiterRef.current = limiter;

    const makeup = ctx.createGain(); makeup.gain.value = dbToGain(0); makeupRef.current = makeup;

    // wire: master -> sumIn -> analyser -> HP -> LP -> comp -> limiter -> makeup -> destination
    master.connect(sumIn);
    sumIn.connect(analyser);
    // Sum-bus filters (default bypass = 'allpass')
    const hp = ctx.createBiquadFilter();
    hp.type = "allpass";      // toggled to 'highpass' when enabled
    hp.frequency.value = 230; // default freq
    hp.Q.value = 1.0;         // "medium" Q
    sumHpRef.current = hp;

    const lp = ctx.createBiquadFilter();
    lp.type = "allpass";      // toggled to 'lowpass' when enabled
    lp.frequency.value = 3000;
    lp.Q.value = 1.0;
    sumLpRef.current = lp;

    analyser.connect(hp);
    hp.connect(lp);
    lp.connect(comp);
    comp.connect(limiter);
    limiter.connect(makeup);
    makeup.connect(ctx.destination);

    // Per-instrument post, mix, duck chain, FX sends
    INSTRUMENTS.forEach(inst => {
      // post (mute/vol)
      const post = ctx.createGain(); post.gain.value = dbToGain(0);
      post.connect(master);
      postMuteGainsRef.current.set(inst.id, post);

      // mix of voices
      const mix = ctx.createGain(); mix.gain.value = 1.0;
      mixGainsRef.current.set(inst.id, mix);

      // ---- Saturation insert: mix -> [dry + (pre->shaper->post)] -> sum ----
      const dry = ctx.createGain();  dry.gain.value  = 1.0; // 1 - wet
      const pre = ctx.createGain();  pre.gain.value  = 1.0; // input drive (we’ll keep 1.0; curve handles “drive”)
      const shp = ctx.createWaveShaper();
      shp.curve = makeSatCurve(0.8, "tape", 0.2); // mild
      shp.oversample = "4x";
      const wet = ctx.createGain();  wet.gain.value  = 0.0; // wet = 0..1
      const sum = ctx.createGain();  sum.gain.value  = 1.0; // sums dry+wet and feeds duck chain

      mix.connect(dry); dry.connect(sum);
      mix.connect(pre); pre.connect(shp); shp.connect(wet); wet.connect(sum);
      satNodesRef.current.set(inst.id, { dry, pre, shaper: shp, post: wet, sum });

      // duck chain: one gain per possible trigger, in series: mix -> ... -> post
      const gMap = new Map();
      let last = sum; // <--- start AFTER saturation insert
      INSTRUMENTS.forEach(trig => {
        const dg = ctx.createGain(); dg.gain.value = 1.0;
        last.connect(dg); last = dg; gMap.set(trig.id, dg);
      });
      last.connect(post);
      duckGainsRef.current.set(inst.id, gMap);
    });

    // Delay buses
    const mkDelayBus = () => {
      const inGain = ctx.createGain();
      const node = ctx.createDelay(2.0);
      const fb = ctx.createGain(); fb.gain.value = 0.35;
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 5000;
      const wet = ctx.createGain(); wet.gain.value = 1.0;

      inGain.connect(node); node.connect(filt); filt.connect(wet); wet.connect(master);
      node.connect(fb); fb.connect(node);

      return { in: inGain, node, fb, filt, wet };
    };
    delayBusesRef.current = { N16: mkDelayBus(), N8: mkDelayBus(), N3_4: mkDelayBus() };

    // Reverb buses
    const convS = ctx.createConvolver(), convM = ctx.createConvolver(), convL = ctx.createConvolver();
    const wetS = ctx.createGain(), wetM = ctx.createGain(), wetL = ctx.createGain();
    wetS.gain.value = wetM.gain.value = wetL.gain.value = 1.0;
    convS.connect(wetS); wetS.connect(master);
    convM.connect(wetM); wetM.connect(master);
    convL.connect(wetL); wetL.connect(master);
    reverbConvRef.current = { S: convS, M: convM, L: convL };
    reverbWetGainRef.current = { S: wetS, M: wetM, L: wetL };

    // Per-instrument sends (post -> delay/reverb ins)
    INSTRUMENTS.forEach(inst => {
      const post = postMuteGainsRef.current.get(inst.id);

      const sN16 = ctx.createGain(), sN8 = ctx.createGain(), sN3_4 = ctx.createGain();
      sN16.gain.value = 0; sN8.gain.value = 0; sN3_4.gain.value = 0;
      post.connect(sN16); sN16.connect(delayBusesRef.current.N16.in);
      post.connect(sN8);  sN8.connect(delayBusesRef.current.N8.in);
      post.connect(sN3_4); sN3_4.connect(delayBusesRef.current.N3_4.in);
      delaySendGainsRef.current.set(inst.id, { N16: sN16, N8: sN8, N3_4: sN3_4 });

      const rS = ctx.createGain(), rM = ctx.createGain(), rL = ctx.createGain();
      rS.gain.value = 0; rM.gain.value = 0; rL.gain.value = 0;
      post.connect(rS); rS.connect(convS);
      post.connect(rM); rM.connect(convM);
      post.connect(rL); rL.connect(convL);
      reverbSendGainsRef.current.set(inst.id, { S: rS, M: rM, L: rL });
    });

    // Metronome clicks
    metClickRef.current.hi = createClickBuffer(ctx, 2000, 0.002);
    metClickRef.current.lo = createClickBuffer(ctx, 1200, 0.002);

    // iOS unlock
    const resume = () => ctx.resume();
    window.addEventListener("pointerdown", resume, { once: true });

    return () => {
      try { window.removeEventListener("pointerdown", resume); } catch {}
      try { ctx.close(); } catch {}
    };
  }, []);

  // ---------- helpers ----------
  function updateTempo(bpm) {
    const ctx = ctxRef.current; if (!ctx) return;
    const spb = 60 / bpm;
    const buses = delayBusesRef.current;
    if (buses?.N16?.node) {
      const now = ctx.currentTime;
      buses.N16.node.delayTime.cancelScheduledValues(now);
      buses.N8.node.delayTime.cancelScheduledValues(now);
      buses.N3_4.node.delayTime.cancelScheduledValues(now);
      buses.N16.node.delayTime.linearRampToValueAtTime(spb / 4, now + 0.01);
      buses.N8.node.delayTime.linearRampToValueAtTime(spb / 2, now + 0.01);
      buses.N3_4.node.delayTime.linearRampToValueAtTime((3 * spb) / 4, now + 0.01);
    }

    // Rebuild IRs: S=4 steps, M=8, L=16 relative to PPQ=4
    const convs = reverbConvRef.current;
    if (convs?.S && convs?.M && convs?.L) {
      const secondsPerStep = (60 / bpm) / PPQ;
      const durS = Math.max(0.2, 4 * secondsPerStep);
      const durM = Math.max(0.2, 8 * secondsPerStep);
      const durL = Math.max(0.2, 16 * secondsPerStep);
      const ctx2 = ctxRef.current;
      convs.S.buffer = makeImpulseResponse(ctx2, durS, 1.8);
      convs.M.buffer = makeImpulseResponse(ctx2, durM, 2.2);
      convs.L.buffer = makeImpulseResponse(ctx2, durL, 2.8);
    }
  }

  function setSumComp(p) {
    const n = compRef.current; if (!n) return;
    n.threshold.value = p.threshold;
    n.ratio.value = p.ratio;
    n.attack.value = p.attack;
    n.release.value = p.release;
    n.knee.value = p.knee;
  }

  function setLimiterOn(on) {
    const comp = compRef.current, limiter = limiterRef.current, makeup = makeupRef.current;
    if (!comp || !limiter || !makeup) return;
    try { comp.disconnect(); } catch {}
    try { limiter.disconnect(); } catch {}
    if (on) { comp.connect(limiter); limiter.connect(makeup); }
    else { comp.connect(makeup); }
  }

  function setSumGainDb(db) {
    const n = makeupRef.current; if (n) n.gain.value = dbToGain(db);
  }

  function setDelayWet(instId, pct, mode /* optional */) {
    if (mode) delayModeRef.current[instId] = mode;
    const sends = delaySendGainsRef.current.get(instId); if (!sends) return;
    const m = mode || delayModeRef.current[instId] || "N8";
    const v = (pct ?? 0) / 100;
    sends.N16.gain.value = m === "N16" ? v : 0;
    sends.N8.gain.value  = m === "N8"  ? v : 0;
    sends.N3_4.gain.value= m === "N3_4"? v : 0;
  }
  function setDelayMode(instId, mode) {
    delayModeRef.current[instId] = mode;
    // re-apply using last wet value by reading current gains sum
    const sends = delaySendGainsRef.current.get(instId); if (!sends) return;
    const currentWet = Math.max(sends.N16.gain.value, sends.N8.gain.value, sends.N3_4.gain.value) * 100;
    setDelayWet(instId, currentWet, mode);
  }

  function setReverbWet(instId, pct, mode /* optional */) {
    if (mode) reverbModeRef.current[instId] = mode;
    const sends = reverbSendGainsRef.current.get(instId); if (!sends) return;
    const m = mode || reverbModeRef.current[instId] || "M";
    const v = (pct ?? 0) / 100;
    sends.S.gain.value = m === "S" ? v : 0;
    sends.M.gain.value = m === "M" ? v : 0;
    sends.L.gain.value = m === "L" ? v : 0;
  }
  function setReverbMode(instId, mode) {
    reverbModeRef.current[instId] = mode;
    const sends = reverbSendGainsRef.current.get(instId); if (!sends) return;
    const currentWet = Math.max(sends.S.gain.value, sends.M.gain.value, sends.L.gain.value) * 100;
    setReverbWet(instId, currentWet, mode);
  }

  function setSaturationWet(instId, pct, mode /* optional */) {
    if (mode) satModeRef.current[instId] = mode;
    if (pct == null) pct = satWetRef.current[instId] ?? 0;
    satWetRef.current[instId] = pct;
  
    const nodes = satNodesRef.current.get(instId); if (!nodes) return;
    const wet = Math.max(0, Math.min(1, pct / 100));

   // Mix: slider is still the wet mix
   nodes.dry.gain.value = 1 - wet;
   nodes.post.gain.value = wet;
 
   // Drive mapping per mode
   const m = satModeRef.current[instId];
   let k, blend;
   if (m === "tape") {
     // Very gentle: k in ~[0.7..2.0], blend in ~[0.15..0.6], sublinear vs slider
     const t = wet * wet;                 // ease-in (sublinear)
     k = 0.7 + 1.3 * t;                   // 0.7 → 2.0
     blend = 0.15 + 0.45 * t;             // 0.15 → 0.60
     nodes.shaper.curve = makeSatCurve(k, "tape", blend);
   } else if (m === "warm") {
     k = 1 + 3.0 * wet;                   // 1..4
     nodes.shaper.curve = makeSatCurve(k, "warm");
   } else { // "hard"
     k = 3 + 12 * wet;                    // 3..15
     nodes.shaper.curve = makeSatCurve(k, "hard");
   }
  }
  
  function setSaturationMode(instId, mode) {
    satModeRef.current[instId] = mode;
    // reapply current wet to refresh curve with the new mode
    setSaturationWet(instId, satWetRef.current[instId] ?? 0, mode);
  }

  
  

  function updateInstrumentGain(instId, db, muted) {
    const post = postMuteGainsRef.current.get(instId); if (!post) return;
    post.gain.value = muted ? 0 : dbToGain(db ?? 0);
  }

  async function selectPack(packId, samplePacks) {
    const ctx = ctxRef.current; if (!ctx) return;
    selectedPackRef.current = packId;
    let packMap = bufferCacheRef.current.get(packId);
    if (!packMap) {
      packMap = new Map();
      bufferCacheRef.current.set(packId, packMap);
      // decode all known files for instruments present
      await Promise.all(INSTRUMENTS.map(async (inst) => {
        const url = samplePacks?.[packId]?.files?.[inst.id];
        if (!url) return;
        const buf = await fetchAndDecode(ctx, url).catch(() => null);
        if (buf) packMap.set(inst.id, buf);
      }));
    }
    return true;
  }

  function getBuffer(instId) {
    const packId = selectedPackRef.current;
    return bufferCacheRef.current.get(packId)?.get(instId) ?? null;
  }

  function playSample(instId, velocity = 1.0, when = 0) {
    const ctx = ctxRef.current; if (!ctx) return;
    const buf = getBuffer(instId); if (!buf) return;
    const mix = mixGainsRef.current.get(instId); if (!mix) return;
  
    const src = ctx.createBufferSource();
    src.buffer = buf;
  
    const semi = pitchMapRef.current[instId] || 0;
    src.playbackRate.value = Math.pow(2, semi / 12);
  
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, velocity));
  
    src.connect(g).connect(mix);
    src.start(when > 0 ? when : 0);
  
    if (!activeVoicesRef.current.has(instId)) activeVoicesRef.current.set(instId, new Set());
    const voice = { src, gain: g };
    activeVoicesRef.current.get(instId).add(voice);
    src.onended = () => {
      const set = activeVoicesRef.current.get(instId);
      if (set) set.delete(voice);
    };
  }
  function setInstrumentPitch(instId, semitones) {
    const s = Math.max(-12, Math.min(12, Math.round(semitones)));
    pitchMapRef.current[instId] = s;
  }

  function choke(instId, when = 0) {
    const ctx = ctxRef.current; if (!ctx) return;
    const set = activeVoicesRef.current.get(instId); if (!set || set.size === 0) return;
    const t = Math.max(when, ctx.currentTime);
    const RELEASE = 0.02;
    set.forEach(({ src, gain }) => {
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + RELEASE);
        src.stop(t + RELEASE + 0.005);
      } catch {}
    });
  }

  function duckFromTrigger(triggerId, when, matrix, amtDb, atkMs, relMs) {
    INSTRUMENTS.forEach(target => {
      if (!matrix?.[target.id]?.[triggerId]) return;
      const dg = duckGainsRef.current.get(target.id)?.get(triggerId);
      if (!dg) return;
      const g = dg.gain;
      const dip = Math.max(0.0001, dbToGain(-((amtDb?.[target.id] ?? 6))));
      const atk = Math.max(0.001, (atkMs?.[target.id] ?? 12) / 1000);
      const rel = Math.max(0.001, (relMs?.[target.id] ?? 180) / 1000);
      const t0 = when;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(1.0, t0);
      g.exponentialRampToValueAtTime(dip, t0 + atk);
      g.exponentialRampToValueAtTime(1.0, t0 + atk + rel);
    });
  }

  function click(which /* 'hi'|'lo' */, when, gain = 0.15) {
    const buf = which === "hi" ? metClickRef.current.hi : metClickRef.current.lo;
    if (!buf) return;
    const ctx = ctxRef.current;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(masterGainRef.current);
    src.start(when > 0 ? when : 0);
  }


  function setSumFilters({ lowCutOn, highCutOn, lowCutHz = 230, highCutHz = 3000, Q = 1.0 } = {}) {
    const hp = sumHpRef.current;
    const lp = sumLpRef.current;
    if (hp) {
      hp.type = lowCutOn ? "highpass" : "allpass";
      hp.frequency.value = lowCutHz;
      hp.Q.value = Q;
    }
    if (lp) {
      lp.type = highCutOn ? "lowpass" : "allpass";
      lp.frequency.value = highCutHz;
      lp.Q.value = Q;
    }
  }
  function setSumLowCut(on, hz = 230, q = 1.0) {
    setSumFilters({ lowCutOn: on, highCutOn: sumLpRef.current?.type === "lowpass", lowCutHz: hz, highCutHz: sumLpRef.current?.frequency?.value ?? 3000, Q: q });
  }
  function setSumHighCut(on, hz = 3000, q = 1.0) {
    setSumFilters({ lowCutOn: sumHpRef.current?.type === "highpass", highCutOn: on, lowCutHz: sumHpRef.current?.frequency?.value ?? 230, highCutHz: hz, Q: q });
  }

  
  const api = useMemo(() => ({
    getCtx: () => ctxRef.current,
    getAnalyser: () => analyserRef.current,

    // packs
    selectPack,
    getBuffer,

    // tempo & sum bus
    updateTempo,
    setSumComp,
    setLimiterOn,
    setSumGainDb,
    setSumFilters,
    setSumLowCut,
    setSumHighCut,

    // fx per instrument
    setDelayWet,
    setDelayMode,
    setReverbWet,
    setReverbMode,
    setSaturationWet,
    setSaturationMode,

    // instrument gain/mute
    updateInstrumentGain,
    setInstrumentPitch,

    // playback
    playSample,
    choke,
    duckFromTrigger,
    click,
  }), []);

  return api;
}

export default useAudioEngine;