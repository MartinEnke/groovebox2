// src/GrooveBox.jsx
import React, { useEffect, useRef, useState } from "react";

import { SAMPLE_PACKS, PACK_IDS } from "./constants/packs";
import { INSTRUMENTS, CHOKE_GROUPS } from "./constants/instruments";
import { VELS, STEP_CYCLE_ORDER, PPQ, STEPS_PER_BAR, LOOKAHEAD_MS, SCHEDULE_AHEAD_TIME } from "./constants/sequencer";
import { SESSIONS_KEY, CURRENT_SESSION_KEY, SESSION_VERSION, SESSION_KEY } from "./constants/session";

import { clamp, pad, dbToGain, coerce16, deepClone } from "./utils/misc";
import { fetchAndDecode, createClickBuffer, makeImpulseResponse } from "./utils/audio";

import { InstrumentGrid } from "./components/InstrumentGrid";
import Channel from "./components/Channel";
import SidechainPanel from "./components/panels/SidechainPanel";
import FXPanel from "./components/panels/FXPanel";
import SwingPanel from "./components/panels/SwingPanel";



export default function GrooveBox() {
  // ===== Audio graph refs =====
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const buffersRef = useRef(new Map()); // id -> AudioBuffer
  const muteGainsRef = useRef(new Map()); // id -> GainNode
  const metClickRef = useRef({ hi: null, lo: null });




const [sessions, setSessions] = useState({});     // { [name]: sessionObj }
const [currentSessionName, setCurrentSessionName] = useState("");

useEffect(() => {
  // Load saved sessions dictionary
  let dict = {};
  try { dict = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}"); } catch {}
  setSessions(dict);

  // Optional: auto-load last selected named session
  const last = localStorage.getItem(CURRENT_SESSION_KEY);
  if (last && dict[last]) {
    setCurrentSessionName(last);
    // apply AFTER audio/graph exist; slight deferral helps:
    queueMicrotask(() => applySession(dict[last]));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);



  // Sample-pack selection
  const [selectedPack, setSelectedPack] = useState(PACK_IDS[0]);
  const [packLoading, setPackLoading] = useState(false);
  // Cache decoded buffers per pack to avoid re-decoding when switching back
  // Map<packId, Map<instId, AudioBuffer>>
  const bufferCacheRef = useRef(new Map());

  // Per-instrument sum ("mix") before ducking, then chain of duck gains -> post volume/mute
  const mixGainsRef = useRef(new Map()); // instId -> GainNode (sum of all note voices)
  const duckGainsRef = useRef(new Map()); // targetId -> Map<triggerId, GainNode> (series chain)

  // Fold/unfold for sections
  const [showPads, setShowPads] = useState(true);
  const [showFX, setShowFX] = useState(true);
  const [showSwingUI, setShowSwingUI] = useState(true);
  const [showSC, setShowSC] = useState(true); // Sidechain
  const [showSum, setShowSum] = useState(true); // Sum Bus

  // --- FX wet % per instrument (0..100) ---
  const [instDelayWet, setInstDelayWet] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );

  // Sidechain matrix: target -> trigger -> boolean
  const [scMatrix, setScMatrix] = useState(
    Object.fromEntries(
      INSTRUMENTS.map((t) => [
        t.id,
        Object.fromEntries(INSTRUMENTS.map((s) => [s.id, false])),
      ])
    )
  );
  // Per-target duck depth/attack/release
  const [scAmtDb, setScAmtDb] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 6]))
  ); // dB
  const [scAtkMs, setScAtkMs] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 12]))
  ); // ms
  const [scRelMs, setScRelMs] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 180]))
  ); // ms

  // Refs for scheduler
  const scMatrixRef = useRef(scMatrix);
  const scAmtDbRef = useRef(scAmtDb);
  const scAtkMsRef = useRef(scAtkMs);
  const scRelMsRef = useRef(scRelMs);
  useEffect(() => {
    scMatrixRef.current = scMatrix;
  }, [scMatrix]);
  useEffect(() => {
    scAmtDbRef.current = scAmtDb;
  }, [scAmtDb]);
  useEffect(() => {
    scAtkMsRef.current = scAtkMs;
  }, [scAtkMs]);
  useEffect(() => {
    scRelMsRef.current = scRelMs;
  }, [scRelMs]);

  // ===== Sum bus (meter + comp/limiter) =====
  const sumNodesRef = useRef({ in: null, analyser: null, comp: null, limiter: null, makeup: null });
  const [sumGainDb, setSumGainDb] = useState(0); // makeup/output gain
  const [limiterOn, setLimiterOn] = useState(true); // limiter toggle
  const [sumMeterDb, setSumMeterDb] = useState(-Infinity); // peak dBFS readout

  // Simple compressor settings
  const [sumComp, setSumComp] = useState({
    threshold: -12, // dB
    ratio: 3, // 1..20
    attack: 0.003, // seconds
    release: 0.25, // seconds
    knee: 3, // dB
  });



  // Per-instrument delay mode: 'N16' (1/16), 'N8' (1/8), 'N3_4' (3/4)
  const [instDelayMode, setInstDelayMode] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "N8"]))
  );

  const [instReverbWet, setInstReverbWet] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );
  // Per-instrument REVERB length mode: 'S' (4 steps), 'M' (8), 'L' (16)
  const [instRevMode, setInstRevMode] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "M"]))
  );

  // ===== FX buses & per-instrument sends =====
  const delayBusesRef = useRef({ N16: null, N8: null, N3_4: null });
  // per-instrument delay sends: instId -> { N16: GainNode, N8: GainNode, N3_4: GainNode }
  const delaySendGainsRef = useRef(new Map());

  // Reverb: three global buses (S/M/L)
  const reverbConvRef = useRef({ S: null, M: null, L: null });
  const reverbWetGainRef = useRef({ S: null, M: null, L: null });
  // per-instrument reverb sends: instId -> { S: GainNode, M: GainNode, L: GainNode }
  const reverbSendGainsRef = useRef(new Map());

  // Sequencer state
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [step, setStep] = useState(0); // UI indicator only

  // Metronome mode: "beats" (4), "all" (16), "off"
  const [metMode, setMetMode] = useState("beats");
  const metModeRef = useRef(metMode);
  useEffect(() => {
    metModeRef.current = metMode;
  }, [metMode]);

  function cycleMetronomeMode() {
    setMetMode((prev) => (prev === "beats" ? "all" : prev === "all" ? "off" : "beats"));
  }

  // Which row (A/B) is active *for UI* this bar
  const [uiLatchedRow, setUiLatchedRow] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "A"]))
  );

  // per-instrument per-row unfold state (false = 1x16, true = 2x8 large)
  const [rowExpanded, setRowExpanded] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: false, B: false }]))
  );

  function toggleRowExpanded(instId, row) {
    setRowExpanded((prev) => ({
      ...prev,
      [instId]: { ...prev[instId], [row]: !prev[instId][row] },
    }));
  }

  function getPackUrl(instId, packId) {
    return SAMPLE_PACKS[packId]?.files?.[instId] ?? null;
  }

  async function loadPack(packId) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    setPackLoading(true);

    // Gently stop any ringing voices so the swap is clean
    const now = ctx.currentTime;
    activeVoicesRef.current.forEach((voices, instId) => {
      try {
        chokeVoices(instId, now);
      } catch {}
    });

    // Use / build cache for this pack
    let packMap = bufferCacheRef.current.get(packId);
    if (!packMap) {
      packMap = new Map();
      bufferCacheRef.current.set(packId, packMap);
    }

    // Load (or reuse from cache) all instrument buffers for this pack
    await Promise.all(
      INSTRUMENTS.map(async (inst) => {
        const url = getPackUrl(inst.id, packId);
        if (!url) {
          console.warn(`[Pack ${packId}] Missing file for instrument: ${inst.id}`);
          return;
        }

        if (packMap.has(inst.id)) {
          buffersRef.current.set(inst.id, packMap.get(inst.id));
          return;
        }

        const buf = await fetchAndDecode(ctx, url).catch(() => null);
        if (buf) {
          packMap.set(inst.id, buf);
          buffersRef.current.set(inst.id, buf);
        } else {
          console.warn(`Failed to load ${url}`);
        }
      })
    );

    setPackLoading(false);
  }

  // Load/reload pack when the user switches in the dropdown
  useEffect(() => {
    if (audioCtxRef.current) loadPack(selectedPack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPack]);

  function updateDelaySends(instId, pctOverride) {
    const sends = delaySendGainsRef.current.get(instId);
    if (!sends) return;

    const pct = pctOverride ?? instDelayWet[instId] ?? 0;
    const mode = instDelayMode[instId] ?? "N8";
    const v = pct / 100;

    sends.N16.gain.value = mode === "N16" ? v : 0;
    sends.N8.gain.value = mode === "N8" ? v : 0;
    sends.N3_4.gain.value = mode === "N3_4" ? v : 0;
  }

  useEffect(() => {
    INSTRUMENTS.forEach((i) => updateDelaySends(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instDelayMode, instDelayWet]);

  function updateReverbSends(instId, pctOverride) {
    const sends = reverbSendGainsRef.current.get(instId);
    if (!sends) return;
    const pct = pctOverride ?? instReverbWet[instId] ?? 0;
    const mode = instRevMode[instId] ?? "M";
    const v = pct / 100;

    // set only the active bus, others to 0
    sends.S.gain.value = mode === "S" ? v : 0;
    sends.M.gain.value = mode === "M" ? v : 0;
    sends.L.gain.value = mode === "L" ? v : 0;
  }

  useEffect(() => {
    INSTRUMENTS.forEach((i) => updateReverbSends(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instRevMode, instReverbWet]);

  // Selected instrument & mutes
  const [selected, setSelected] = useState(INSTRUMENTS[0].id);
  const [mutes, setMutes] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, false]))
  );

  // Per-instrument volume (dB)
  const [instGainsDb, setInstGainsDb] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );

  // Solo
  const [soloActive, setSoloActive] = useState(false);
  const prevMutesRef = useRef(null); // to restore mutes after unsolo

  // Global swing scale (0..150%), default 100
  const [globalSwingPct, setGlobalSwingPct] = useState(100);
  const globalSwingPctRef = useRef(100);
  useEffect(() => {
    globalSwingPctRef.current = globalSwingPct;
  }, [globalSwingPct]);

  // Per-instrument swing type and amount
  const [instSwingType, setInstSwingType] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "none"])) // "none" | "8" | "16"
  );
  const [instSwingAmt, setInstSwingAmt] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0])) // 0..100 (%)
  );
  const instSwingTypeRef = useRef(instSwingType);
  const instSwingAmtRef = useRef(instSwingAmt);
  useEffect(() => {
    instSwingTypeRef.current = instSwingType;
  }, [instSwingType]);
  useEffect(() => {
    instSwingAmtRef.current = instSwingAmt;
  }, [instSwingAmt]);

  // Patterns: instrument -> { A: Array(16), B: Array(16) } (velocities 0..1)
  const [patterns, setPatterns] = useState(() =>
    Object.fromEntries(
      INSTRUMENTS.map((i) => [
        i.id,
        { A: new Array(STEPS_PER_BAR).fill(0), B: new Array(STEPS_PER_BAR).fill(0) },
      ])
    )
  );

  // Row activity (at least one true)
  const [rowActive, setRowActive] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: true, B: false }]))
  );

  // Scheduler internals
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerIdRef = useRef(null);
  const recentWritesRef = useRef(new Map()); // keys like "kick-A-3"
  const loopStartRef = useRef(0);

  // Active voices per instrument so we can choke (fade/stop) them
  const activeVoicesRef = useRef(new Map()); // instId -> Set<{src, gain}>

  // Mirrors of state in refs
  const patternsRef = useRef(patterns);
  const mutesRef = useRef(mutes);
  const metronomeOnRef = useRef(metronomeOn);
  const rowActiveRef = useRef(rowActive);
  useEffect(() => {
    patternsRef.current = patterns;
  }, [patterns]);
  useEffect(() => {
    mutesRef.current = mutes;
  }, [mutes]);
  useEffect(() => {
    metronomeOnRef.current = metronomeOn;
  }, [metronomeOn]);
  useEffect(() => {
    rowActiveRef.current = rowActive;
  }, [rowActive]);

  // Latched row for each instrument (which row plays this bar)
  const latchedRowRef = useRef(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "A"]))
  );

  // ===== Init Audio =====
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    // Master (pre-sum)
    const master = ctx.createGain();
    master.gain.value = 0.9;
    masterGainRef.current = master;

    // ===== SUM BUS chain: master -> in -> analyser -> comp -> (limiter?) -> makeup -> destination
    const sumIn = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; // pass-through; we'll read peak
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.knee.value = 3;

    const limiter = ctx.createDynamicsCompressor();
    // quasi-limiter settings
    limiter.threshold.value = -1.0;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const makeup = ctx.createGain(); // sum output (makeup) gain
    makeup.gain.value = dbToGain(0);

    // Wire it
    master.connect(sumIn);
    sumIn.connect(analyser);
    analyser.connect(comp);
    comp.connect(limiter);
    limiter.connect(makeup);
    makeup.connect(ctx.destination);

    // keep for later control
    sumNodesRef.current = { in: sumIn, analyser, comp, limiter, makeup };

    // Per-instrument post nodes (mute + volume)
    INSTRUMENTS.forEach((inst) => {
      const g = ctx.createGain();
      g.gain.value = dbToGain(instGainsDb[inst.id] ?? 0);
      g.connect(master);
      muteGainsRef.current.set(inst.id, g);
    });

    // ===== Delay buses (three: 1/16, 1/8, 3/4) =====
    const mkDelayBus = () => {
      const inGain = ctx.createGain();
      inGain.gain.value = 1.0;
      const node = ctx.createDelay(2.0); // max 2s
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

    // initial tempo sync
    const spbInit = 60 / bpm;
    busN16.node.delayTime.value = spbInit / 4; // 1/16
    busN8.node.delayTime.value = spbInit / 2; // 1/8
    busN3_4.node.delayTime.value = (3 * spbInit) / 4; // 3/4

    // ===== Reverb buses (S/M/L) =====
    const convS = ctx.createConvolver();
    const convM = ctx.createConvolver();
    const convL = ctx.createConvolver();
    const wetS = ctx.createGain();
    wetS.gain.value = 1.0;
    const wetM = ctx.createGain();
    wetM.gain.value = 1.0;
    const wetL = ctx.createGain();
    wetL.gain.value = 1.0;

    convS.connect(wetS);
    wetS.connect(master);
    convM.connect(wetM);
    wetM.connect(master);
    convL.connect(wetL);
    wetL.connect(master);

    reverbConvRef.current = { S: convS, M: convM, L: convL };
    reverbWetGainRef.current = { S: wetS, M: wetM, L: wetL };

    // Per-instrument sends to each bus (post-fader/post-mute)
    INSTRUMENTS.forEach((inst) => {
      const post = muteGainsRef.current.get(inst.id);

      const sN16 = ctx.createGain();
      const sN8 = ctx.createGain();
      const sN3_4 = ctx.createGain();

      // start muted; updateDelaySends will set the active one
      sN16.gain.value = 0;
      sN8.gain.value = 0;
      sN3_4.gain.value = 0;

      post.connect(sN16);
      sN16.connect(busN16.in);
      post.connect(sN8);
      sN8.connect(busN8.in);
      post.connect(sN3_4);
      sN3_4.connect(busN3_4.in);

      // store all three sends for this instrument
      delaySendGainsRef.current.set(inst.id, { N16: sN16, N8: sN8, N3_4: sN3_4 });

      // apply current wet/mode immediately
      updateDelaySends(inst.id);

      // --- Reverb sends (S / M / L) ---
      const rSendS = ctx.createGain();
      const rSendM = ctx.createGain();
      const rSendL = ctx.createGain();

      // start muted; the active one will be set by updateReverbSends()
      rSendS.gain.value = 0;
      rSendM.gain.value = 0;
      rSendL.gain.value = 0;

      post.connect(rSendS);
      rSendS.connect(convS);
      post.connect(rSendM);
      rSendM.connect(convM);
      post.connect(rSendL);
      rSendL.connect(convL);

      reverbSendGainsRef.current.set(inst.id, { S: rSendS, M: rSendM, L: rSendL });

      // apply current reverb wet/mode immediately
      updateReverbSends(inst.id);
    });

    // Metronome click buffers
    metClickRef.current.hi = createClickBuffer(ctx, 2000, 0.002);
    metClickRef.current.lo = createClickBuffer(ctx, 1200, 0.002);

    // Unlock on first user gesture (iOS)
    const resume = () => ctx.resume();
    window.addEventListener("pointerdown", resume, { once: true });

    // Load the initial pack as soon as the AudioContext is ready
    loadPack(selectedPack);

    // Per-instrument pre-duck mix + duck chain: voices -> mix -> [duck gains...] -> post
    INSTRUMENTS.forEach((inst) => {
      const post = muteGainsRef.current.get(inst.id);
      if (!post) return;

      // Sum of all voices for this instrument
      const mix = audioCtxRef.current.createGain();
      mix.gain.value = 1.0;

      // One duck gain per possible trigger (default 1.0), chained in series
      const gMap = new Map();
      let last = mix;
      INSTRUMENTS.forEach((trig) => {
        const dg = audioCtxRef.current.createGain();
        dg.gain.value = 1.0; // no ducking by default
        last.connect(dg);
        last = dg;
        gMap.set(trig.id, dg);
      });

      // Out of duck chain into the instrument's post node (which feeds master + FX sends)
      last.connect(post);

      // Stash refs
      mixGainsRef.current.set(inst.id, mix);
      duckGainsRef.current.set(inst.id, gMap);
    });

    return () => ctx.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Solo helpers =====
  function applyMutes(newMutes) {
    setMutes(newMutes);
    mutesRef.current = newMutes;
    INSTRUMENTS.forEach((i) => {
      const g = muteGainsRef.current.get(i.id);
      if (g) g.gain.value = newMutes[i.id] ? 0 : dbToGain(instGainsDb[i.id] ?? 0);
    });
  }

  function toggleSolo() {
    if (soloActive) {
      const allUnmuted = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, false]));
      applyMutes(allUnmuted);
      setSoloActive(false);
      prevMutesRef.current = null;
    } else {
      const soloMap = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.id !== selected]));
      applyMutes(soloMap);
      setSoloActive(true);
    }
  }

  useEffect(() => {
    if (!soloActive) return;
    const soloMap = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.id !== selected]));
    applyMutes(soloMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, soloActive]);

  // Delay times follow BPM for all three buses
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const buses = delayBusesRef.current;
    if (!ctx || !buses) return;
    const spb = 60 / bpm;

    const targets = {
      N16: spb / 4, // 1/16
      N8: spb / 2, // 1/8
      N3_4: (3 * spb) / 4, // 3/4
    };

    Object.entries(targets).forEach(([k, t]) => {
      const d = buses[k]?.node;
      if (d) {
        d.delayTime.cancelScheduledValues(ctx.currentTime);
        d.delayTime.linearRampToValueAtTime(t, ctx.currentTime + 0.01);
      }
    });
  }, [bpm]);

  // Rebuild three IRs to match BPM (S=4 steps, M=8, L=16)
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const convs = reverbConvRef.current;
    if (!ctx || !convs?.S || !convs?.M || !convs?.L) return;

    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;

    const durS = Math.max(0.2, 4 * secondsPerStep);
    const durM = Math.max(0.2, 8 * secondsPerStep);
    const durL = Math.max(0.2, 16 * secondsPerStep);

    convs.S.buffer = makeImpulseResponse(ctx, durS, 1.8);
    convs.M.buffer = makeImpulseResponse(ctx, durM, 2.2);
    convs.L.buffer = makeImpulseResponse(ctx, durL, 2.8);
  }, [bpm]);

  // Update compressor params when sliders change
  useEffect(() => {
    const n = sumNodesRef.current.comp;
    if (!n) return;
    n.threshold.value = sumComp.threshold;
    n.ratio.value = sumComp.ratio;
    n.attack.value = sumComp.attack;
    n.release.value = sumComp.release;
    n.knee.value = sumComp.knee;
  }, [sumComp]);

  // Toggle limiter in/out of circuit
  useEffect(() => {
    const { comp, limiter, makeup } = sumNodesRef.current;
    if (!comp || !limiter || !makeup) return;

    // Clean current connections after comp
    try {
      comp.disconnect();
    } catch {}
    try {
      limiter.disconnect();
    } catch {}

    if (limiterOn) {
      comp.connect(limiter);
      limiter.connect(makeup);
    } else {
      comp.connect(makeup);
    }
  }, [limiterOn]);

  // Makeup/output gain
  useEffect(() => {
    const n = sumNodesRef.current.makeup;
    if (n) n.gain.value = dbToGain(sumGainDb);
  }, [sumGainDb]);

  // Peak meter (dBFS)
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
      const db = 20 * Math.log10(peak || 1e-8); // avoid -Infinity
      setSumMeterDb(db);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafId);
  }, []);

  function scheduleDuckEnvelopes(triggerId, when) {
    const matrix = scMatrixRef.current;
    const amtDb = scAmtDbRef.current;
    const atkMs = scAtkMsRef.current;
    const relMs = scRelMsRef.current;

    // For every TARGET that has this trigger toggled on, dip its specific duck gain
    INSTRUMENTS.forEach((target) => {
      if (!matrix?.[target.id]?.[triggerId]) return;

      const dg = duckGainsRef.current.get(target.id)?.get(triggerId);
      if (!dg) return;

      const g = dg.gain;
      const dip = Math.max(0.0001, dbToGain(-(amtDb[target.id] ?? 6)));
      const atk = Math.max(0.001, (atkMs[target.id] ?? 12) / 1000);
      const rel = Math.max(0.001, (relMs[target.id] ?? 180) / 1000);

      const t0 = when;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(1.0, t0);
      // exponential ramps sound smoother for ducking
      g.exponentialRampToValueAtTime(dip, t0 + atk);
      g.exponentialRampToValueAtTime(1.0, t0 + atk + rel);
    });
  }
  
  // Keep this near your other refs/states (just before Scheduling is fine)
