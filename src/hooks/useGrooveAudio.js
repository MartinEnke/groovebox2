import { useEffect, useMemo, useRef, useState } from "react";
import { INSTRUMENTS } from "../constants/instruments";
import { PPQ } from "../constants/sequencer";
import { dbToGain, fetchAndDecode, createClickBuffer, makeImpulseResponse } from "../utils/audio";

/**
 * WebAudio engine: graph + packs + FX + metering + helpers.
 *
 * @param {object} params
 * @param {number}  params.bpm
 * @param {object}  params.instGainsDb  // { instId: dB }
 * @param {object}  params.mutes        // { instId: bool }
 * @param {string}  params.selectedPack
 * @param {function(instId, packId): string|null} params.getPackUrl
 * @param {object}  params.sumComp      // { threshold, ratio, attack, release, knee }
 * @param {boolean} params.limiterOn
 * @param {number}  params.sumGainDb
 * @param {object}  params.instDelayWet // { instId: 0..100 }
 * @param {object}  params.instDelayMode // { instId: 'N16'|'N8'|'N3_4' }
 * @param {object}  params.instReverbWet // { instId: 0..100 }
 * @param {object}  params.instRevMode   // { instId: 'S'|'M'|'L' }
 */
export function useGrooveAudio({
  bpm,
  instGainsDb,
  mutes,
  selectedPack,
  getPackUrl,
  sumComp,
  limiterOn,
  sumGainDb,
  instDelayWet,
  instDelayMode,
  instReverbWet,
  instRevMode,
}) {
  // Core graph
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);

  // Per-instrument nodes
  const muteGainsRef = useRef(new Map()); // instId -> post (mute+vol) gain
  const mixGainsRef = useRef(new Map());  // instId -> sum of voices
  const duckGainsRef = useRef(new Map()); // targetId -> Map<triggerId, GainNode> (series chain)

  // FX buses and per-instrument sends
  const delayBusesRef = useRef({ N16: null, N8: null, N3_4: null });
  const delaySendGainsRef = useRef(new Map()); // instId -> { N16, N8, N3_4 }
  const reverbConvRef = useRef({ S: null, M: null, L: null });
  const reverbWetGainRef = useRef({ S: null, M: null, L: null });
  const reverbSendGainsRef = useRef(new Map()); // instId -> { S, M, L }

  // Buffers
  const buffersRef = useRef(new Map()); // current pack: instId -> AudioBuffer
  const bufferCacheRef = useRef(new Map()); // packId -> Map(instId -> AudioBuffer)
  const selectedPackRef = useRef(selectedPack);

  // Metronome clicks
  const metClickRef = useRef({ hi: null, lo: null });

  // Metering + sum bus
  const sumNodesRef = useRef({ in: null, analyser: null, comp: null, limiter: null, makeup: null });
  const [sumMeterDb, setSumMeterDb] = useState(-Infinity);

  // Voice tracking (for chokes)
  const activeVoicesRef = useRef(new Map()); // instId -> Set({src,gain})

  useEffect(() => {
    selectedPackRef.current = selectedPack;
  }, [selectedPack]);

  // ===== init graph =====
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    // Master pre-sum
    const master = ctx.createGain();
    master.gain.value = 0.9;
    masterGainRef.current = master;

    // Sum bus: master -> in -> analyser -> comp -> limiter? -> makeup -> dest
    const sumIn = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.knee.value = 3;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const makeup = ctx.createGain();
    makeup.gain.value = dbToGain(0);

    master.connect(sumIn);
    sumIn.connect(analyser);
    analyser.connect(comp);
    comp.connect(limiter);
    limiter.connect(makeup);
    makeup.connect(ctx.destination);

    sumNodesRef.current = { in: sumIn, analyser, comp, limiter, makeup };

    // Per-instrument post nodes (mute+vol)
    INSTRUMENTS.forEach((inst) => {
      const g = ctx.createGain();
      g.gain.value = mutes?.[inst.id] ? 0 : dbToGain(instGainsDb?.[inst.id] ?? 0);
      g.connect(master);
      muteGainsRef.current.set(inst.id, g);
    });

    // Delay buses (three)
    const mkDelayBus = () => {
      const inGain = ctx.createGain();
      inGain.gain.value = 1.0;
      const node = ctx.createDelay(2.0);
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 5000;
      const wet = ctx.createGain();
      wet.gain.value = 1.0;

      inGain.connect(node);
      node.connect(filt);
      filt.connect(wet);
      wet.connect(master);
      node.connect(fb);
      fb.connect(node);

      return { in: inGain, node, fb, filt, wet };
    };

    const busN16 = mkDelayBus();
    const busN8 = mkDelayBus();
    const busN3_4 = mkDelayBus();
    delayBusesRef.current = { N16: busN16, N8: busN8, N3_4: busN3_4 };

    // Reverb buses (S/M/L)
    const convS = ctx.createConvolver();
    const convM = ctx.createConvolver();
    const convL = ctx.createConvolver();
    const wetS = ctx.createGain(); wetS.gain.value = 1.0;
    const wetM = ctx.createGain(); wetM.gain.value = 1.0;
    const wetL = ctx.createGain(); wetL.gain.value = 1.0;

    convS.connect(wetS); wetS.connect(master);
    convM.connect(wetM); wetM.connect(master);
    convL.connect(wetL); wetL.connect(master);

    reverbConvRef.current = { S: convS, M: convM, L: convL };
    reverbWetGainRef.current = { S: wetS, M: wetM, L: wetL };

    // Per-instrument sends to buses
    INSTRUMENTS.forEach((inst) => {
      const post = muteGainsRef.current.get(inst.id);

      // Delay sends
      const sN16 = ctx.createGain(), sN8 = ctx.createGain(), sN3_4 = ctx.createGain();
      sN16.gain.value = 0; sN8.gain.value = 0; sN3_4.gain.value = 0;
      post.connect(sN16); sN16.connect(busN16.in);
      post.connect(sN8);  sN8.connect(busN8.in);
      post.connect(sN3_4); sN3_4.connect(busN3_4.in);
      delaySendGainsRef.current.set(inst.id, { N16: sN16, N8: sN8, N3_4: sN3_4 });

      // Reverb sends
      const rS = ctx.createGain(), rM = ctx.createGain(), rL = ctx.createGain();
      rS.gain.value = 0; rM.gain.value = 0; rL.gain.value = 0;
      post.connect(rS); rS.connect(convS);
      post.connect(rM); rM.connect(convM);
      post.connect(rL); rL.connect(convL);
      reverbSendGainsRef.current.set(inst.id, { S: rS, M: rM, L: rL });
    });

    // Pre-duck mix + duck chain per instrument
    INSTRUMENTS.forEach((inst) => {
      const post = muteGainsRef.current.get(inst.id);
      const mix = ctx.createGain();
      mix.gain.value = 1.0;

      const gMap = new Map();
      let last = mix;
      INSTRUMENTS.forEach((trig) => {
        const dg = ctx.createGain();
        dg.gain.value = 1.0;
        last.connect(dg);
        last = dg;
        gMap.set(trig.id, dg);
      });
      last.connect(post);

      mixGainsRef.current.set(inst.id, mix);
      duckGainsRef.current.set(inst.id, gMap);
    });

    // Metronome buffers
    metClickRef.current.hi = createClickBuffer(ctx, 2000, 0.002);
    metClickRef.current.lo = createClickBuffer(ctx, 1200, 0.002);

    // iOS unlock
    const resume = () => ctx.resume();
    window.addEventListener("pointerdown", resume, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resume);
      ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== tempo: delay times + reverb IR lengths =====
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const buses = delayBusesRef.current;
    if (!ctx || !buses?.N16) return;

    const spb = 60 / bpm;
    buses.N16.node.delayTime.setValueAtTime(spb / 4, ctx.currentTime);
    buses.N8.node.delayTime.setValueAtTime(spb / 2, ctx.currentTime);
    buses.N3_4.node.delayTime.setValueAtTime((3 * spb) / 4, ctx.currentTime);
  }, [bpm]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    const convs = reverbConvRef.current;
    if (!ctx || !convs?.S) return;

    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;
    const durS = Math.max(0.2, 4 * secondsPerStep);
    const durM = Math.max(0.2, 8 * secondsPerStep);
    const durL = Math.max(0.2, 16 * secondsPerStep);

    convs.S.buffer = makeImpulseResponse(ctx, durS, 1.8);
    convs.M.buffer = makeImpulseResponse(ctx, durM, 2.2);
    convs.L.buffer = makeImpulseResponse(ctx, durL, 2.8);
  }, [bpm]);

  // ===== sum bus params =====
  useEffect(() => {
    const n = sumNodesRef.current.comp;
    if (!n) return;
    n.threshold.value = sumComp.threshold;
    n.ratio.value     = sumComp.ratio;
    n.attack.value    = sumComp.attack;
    n.release.value   = sumComp.release;
    n.knee.value      = sumComp.knee;
  }, [sumComp]);

  useEffect(() => {
    const { comp, limiter, makeup } = sumNodesRef.current;
    if (!comp || !limiter || !makeup) return;
    try { comp.disconnect(); } catch {}
    try { limiter.disconnect(); } catch {}
    if (limiterOn) { comp.connect(limiter); limiter.connect(makeup); }
    else { comp.connect(makeup); }
  }, [limiterOn]);

  useEffect(() => {
    const n = sumNodesRef.current.makeup;
    if (n) n.gain.value = dbToGain(sumGainDb);
  }, [sumGainDb]);

  // ===== apply mute/vol to nodes =====
  useEffect(() => {
    INSTRUMENTS.forEach((i) => {
      const g = muteGainsRef.current.get(i.id);
      if (g) g.gain.value = mutes?.[i.id] ? 0 : dbToGain(instGainsDb?.[i.id] ?? 0);
    });
  }, [instGainsDb, mutes]);

  // ===== FX sends follow per-instrument wet+mode =====
  const updateDelaySends = (instId, pctOverride) => {
    const sends = delaySendGainsRef.current.get(instId);
    if (!sends) return;
    const pct = pctOverride ?? (instDelayWet?.[instId] ?? 0);
    const mode = instDelayMode?.[instId] ?? "N8";
    const v = (pct || 0) / 100;
    sends.N16.gain.value = mode === "N16" ? v : 0;
    sends.N8.gain.value  = mode === "N8" ? v : 0;
    sends.N3_4.gain.value= mode === "N3_4" ? v : 0;
  };
  const updateReverbSends = (instId, pctOverride) => {
    const sends = reverbSendGainsRef.current.get(instId);
    if (!sends) return;
    const pct = pctOverride ?? (instReverbWet?.[instId] ?? 0);
    const mode = instRevMode?.[instId] ?? "M";
    const v = (pct || 0) / 100;
    sends.S.gain.value = mode === "S" ? v : 0;
    sends.M.gain.value = mode === "M" ? v : 0;
    sends.L.gain.value = mode === "L" ? v : 0;
  };

  useEffect(() => { INSTRUMENTS.forEach(i => updateDelaySends(i.id)); }, [instDelayMode, instDelayWet]); // eslint-disable-line
  useEffect(() => { INSTRUMENTS.forEach(i => updateReverbSends(i.id)); }, [instRevMode,  instReverbWet]); // eslint-disable-line

  // ===== pack loading =====
  const loadPack = async (packId) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // fade/choke ringing voices on pack swap
    const now = ctx.currentTime;
    activeVoicesRef.current.forEach((_, instId) => { try { chokeVoices(instId, now); } catch {} });

    let packMap = bufferCacheRef.current.get(packId);
    if (!packMap) {
      packMap = new Map();
      bufferCacheRef.current.set(packId, packMap);
    }

    await Promise.all(INSTRUMENTS.map(async (inst) => {
      const url = getPackUrl(inst.id, packId);
      if (!url) return;
      if (packMap.has(inst.id)) {
        buffersRef.current.set(inst.id, packMap.get(inst.id));
        return;
      }
      const buf = await fetchAndDecode(ctx, url).catch(() => null);
      if (buf) { packMap.set(inst.id, buf); buffersRef.current.set(inst.id, buf); }
    }));
  };

  // auto-load when selectedPack changes
  useEffect(() => {
    if (audioCtxRef.current && selectedPack) loadPack(selectedPack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPack]);

  const getBufferForCurrentPack = (instId) => {
    const packId = selectedPackRef.current;
    const packMap = bufferCacheRef.current.get(packId);
    return packMap?.get(instId) ?? null;
  };

  // ===== playback helpers =====
  function playBuffer(buffer, gain = 1.0, when = 0) {
    if (!buffer || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(masterGainRef.current);
    src.start(when > 0 ? when : 0);
  }

  function playSample(instId, velocity = 1.0, when = 0) {
    const ctx = audioCtxRef.current;
    const buf = getBufferForCurrentPack(instId);
    const mix = mixGainsRef.current.get(instId);
    if (!ctx || !buf || !mix) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const vel = Math.max(0, Math.min(1, velocity));
    g.gain.value = vel;

    src.connect(g).connect(mix);
    const tStart = when > 0 ? when : 0;
    src.start(tStart);

    if (!activeVoicesRef.current.has(instId)) {
      activeVoicesRef.current.set(instId, new Set());
    }
    const voice = { src, gain: g };
    activeVoicesRef.current.get(instId).add(voice);
    src.onended = () => {
      const set = activeVoicesRef.current.get(instId);
      if (set) set.delete(voice);
    };
  }

  function chokeVoices(targetInstId, when = 0) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const set = activeVoicesRef.current.get(targetInstId);
    if (!set || set.size === 0) return;

    const t = Math.max(when, ctx.currentTime);
    const RELEASE = 0.02; // 20ms
    set.forEach(({ src, gain }) => {
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + RELEASE);
        src.stop(t + RELEASE + 0.005);
      } catch {}
    });
  }

  // ===== peak meter =====
  useEffect(() => {
    const analyser = sumNodesRef.current.analyser;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    let rafId;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
      }
      const db = 20 * Math.log10(peak || 1e-8);
      setSumMeterDb(db);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return {
    // nodes/refs you may need
    audioCtxRef,
    muteGainsRef,
    mixGainsRef,
    duckGainsRef,
    delayBusesRef,
    delaySendGainsRef,
    reverbConvRef,
    reverbWetGainRef,
    reverbSendGainsRef,
    metClickRef,

    // buffers
    bufferCacheRef,
    getBufferForCurrentPack,
    loadPack,

    // fx helpers
    updateDelaySends,
    updateReverbSends,

    // playback
    playBuffer,
    playSample,
    chokeVoices,

    // metering
    sumMeterDb,
  };
}