const selectedPackRef = useRef(selectedPack);
useEffect(() => { selectedPackRef.current = selectedPack; }, [selectedPack]);

function getBufferForCurrentPack(instId) {
  const packId = selectedPackRef.current;
  const packMap = bufferCacheRef.current.get(packId);
  return packMap?.get(instId) ?? null;
}



function persistSessions(next) {
    setSessions(next);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(next)); } catch {}
  }
  
  function saveNamedSession(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const payload = { ...buildSession(), updatedAt: Date.now() };
  
    const next = { ...sessions, [trimmed]: payload };
    persistSessions(next);
  
    setCurrentSessionName(trimmed);
    try { localStorage.setItem(CURRENT_SESSION_KEY, trimmed); } catch {}
  }
  
  function deleteNamedSession(name) {
    const trimmed = (name || "").trim();
    if (!trimmed || !sessions[trimmed]) return;
    const { [trimmed]: _, ...rest } = sessions;
    persistSessions(rest);
  
    if (currentSessionName === trimmed) {
      setCurrentSessionName("");
      try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch {}
    }
  }
  
  function loadNamedSession(name) {
    const trimmed = (name || "").trim();
    if (!trimmed || !sessions[trimmed]) return;
    setCurrentSessionName(trimmed);
    try { localStorage.setItem(CURRENT_SESSION_KEY, trimmed); } catch {}
    applySession(sessions[trimmed]);
  }
  


function buildSession() {
    // Capture everything you'd expect to restore
    return {
      v: SESSION_VERSION,
      selectedPack,
  
      // transport & grid
      bpm,
      metMode,
  
      // per-instrument stuff
      patterns,            // {instId: {A:[16], B:[16]}}
      rowActive,           // {instId: {A:bool, B:bool}}
      instGainsDb,         // {instId: dB}
      mutes,               // {instId: bool}
      soloActive,
  
      // swing
      instSwingType,       // {instId: 'none'|'8'|'16'|'32'}
      instSwingAmt,        // {instId: 0..100}
      globalSwingPct,
  
      // FX
      instDelayWet,        // {instId: 0..100}
      instDelayMode,       // {instId: 'N16'|'N8'|'N3_4'}
      instReverbWet,       // {instId: 0..100}
      instRevMode,         // {instId: 'S'|'M'|'L'}
  
      // sidechain
      scMatrix,            // target->trigger->bool
      scAmtDb,             // {targetId: dB}
      scAtkMs,             // {targetId: ms}
      scRelMs,             // {targetId: ms}
  
      // sum bus
      sumComp,             // {threshold, ratio, attack, release, knee}
      sumGainDb,
      limiterOn,
  
      // (Optional UI niceties you may want to remember)
      rowExpanded,         // {instId:{A:bool,B:bool}}
      selected,            // selected instrument id
    };
  }
  
  // Apply a session safely (merges + node updates)
  async function applySession(raw) {
    if (!raw || typeof raw !== "object") return;
    const s = deepClone(raw);
  
    // version gate (simple for now)
    if (!("v" in s) || s.v > SESSION_VERSION) {
      console.warn("Session version is newer than this app. Attempting to load anyway.");
    }
  
    // Validate pack id
    const packId = PACK_IDS.includes(s.selectedPack) ? s.selectedPack : PACK_IDS[0];
  
    // Coerce patterns length & ensure all instruments exist
    const nextPatterns = {};
    INSTRUMENTS.forEach((i) => {
      const p = s.patterns?.[i.id];
      nextPatterns[i.id] = {
        A: coerce16(p?.A),
        B: coerce16(p?.B),
      };
    });
  
    // Shallow fallbacks for maps that must include all instruments
    const fallbackBoolRows = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: true, B: false }]));
    const fallbackDbMap    = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    const fallbackZeroMap  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    const fallbackModeDly  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "N8"]));
    const fallbackModeRev  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "M"]));
    const fallbackSwingT   = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "none"]));
    const fallbackSwingA   = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
  
    const safeMap = (src, fb) =>
      Object.fromEntries(INSTRUMENTS.map((i) => [i.id, (src && src[i.id] !== undefined) ? src[i.id] : fb[i.id]]));
  
    // === Set pack first so audio can load during/after state application ===
    setSelectedPack(packId);
  
    // === Core transport / grid
    setBpm(Number.isFinite(s.bpm) ? s.bpm : 120);
    setMetMode(["beats", "all", "off"].includes(s.metMode) ? s.metMode : "beats");
    setPatterns(nextPatterns);
    setRowActive(s.rowActive ? { ...fallbackBoolRows, ...s.rowActive } : fallbackBoolRows);
  
    // === Per-instrument volumes/mutes/solo
    setInstGainsDb(safeMap(s.instGainsDb, fallbackDbMap));
    // Apply mutes through helper so GainNodes update:
    applyMutes(s.mutes ? safeMap(s.mutes, Object.fromEntries(INSTRUMENTS.map(i => [i.id, false]))) :
      Object.fromEntries(INSTRUMENTS.map(i => [i.id, false])));
    setSoloActive(!!s.soloActive);
  
    // === Swing
    setInstSwingType(safeMap(s.instSwingType, fallbackSwingT));
    setInstSwingAmt(safeMap(s.instSwingAmt,  fallbackSwingA));
    setGlobalSwingPct(Number.isFinite(s.globalSwingPct) ? s.globalSwingPct : 100);
  
    // === FX
    setInstDelayWet(safeMap(s.instDelayWet, fallbackZeroMap));
    setInstDelayMode(safeMap(s.instDelayMode, fallbackModeDly));
    setInstReverbWet(safeMap(s.instReverbWet, fallbackZeroMap));
    setInstRevMode(safeMap(s.instRevMode, fallbackModeRev));
  
    // After state lands, update FX sends on nodes (tick next microtask)
    queueMicrotask(() => {
      INSTRUMENTS.forEach((i) => {
        updateDelaySends(i.id);
        updateReverbSends(i.id);
      });
    });
  
    // === Sidechain
    // Matrix: fill all target->trigger pairs with false by default
    const emptyRow = Object.fromEntries(INSTRUMENTS.map((s) => [s.id, false]));
    const nextScMatrix = Object.fromEntries(
      INSTRUMENTS.map((t) => [t.id, { ...emptyRow, ...(s.scMatrix?.[t.id] || {}) }])
    );
    setScMatrix(nextScMatrix);
  
    setScAmtDb(safeMap(s.scAmtDb, Object.fromEntries(INSTRUMENTS.map(i => [i.id, 6]))));
    setScAtkMs(safeMap(s.scAtkMs, Object.fromEntries(INSTRUMENTS.map(i => [i.id, 12]))));
    setScRelMs(safeMap(s.scRelMs, Object.fromEntries(INSTRUMENTS.map(i => [i.id, 180]))));
  
    // === Sum bus
    setSumComp({
      threshold: Number.isFinite(s.sumComp?.threshold) ? s.sumComp.threshold : -12,
      ratio:     Number.isFinite(s.sumComp?.ratio)     ? s.sumComp.ratio     : 3,
      attack:    Number.isFinite(s.sumComp?.attack)    ? s.sumComp.attack    : 0.003,
      release:   Number.isFinite(s.sumComp?.release)   ? s.sumComp.release   : 0.25,
      knee:      Number.isFinite(s.sumComp?.knee)      ? s.sumComp.knee      : 3,
    });
    setSumGainDb(Number.isFinite(s.sumGainDb) ? s.sumGainDb : 0);
    setLimiterOn(!!s.limiterOn);
  
    // === Optional UI niceties ===
    if (s.rowExpanded) setRowExpanded(s.rowExpanded);
    if (s.selected && INSTRUMENTS.some(i => i.id === s.selected)) setSelected(s.selected);
  
    // Pack switching: loadPack will run automatically via your `[selectedPack]` effect.
  }


  // Load once on mount (after audio nodes exist)
useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const sess = JSON.parse(raw);
      applySession(sess);
    } catch (e) {
      console.warn("Failed to parse saved session:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Auto-save whenever relevant state changes
  useEffect(() => {
    const session = buildSession();
    // simple throttle: write on next tick to batch multiple setStates
    const id = setTimeout(() => {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    }, 0);
    return () => clearTimeout(id);
    // Add anything you want persisted here:
  }, [
    selectedPack,
    bpm, metMode,
    patterns, rowActive,
    instGainsDb, mutes, soloActive,
    instSwingType, instSwingAmt, globalSwingPct,
    instDelayWet, instDelayMode,
    instReverbWet, instRevMode,
    scMatrix, scAmtDb, scAtkMs, scRelMs,
    sumComp, sumGainDb, limiterOn,
    rowExpanded, selected
  ]);
  
  
  function handleSelectedVolumeChange(db) {
    setInstGainsDb((prev) => ({ ...prev, [selected]: db }));
    const g = muteGainsRef.current.get(selected);
    if (g) g.gain.value = mutes[selected] ? 0 : dbToGain(db);
  }


// ===== Scheduling =====
useEffect(() => {
  if (!isPlaying || !audioCtxRef.current) return;

  // align loop start to current bar
  const secondsPerBeat = 60.0 / bpm;
  const secondsPerStep = secondsPerBeat / PPQ;
  const startIdx = currentStepRef.current % STEPS_PER_BAR;
  loopStartRef.current =
    audioCtxRef.current.currentTime - startIdx * secondsPerStep;

  nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;

  timerIdRef.current = setInterval(() => {
    schedule();
  }, LOOKAHEAD_MS);

  return () => clearInterval(timerIdRef.current);
}, [isPlaying, bpm]);

function getSwingOffsetSec(instId, stepIndex, secondsPerBeat) {
  const type = instSwingTypeRef.current?.[instId] ?? "none";
  const amtLocal = (instSwingAmtRef.current?.[instId] ?? 0) / 100;
  const amtGlobal = (globalSwingPctRef.current ?? 100) / 100; // 1.0 = 100%
  const amt = amtLocal * amtGlobal; // allow up to 1.5 (150%)

  if (type === "none" || amt <= 0) return 0;

  const withinBeat = stepIndex % 4;

  if (type === "8") {
    // delay the off-beat 8th (index 2 within each beat)
    return withinBeat === 2 ? amt * (secondsPerBeat / 6) : 0;
  }

  if (type === "16") {
    // delay off 16ths (indices 1 and 3)
    const isOff16 = (withinBeat % 2 === 1);
    return isOff16 ? amt * ((secondsPerBeat / 4) / 3) : 0;
  }

  if (type === "32") {
    // micro-swing: smaller delay on off-16ths (approx 32nd feel)
    const isOff16 = (withinBeat % 2 === 1);
    return isOff16 ? amt * ((secondsPerBeat / 8) / 3) : 0;
  }

  return 0;
}

function schedule() {
  const ctx = audioCtxRef.current;
  const secondsPerBeat = 60.0 / bpm;
  const secondsPerStep = secondsPerBeat / PPQ;

  while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
    const stepIndex = currentStepRef.current % STEPS_PER_BAR;

    // 1) Latch rows exactly at bar start, then sync UI latched rows
    if (stepIndex === 0) {
      INSTRUMENTS.forEach((inst) => {
        const ra = rowActiveRef.current?.[inst.id] || { A: true, B: false };
        const prev = latchedRowRef.current[inst.id] || "A";
        if (ra.A && ra.B) {
          latchedRowRef.current[inst.id] = prev === "A" ? "B" : "A";
        } else if (ra.A) {
          latchedRowRef.current[inst.id] = "A";
        } else if (ra.B) {
          latchedRowRef.current[inst.id] = "B";
        } else {
          latchedRowRef.current[inst.id] = prev || "A"; // safety
        }
      });

      // reflect latches in UI immediately (avoid extra renders if unchanged)
      setUiLatchedRow((prev) => {
        let changed = false;
        const next = { ...prev };
        INSTRUMENTS.forEach((inst) => {
          const v = latchedRowRef.current[inst.id];
          if (next[inst.id] !== v) {
            next[inst.id] = v;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    // 2) Metronome (unchanged)
    const mm = metModeRef.current;
    if (mm === "beats") {
      if (stepIndex % 4 === 0) playBuffer(metClickRef.current.hi, 0.15, nextNoteTimeRef.current);
    } else if (mm === "all") {
      const click = stepIndex % 4 === 0 ? metClickRef.current.hi : metClickRef.current.lo;
      playBuffer(click, 0.15, nextNoteTimeRef.current);
    } // mm === "off" → no clicks

    // 3) Schedule notes for this exact step (with HH→OHH choke + sidechain)
    INSTRUMENTS.forEach((inst) => {
      const row  = latchedRowRef.current[inst.id] || "A";
      const patt = patternsRef.current?.[inst.id]?.[row];
      const vel  = (patt?.[stepIndex]) || 0;

      if (vel > 0 && !mutesRef.current?.[inst.id]) {
        const key = `${inst.id}-${row}-${stepIndex}`;
        if (recentWritesRef.current.has(key)) {
          // Skip once if we just wrote this step in the current bar
          recentWritesRef.current.delete(key);
          return;
        }

        const when =
          nextNoteTimeRef.current + getSwingOffsetSec(inst.id, stepIndex, secondsPerBeat);

        // Choke group (e.g., closed HH chokes open HH)
        const targets = (CHOKE_GROUPS && CHOKE_GROUPS[inst.id]) ? CHOKE_GROUPS[inst.id] : [];
        targets.forEach(tid => chokeVoices(tid, when));

        // Fire sidechain envelopes for any targets listening to this trigger
        scheduleDuckEnvelopes(inst.id, when);

        // Finally play the note — pull buffer from CURRENT PACK
        const buf = getBufferForCurrentPack(inst.id);
        if (!buf) {
          // Optional: warn once in console for missing file in this pack
          // console.warn(`[Pack ${selectedPackRef.current}] Missing buffer for: ${inst.id}`);
          return;
        }
        playSample(inst.id, vel, when);
      }
    });

    // 4) Update the UI step to THIS step index (precise, not relative)
    setStep(stepIndex);

    // 5) Advance scheduler
    nextNoteTimeRef.current += secondsPerStep;
    currentStepRef.current = (currentStepRef.current + 1) % STEPS_PER_BAR;
  }
}

// ===== Compute precise step from AudioContext time (for recording) =====
function getRecordingStepIndex() {
  const ctx = audioCtxRef.current;
  if (!ctx) return currentStepRef.current % STEPS_PER_BAR;

  const secondsPerBeat = 60.0 / bpm;
  const secondsPerStep = secondsPerBeat / PPQ;

  const now = ctx.currentTime;
  const elapsed = now - loopStartRef.current;
  const safeElapsed = elapsed < 0 ? 0 : elapsed;

  const steps = safeElapsed / secondsPerStep + 1e-6;
  const idx = Math.floor(steps % STEPS_PER_BAR);
  return idx;
}

// ===== Audio playback =====
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
  const ctx  = audioCtxRef.current;
  const buf  = getBufferForCurrentPack(instId);   // ⟵ key change
  const mix  = mixGainsRef.current.get(instId);
  if (!ctx || !buf || !mix) return;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const g = ctx.createGain();
  g.gain.value = clamp(velocity, 0, 1);

  // voice chain: src -> voice gain -> per-instrument mix (then duck chain -> post -> master/FX)
  src.connect(g).connect(mix);

  const tStart = when > 0 ? when : 0;
  src.start(tStart);

  // track active voices (for chokes)
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
  // fast fade and stop shortly after
  const RELEASE = 0.02; // 20ms
  set.forEach(({ src, gain }) => {
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + RELEASE);
      src.stop(t + RELEASE + 0.005);
    } catch (_) {
      /* ignore nodes already stopped */
    }
  });
}

function exportSessionToFile() {
    const data = buildSession();
    const name =
      currentSessionName ||
      `session-${new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  function importSessionFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || "")); // basic parse
        applySession(obj);
        const suggested = (file.name || "Imported").replace(/\.json$/i, "");
        const name = prompt("Save imported session as:", suggested);
        if (name) saveNamedSession(name);
      } catch (e) {
        console.error(e);
        alert("Invalid session file.");
      }
    };
    reader.readAsText(file);
  }
  

  // ===== UI handlers =====
  function togglePlay() {
    if (!audioCtxRef.current) return;
    setIsPlaying((p) => {
      const next = !p;
      if (next) {
        currentStepRef.current = 0;
        setStep(0);
      }
      return next;
    });
  }

  function toggleRecord() {
    setIsRecording((r) => !r);
  }

  function toggleMute(instId) {
    setMutes((prev) => {
      const next = { ...prev, [instId]: !prev[instId] };
      const g = muteGainsRef.current.get(instId);
      if (g) g.gain.value = next[instId] ? 0 : dbToGain(instGainsDb[instId] ?? 0);
      return next;
    });
  }

  function selectInstrument(instId) {
    setSelected(instId);
  }

  function onPadPress(r, c) {
    const vel = VELS[r][c];

    // Monitor immediately
    if (!mutes[selected]) {
        // if this pad is the closed HH, choke the open HH right now
        const targets = CHOKE_GROUPS[selected] || [];
        const now = audioCtxRef.current?.currentTime || 0;
        targets.forEach(tid => chokeVoices(tid, now));
        playSample(selected, vel, 0);
      }

    if (isRecording && isPlaying) {
      const idx = getRecordingStepIndex();
      const row = latchedRowRef.current[selected] || "A";

      // Write now
      setPatterns((prev) => {
        const next = {
          ...prev,
          [selected]: {
            A: [...prev[selected].A],
            B: [...prev[selected].B],
          },
        };
        next[selected][row][idx] = vel;
        return next;
      });

      // Skip once only if this step is still ahead in THIS bar
      const ctx = audioCtxRef.current;
      const secondsPerBeat = 60.0 / bpm;
      const secondsPerStep = secondsPerBeat / PPQ;
      const now = ctx.currentTime;
      const tStepThisBar = loopStartRef.current + idx * secondsPerStep;

      const key = `${selected}-${row}-${idx}`;
      if (tStepThisBar > now + 1e-4) {
        recentWritesRef.current.set(key, true);
      } else {
        recentWritesRef.current.delete(key);
      }
    }
  }

  function cycleStepRow(row, stepIdx) {
    setPatterns((prev) => {
      const next = {
        ...prev,
        [selected]: { A: [...prev[selected].A], B: [...prev[selected].B] },
      };
  
      const curr = next[selected][row][stepIdx] ?? 0;
  
      // Find current in our explicit order [1.0, 0.75, 0.6, 0.45, 0]
      let i = STEP_CYCLE_ORDER.findIndex(v => Math.abs(v - curr) < 1e-6);
  
      // If not found (shouldn't happen), start at index -1 so next = 1.0
      if (i === -1) i = STEP_CYCLE_ORDER.length - 1; // treat as if at "0"
  
      const nextVel = STEP_CYCLE_ORDER[(i + 1) % STEP_CYCLE_ORDER.length];
      next[selected][row][stepIdx] = nextVel;
  
      return next;
    });
  }

  function toggleRowActiveUI(instId, row) {
    setRowActive((prev) => {
      const other = row === "A" ? "B" : "A";
      const curr = prev[instId];
      const nextVal = !curr[row];

      // Disallow disabling both
      if (!nextVal && !curr[other]) return prev;

      return {
        ...prev,
        [instId]: { ...curr, [row]: nextVal },
      };
    });
  }

  function clearSelectedPattern() {
    // wipe both rows for selected instrument
    setPatterns((prev) => {
      const next = {
        ...prev,
        [selected]: {
          A: new Array(STEPS_PER_BAR).fill(0),
          B: new Array(STEPS_PER_BAR).fill(0),
        },
      };
      return next;
    });

    // reset volume to 0 dB and unmute
    setInstGainsDb((prev) => ({ ...prev, [selected]: 0 }));
    setMutes((prev) => {
      const next = { ...prev, [selected]: false };
      mutesRef.current = next;
      return next;
    });
    const g = muteGainsRef.current.get(selected);
    if (g) g.gain.value = dbToGain(0);

    // clear any skip tokens for this instrument (both rows)
    for (const key of Array.from(recentWritesRef.current.keys())) {
      if (key.startsWith(`${selected}-`)) {
        recentWritesRef.current.delete(key);
      }
    }
    // reset FX sends for selected
setInstDelayWet(prev => ({ ...prev, [selected]: 0 }));
setInstReverbWet(prev => ({ ...prev, [selected]: 0 }));
const dSendSel = delaySendGainsRef.current.get(selected);
if (dSendSel) dSendSel.gain.value = 0;
const rSendSel = reverbSendGainsRef.current.get(selected);
if (rSendSel) rSendSel.gain.value = 0;

  }

  function clearAllPatternsAndLevels() {
    // 1) Clear patterns (both rows)
    setPatterns(
      Object.fromEntries(
        INSTRUMENTS.map((i) => [
          i.id,
          { A: new Array(STEPS_PER_BAR).fill(0), B: new Array(STEPS_PER_BAR).fill(0) },
        ])
      )
    );

    // 2) Reset all volumes to 0 dB
    const zeroDbMap = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    setInstGainsDb(zeroDbMap);

    // 3) Reset swing (type none, amt 0) + refs
    const swingTypeNone = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "none"]));
    const swingAmtZero = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    setInstSwingType(swingTypeNone);
    setInstSwingAmt(swingAmtZero);
    instSwingTypeRef.current = swingTypeNone;
    instSwingAmtRef.current = swingAmtZero;

    // reset all FX sends
const zeroWet = Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]));
setInstDelayWet(zeroWet);
setInstReverbWet(zeroWet);
INSTRUMENTS.forEach((i) => {
  const dS = delaySendGainsRef.current.get(i.id); if (dS) dS.gain.value = 0;
  const rS = reverbSendGainsRef.current.get(i.id); if (rS) rS.gain.value = 0;
});

    // 4) Unmute everything
    const allUnmuted = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, false]));
    setMutes(allUnmuted);
    mutesRef.current = allUnmuted;

    // 5) Apply 0 dB to GainNodes
    INSTRUMENTS.forEach((i) => {
      const g = muteGainsRef.current.get(i.id);
      if (g) g.gain.value = dbToGain(0);
    });

    // 6) Clear skip-once tokens
    recentWritesRef.current.clear();

    // 7) Turn off solo
    setSoloActive(false);
    prevMutesRef.current = null;
  }

  // ===== Render =====

  const FoldLabel = ({ text, height = 80 }) => (
    <div
      aria-hidden
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        userSelect: "none",
        color: "rgba(255,255,255,.55)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 1.2,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );

  
// ===== Render =====
return (
  <div style={{ color: "white" }}>
    {/* Header (2 rows) */}
<div style={{ display: "grid", rowGap: 8, marginBottom: 16 }}>

{/* ROW 1: Pack + Metronome + BPM */}
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
  {/* Pack picker */}
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <label style={{ fontSize: 12, opacity: 0.85 }}>Pack</label>
    <select
      value={selectedPack}
      onChange={(e) => setSelectedPack(e.target.value)}
      disabled={packLoading}
      title="Choose sample pack"
      style={{
        background: "rgba(255,255,255,.08)",
        border: "1px solid rgba(255,255,255,.2)",
        color: "white",
        padding: "6px 10px",
        borderRadius: 8,
        fontWeight: 600,
        letterSpacing: 0.4,
        minWidth: 160,
      }}
    >
      {PACK_IDS.map((pid) => (
        <option key={pid} value={pid}>
          {SAMPLE_PACKS[pid].label ?? pid}
        </option>
      ))}
    </select>
    {packLoading && <span style={{ fontSize: 12, opacity: 0.7 }}>loading…</span>}
  </div>

  {/* Metronome + BPM */}
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <button
      className={`btn metro-btn mode-${metMode}`}
      onClick={cycleMetronomeMode}
      title={
        metMode === "beats" ? "Metronome: 4 downbeats (click for 16th)"
        : metMode === "all" ? "Metronome: all 16th (click for off)"
        : "Metronome: off (click for 4 downbeats)"
      }
    >
      {metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF"}
    </button>

    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span>BPM</span>
      <input
        className="slider slider-bpm"
        type="range"
        min={60}
        max={200}
        value={bpm}
        onChange={(e) => setBpm(parseInt(e.target.value, 10))}
      />
      <span style={{ width: 32, textAlign: "right" }}>{bpm}</span>
    </div>
  </div>
</div>

{/* ROW 2: Sessions */}
<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
  <span style={{ opacity: .85, fontSize: 12 }}>Session</span>

  <select
    value={currentSessionName}
    onChange={(e) => loadNamedSession(e.target.value)}
    title="Select session"
    style={{
      background: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.2)",
      color: "white",
      padding: "6px 10px",
      borderRadius: 8,
      fontWeight: 600,
      letterSpacing: 0.3,
      minWidth: 180,
    }}
  >
    <option value="">— choose —</option>
    {Object
      .entries(sessions)
      .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
      .map(([name]) => (
        <option key={name} value={name}>{name}</option>
      ))}
  </select>

  <button
    className="btn"
    title={currentSessionName ? `Save "${currentSessionName}"` : "Save (asks for a name)"}
    onClick={() => {
      if (currentSessionName) {
        saveNamedSession(currentSessionName);
      } else {
        const name = prompt("Session name:", "My Beat");
        if (name) saveNamedSession(name);
      }
    }}
  >
    Save
  </button>

  <button
    className="btn"
    title="Save As…"
    onClick={() => {
      const name = prompt("Save As (new session name):", currentSessionName || "My Beat");
      if (!name) return;
      if (sessions[name] && !confirm(`"${name}" exists. Overwrite?`)) return;
      saveNamedSession(name);
    }}
  >
    Save As
  </button>

  <button
    className="btn"
    title="Delete selected session"
    onClick={() => {
      if (!currentSessionName) return;
      if (confirm(`Delete session "${currentSessionName}"?`)) {
        deleteNamedSession(currentSessionName);
      }
    }}
    disabled={!currentSessionName}
    style={{ opacity: currentSessionName ? 1 : 0.6 }}
  >
    Delete
  </button>

  <button className="btn" onClick={exportSessionToFile} title="Export session to file">Export</button>

  <label className="btn" title="Import session from file" style={{ cursor: "pointer" }}>
    Import
    <input
      type="file"
      accept="application/json"
      onChange={(e) => importSessionFromFile(e.target.files?.[0])}
      style={{ display: "none" }}
    />
  </label>

  <button
    className="btn"
    title="Clear current session (keeps BPM 120 and pack)"
    onClick={() => {
      clearAllPatternsAndLevels();
      setGlobalSwingPct(100);
      setInstDelayMode(Object.fromEntries(INSTRUMENTS.map(i => [i.id, "N8"])));
      setInstRevMode(Object.fromEntries(INSTRUMENTS.map(i => [i.id, "M"])));
      setScMatrix(Object.fromEntries(INSTRUMENTS.map(t => [t.id, Object.fromEntries(INSTRUMENTS.map(s => [s.id, false]))])));
      setScAmtDb(Object.fromEntries(INSTRUMENTS.map(i => [i.id, 6])));
      setScAtkMs(Object.fromEntries(INSTRUMENTS.map(i => [i.id, 12])));
      setScRelMs(Object.fromEntries(INSTRUMENTS.map(i => [i.id, 180])));
      setSumComp({ threshold: -12, ratio: 3, attack: 0.003, release: 0.25, knee: 3 });
      setSumGainDb(0);
      setLimiterOn(true);
      setCurrentSessionName("");
      try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch {}
    }}
  >
    New
  </button>
</div>
</div>


  {/* Divider */}
  <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

  

    {/* Instruments + Mutes */}
<InstrumentGrid
  selected={selected}
  selectInstrument={selectInstrument}
  mutes={mutes}
  toggleMute={toggleMute}
/>

    {/* Divider */}
    <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

    {/* Pads + Volume Fader — fold header (CHANNEL) */}
    <Channel
  show={showPads}
  onToggle={() => setShowPads((s) => !s)}
  selected={selected}
  volumeDb={instGainsDb[selected]}
  onVolumeChange={handleSelectedVolumeChange}
  soloActive={soloActive}
  onToggleSolo={toggleSolo}
  onPadPress={onPadPress}
/>

    {/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

{/* Sidechain fold header */}
{showSC && (
  <SidechainPanel
    selected={selected}
    scMatrix={scMatrix} setScMatrix={setScMatrix}
    scAmtDb={scAmtDb} setScAmtDb={setScAmtDb}
    scAtkMs={scAtkMs} setScAtkMs={setScAtkMs}
    scRelMs={scRelMs} setScRelMs={setScRelMs}
  />
)}

    {/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

    {/* FX fold header */}
    {showFX && (
  <FXPanel
    selected={selected}
    instDelayWet={instDelayWet} setInstDelayWet={setInstDelayWet}
    instDelayMode={instDelayMode} setInstDelayMode={setInstDelayMode}
    updateDelaySends={updateDelaySends}
    instReverbWet={instReverbWet} setInstReverbWet={setInstReverbWet}
    instRevMode={instRevMode} setInstRevMode={setInstRevMode}
    updateReverbSends={updateReverbSends}
  />
)}

    {/* Divider */}
    <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

    {/* Swing fold header (GROOVE) */}
    {showSwingUI && (
  <SwingPanel
    selected={selected}
    instSwingType={instSwingType} setInstSwingType={setInstSwingType}
    instSwingAmt={instSwingAmt}   setInstSwingAmt={setInstSwingAmt}
    globalSwingPct={globalSwingPct} setGlobalSwingPct={setGlobalSwingPct}
  />
)}

    {/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

{/* Sum Bus fold header */}
<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 6,
    marginBottom: 4,
    position: "relative",
  }}
>
  {/* Show label only when folded (matches your other sections) */}
  {!showSum && (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
        color: "rgba(255,255,255,.55)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 1.2,
        textTransform: "uppercase",
      }}
    >
      Sum Bus
    </div>
  )}

  <button
    onClick={() => setShowSum((s) => !s)}
    aria-expanded={showSum}
    title={showSum ? "Collapse Sum Bus" : "Expand Sum Bus"}
    style={{
      background: "transparent",
      border: "none",
      color: "rgba(255,255,255,.7)",
      cursor: "pointer",
      fontSize: 16,
      lineHeight: 1,
      padding: "2px 4px",
    }}
  >
    {showSum ? "▾" : "▸"}
  </button>
</div>

{showSum && (
  <div style={{
    marginTop: 4, padding: 12, borderRadius: 10,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)"
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", opacity: .9 }}>Sum Bus</div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: .9 }}>
        <input type="checkbox" checked={limiterOn} onChange={(e)=>setLimiterOn(e.target.checked)} />
        Limiter
      </label>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr", gap: 16, marginTop: 12 }}>
      {/* Meter */}
      <div>
        <div style={{ fontSize: 12, opacity: .7, marginBottom: 6 }}>Peak Meter</div>
        <div style={{ height: 12, background: "rgba(255,255,255,.08)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.max(0, Math.min(1, (sumMeterDb + 60) / 60)) * 100}%`,
            background: sumMeterDb > -1 ? "#b91c1c" : sumMeterDb > -6 ? "#d97706" : "#10b981",
            transition: "width 50ms linear"
          }} />
        </div>
        <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>
          {Number.isFinite(sumMeterDb) ? `${sumMeterDb.toFixed(1)} dBFS` : "—"}
        </div>
      </div>

      {/* Compressor */}
      <div>
        <div style={{ fontSize: 12, opacity: .7, marginBottom: 6 }}>Compressor</div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ display: "grid", gridTemplateColumns: "58px 1fr", alignItems: "center", gap: 8 }}>
            <span style={{ opacity: .75 }}>Thresh</span>
            <input type="range" min={-60} max={0} step={1}
              value={sumComp.threshold}
              onChange={(e)=>setSumComp(s=>({...s, threshold: parseFloat(e.target.value)}))}/>
          </label>
          <label style={{ display: "grid", gridTemplateColumns: "58px 1fr", alignItems: "center", gap: 8 }}>
            <span style={{ opacity: .75 }}>Ratio</span>
            <input type="range" min={1} max={20} step={0.1}
              value={sumComp.ratio}
              onChange={(e)=>setSumComp(s=>({...s, ratio: parseFloat(e.target.value)}))}/>
          </label>
        </div>
      </div>

      {/* Makeup gain */}
      <div>
        <div style={{ fontSize: 12, opacity: .7, marginBottom: 6 }}>Makeup</div>
        <input type="range" min={-24} max={+12} step={0.1}
          value={sumGainDb}
          onChange={(e)=>setSumGainDb(parseFloat(e.target.value))}/>
        <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>
          {sumGainDb >= 0 ? `+${sumGainDb.toFixed(1)} dB` : `${sumGainDb.toFixed(1)} dB`}
        </div>
      </div>
    </div>
  </div>
)}


    {/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

    {/* Transport */}
    <div className="transport">
      {/* Play / Stop (triangle / square) */}
      <button
        onClick={togglePlay}
        className={`btn press playstop ${isPlaying ? "is-playing" : ""}`}
        aria-pressed={isPlaying}
        title={isPlaying ? "Stop" : "Play"}
      >
        <span className="tri" aria-hidden="true"></span>
        <span className="sq" aria-hidden="true"></span>
      </button>

      {/* Record (dot only) */}
      <button
        onClick={toggleRecord}
        className={`btn press rec ${isRecording ? "on" : ""}`}
        aria-pressed={isRecording}
        title="Record"
      >
        <span className="rec-dot" aria-hidden="true"></span>
      </button>

      {/* Digital step display */}
      <div className="lcd">{pad(step + 1)}/{STEPS_PER_BAR}</div>

      {/* Clear selected (Del Pat) */}
      <button
        onClick={clearSelectedPattern}
        className="btn press clear-btn pat"
        title="Clear selected instrument"
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Clear all (Del All) */}
      <button
        onClick={clearAllPatternsAndLevels}
        className="btn press clear-btn all"
        title="Clear all"
      >
        <span className="sym">Del All</span>
      </button>
    </div>

    {/* Step editor: oldschool — row button on left, chevron on right */}
    <div style={{ marginTop: 24, width: "100%", maxWidth: 760 }}>
      {/* Row A */}
      <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 8 }}>
        {/* Header line: A button (left) + chevron (right) */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            className="btn btn-ab"
            onClick={() => toggleRowActiveUI(selected, "A")}
            title={`Row A ${rowActive[selected]?.A ? "On" : "Off"}`}
            aria-pressed={rowActive[selected]?.A}
            style={{
              background: rowActive[selected]?.A ? "#059669" : "#333",
              fontWeight: 800,
            }}
          >
            A
          </button>

          <div style={{ flex: 1 }} />

          <button
            className={`btn btn-ab-chevron ${rowExpanded[selected]?.A ? "open" : ""}`}
            onClick={() => toggleRowExpanded(selected, "A")}
            aria-expanded={rowExpanded[selected]?.A}
            title={rowExpanded[selected]?.A ? "Collapse (1×16)" : "Expand (2×8 large)"}
          >
            ▾
          </button>
        </div>

        {/* Steps: 1×16 or 2×8 (larger) */}
        <div
          className="row-steps"
          style={{
            display: "grid",
            gridTemplateColumns: rowExpanded[selected]?.A ? "repeat(8, 1fr)" : "repeat(16, 1fr)",
            gap: rowExpanded[selected]?.A ? 10 : 8,
            alignItems: "center",
          }}
        >
          {patterns[selected].A.map((v, i) => {
            const isActive = v > 0;
            const accent = i === step && (uiLatchedRow[selected] || "A") === "A";
            const fill = isActive
              ? `rgba(52, 211, 153, ${0.35 + 0.65 * Math.max(0, Math.min(1, v))})`
              : "rgba(255,255,255,.15)";
            return (
              <button
                key={`A-${i}`}
                onClick={() => cycleStepRow("A", i)}
                title={`Row A • Step ${i + 1}`}
                style={{
                  height: rowExpanded[selected]?.A ? 44 : 20,
                  width: "100%",
                  borderRadius: rowExpanded[selected]?.A ? 6 : 3,
                  background: fill,
                  outline: accent ? "2px solid #34d399" : "none",
                  border: "1px solid rgba(255,255,255,.12)",
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Row B */}
      <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 8, marginTop: 14 }}>
        {/* Header line: B button (left) + chevron (right) */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            className="btn btn-ab"
            onClick={() => toggleRowActiveUI(selected, "B")}
            title={`Row B ${rowActive[selected]?.B ? "On" : "Off"}`}
            aria-pressed={rowActive[selected]?.B}
            style={{
              background: rowActive[selected]?.B ? "#059669" : "#333",
              fontWeight: 800,
            }}
          >
            B
          </button>

          <div style={{ flex: 1 }} />

          <button
            className={`btn btn-ab-chevron ${rowExpanded[selected]?.B ? "open" : ""}`}
            onClick={() => toggleRowExpanded(selected, "B")}
            aria-expanded={rowExpanded[selected]?.B}
            title={rowExpanded[selected]?.B ? "Collapse (1×16)" : "Expand (2×8 large)"}
          >
            ▾
          </button>
        </div>

        {/* Steps */}
        <div
          className="row-steps"
          style={{
            display: "grid",
            gridTemplateColumns: rowExpanded[selected]?.B ? "repeat(8, 1fr)" : "repeat(16, 1fr)",
            gap: rowExpanded[selected]?.B ? 10 : 8,
            alignItems: "center",
          }}
        >
          {patterns[selected].B.map((v, i) => {
            const isActive = v > 0;
            const accent = i === step && (uiLatchedRow[selected] || "A") === "B";
            const fill = isActive
              ? `rgba(52, 211, 153, ${0.35 + 0.65 * Math.max(0, Math.min(1, v))})`
              : "rgba(255,255,255,.15)";
            return (
              <button
                key={`B-${i}`}
                onClick={() => cycleStepRow("B", i)}
                title={`Row B • Step ${i + 1}`}
                style={{
                  height: rowExpanded[selected]?.B ? 44 : 20,
                  width: "100%",
                  borderRadius: rowExpanded[selected]?.B ? 6 : 3,
                  background: fill,
                  outline: accent ? "2px solid #34d399" : "none",
                  border: "1px solid rgba(255,255,255,.12)",
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  </div>
);
}

