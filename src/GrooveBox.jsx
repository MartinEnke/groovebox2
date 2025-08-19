// src/GrooveBox.jsx
import React, { useEffect, useRef, useState } from "react";




  
// ===== Utility helpers =====
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const dbToGain = (db) => Math.pow(10, db / 20);

// ===== Instruments (2 x 5) =====
const INSTRUMENTS = [
  { id: "kick", label: "BD", url: "/samples/BD.wav" },
  { id: "snare", label: "SD", url: "/samples/SD.wav" },
  { id: "clap", label: "CLAP", url: "/samples/CLAP.wav" },
  { id: "tom1", label: "TOM1", url: "/samples/TOM1.wav" },
  { id: "tom2", label: "TOM2", url: "/samples/TOM2.wav" },
  { id: "rim", label: "RIM", url: "/samples/RIM.wav" },
  { id: "tam", label: "TAM", url: "/samples/TAM.wav" },
  { id: "hihat", label: "HH", url: "/samples/HH.wav" },
  { id: "openhihat", label: "OHH", url: "/samples/OHH.wav" },
  { id: "ride", label: "RIDE", url: "/samples/RIDE.wav" },
];

// Pads velocity matrix
const VELS = [
  [1.0, 0.6],
  [0.75, 0.45],
];

// Click-step cycle
const STEP_CYCLE_ORDER = [0.45, 0.6, 0.75, 1.0, 0];


// Sequencer constants
const PPQ = 4; // 4 steps per beat (16 steps per bar)
const STEPS_PER_BAR = 16;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_TIME = 0.1;





export default function GrooveBox() {
  // ===== Audio graph refs =====
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const buffersRef = useRef(new Map()); // id -> AudioBuffer
  const muteGainsRef = useRef(new Map()); // id -> GainNode
  const metClickRef = useRef({ hi: null, lo: null });

  // FX wet % per instrument (0..100)
const [instDelayWet, setInstDelayWet] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]))
  );
  const [instReverbWet, setInstReverbWet] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]))
  );

  // Global reverb length mode: 'S' (4 steps), 'M' (8), 'L' (16)
const [revLenMode, setRevLenMode] = useState('M');

  // ===== FX buses & per-instrument sends =====
const delayInRef = useRef(null);
const delayNodeRef = useRef(null);
const delayFbRef = useRef(null);
const delayFilterRef = useRef(null);
const delayWetGainRef = useRef(null);

const reverbConvolverRef = useRef(null);
const reverbWetGainRef = useRef(null);

// per-instrument send gains (post-fader, post-mute)
const delaySendGainsRef = useRef(new Map());   // instId -> GainNode
const reverbSendGainsRef = useRef(new Map());  // instId -> GainNode


  // Sequencer state
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [step, setStep] = useState(0); // UI indicator only


  // Metronome mode: "beats" (4), "all" (16), "off"
const [metMode, setMetMode] = useState("beats");
const metModeRef = useRef(metMode);
useEffect(() => { metModeRef.current = metMode; }, [metMode]);

function cycleMetronomeMode() {
  setMetMode(prev => (prev === "beats" ? "all" : prev === "all" ? "off" : "beats"));
}


  // Which row (A/B) is active *for UI* this bar
const [uiLatchedRow, setUiLatchedRow] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, "A"]))
  );


  // per-instrument per-row unfold state (false = 1x16, true = 2x8 large)
const [rowExpanded, setRowExpanded] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, { A: false, B: false }]))
  );
  
  function toggleRowExpanded(instId, row) {
    setRowExpanded(prev => ({
      ...prev,
      [instId]: { ...prev[instId], [row]: !prev[instId][row] },
    }));
  }


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
  
    // Master
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    masterGainRef.current = master;
  
    // Per-instrument post nodes (mute + volume)
    INSTRUMENTS.forEach((inst) => {
      const g = ctx.createGain();
      g.gain.value = dbToGain(instGainsDb[inst.id] ?? 0);
      g.connect(master);
      muteGainsRef.current.set(inst.id, g);
    });
  
    // ===== FX Buses (shared) =====
    // Delay bus (tempo-synced)
    const delayIn = ctx.createGain();            delayIn.gain.value = 1.0;
    const delay = ctx.createDelay(2.0);          // max 2s
    const fb    = ctx.createGain();              fb.gain.value    = 0.35;     // feedback
    const dlp   = ctx.createBiquadFilter();      dlp.type = "lowpass"; dlp.frequency.value = 5000;
    const dWet  = ctx.createGain();              dWet.gain.value  = 1.0;      // bus wet level
  
    delayIn.connect(delay);
    delay.connect(dlp);
    dlp.connect(dWet);
    dWet.connect(master);
    delay.connect(fb);
    fb.connect(delay);
  
    // initial tempo sync (1/8 note)
    const spbInit = 60 / bpm;                    // bpm from state
    delay.delayTime.value = 0.5 * spbInit;
  
    // Reverb bus (simple synthesized IR)
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulseResponse(ctx, 2.4, 2.2);  // (duration, decay)
    const rWet = ctx.createGain();              rWet.gain.value = 1.0;
    convolver.connect(rWet);
    rWet.connect(master);
  
    // Save bus refs
    delayInRef.current       = delayIn;
    delayNodeRef.current     = delay;
    delayFbRef.current       = fb;
    delayFilterRef.current   = dlp;
    delayWetGainRef.current  = dWet;
    reverbConvolverRef.current = convolver;
    reverbWetGainRef.current   = rWet;
  
    // ===== Per-instrument sends (tap AFTER post gain; sends follow mutes & faders) =====
    INSTRUMENTS.forEach((inst) => {
      const postNode = muteGainsRef.current.get(inst.id);
      const dSend = ctx.createGain();
      dSend.gain.value = (instDelayWet[inst.id] ?? 0) / 100;
      const rSend = ctx.createGain();
      rSend.gain.value = (instReverbWet[inst.id] ?? 0) / 100;
  
      postNode.connect(dSend);
      postNode.connect(rSend);
  
      dSend.connect(delayIn);
      rSend.connect(convolver);
  
      delaySendGainsRef.current.set(inst.id, dSend);
      reverbSendGainsRef.current.set(inst.id, rSend);
    });
  
    
    // Metronome click buffers
    metClickRef.current.hi = createClickBuffer(ctx, 2000, 0.002);
    metClickRef.current.lo = createClickBuffer(ctx, 1200, 0.002);
  
    // Unlock on first user gesture (iOS)
    const resume = () => ctx.resume();
    window.addEventListener("pointerdown", resume, { once: true });
  
    // Load samples
    (async () => {
      await Promise.all(
        INSTRUMENTS.map(async (inst) => {
          const buf = await fetchAndDecode(ctx, inst.url).catch(() => null);
          if (buf) buffersRef.current.set(inst.id, buf);
        })
      );
    })();
  
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
      // Turning SOLO off → unmute everything
      const allUnmuted = Object.fromEntries(INSTRUMENTS.map(i => [i.id, false]));
      applyMutes(allUnmuted);          // updates state + GainNodes
      setSoloActive(false);
      prevMutesRef.current = null;     // optional: we no longer restore previous mutes
    } else {
      // Turning SOLO on → mute all others, leave selected on
      const soloMap = Object.fromEntries(INSTRUMENTS.map(i => [i.id, i.id !== selected]));
      applyMutes(soloMap);
      setSoloActive(true);
    }
  }

  useEffect(() => {
    if (!soloActive) return;
    const soloMap = Object.fromEntries(
      INSTRUMENTS.map((i) => [i.id, i.id !== selected])
    );
    applyMutes(soloMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, soloActive]);


  // ===== Keep delay time locked to BPM =====
useEffect(() => {
    const ctx = audioCtxRef.current;
    const d = delayNodeRef.current;
    if (!ctx || !d) return;
    const spb = 60 / bpm;
    const target = 0.5 * spb; // 1/8 note
    d.delayTime.cancelScheduledValues(ctx.currentTime);
    d.delayTime.linearRampToValueAtTime(target, ctx.currentTime + 0.01);
  }, [bpm]);


  // ===== Keep reverb tail length locked to BPM & mode =====
useEffect(() => {
    const ctx = audioCtxRef.current;
    const convolver = reverbConvolverRef.current;
    if (!ctx || !convolver) return;
  
    // each step = 1/16 note (PPQ=4 → 4 steps per beat)
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;
  
    const steps =
      revLenMode === 'S' ? 4  :   // 1 beat (quarter note)
      revLenMode === 'M' ? 8  :   // 2 beats (half note)
                              16; // 4 beats (1 bar)
  
    const duration = Math.max(0.2, steps * secondsPerStep); // seconds
    const decay =
      revLenMode === 'S' ? 1.8 :
      revLenMode === 'M' ? 2.2 : 2.8;
  
    // (re)build IR for this BPM/mode
    convolver.buffer = makeImpulseResponse(ctx, duration, decay);
  }, [bpm, revLenMode]);

  
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

  
      // 3) Schedule notes for this exact step
      INSTRUMENTS.forEach((inst) => {
        const row = latchedRowRef.current[inst.id] || "A";
        const patt = patternsRef.current?.[inst.id]?.[row];
        const vel = (patt?.[stepIndex]) || 0;
  
        if (vel > 0 && !mutesRef.current?.[inst.id]) {
          const key = `${inst.id}-${row}-${stepIndex}`;
          if (recentWritesRef.current.has(key)) {
            recentWritesRef.current.delete(key);
          } else {
            const buf = buffersRef.current.get(inst.id);
            const when =
              nextNoteTimeRef.current + getSwingOffsetSec(inst.id, stepIndex, secondsPerBeat);
            if (buf) playSample(inst.id, vel, when);
          }
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
    const ctx = audioCtxRef.current;
    const buf = buffersRef.current.get(instId);
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = clamp(velocity, 0, 1);
    src.connect(g).connect(muteGainsRef.current.get(instId));
    src.start(when > 0 ? when : 0);
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
    if (!mutes[selected]) playSample(selected, vel, 0);

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
  return (
    <div style={{ color: "white" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: 0.4 }}>DR7</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
            
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

          </label>
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

      {/* Instruments grid 2 x 5 with mutes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {INSTRUMENTS.slice(0, 5).map(renderInstrumentButton)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 8 }}>
        {INSTRUMENTS.slice(0, 5).map(renderMuteButton)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 16 }}>
        {INSTRUMENTS.slice(5, 10).map(renderInstrumentButton)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 8 }}>
        {INSTRUMENTS.slice(5, 10).map(renderMuteButton)}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

      {/* Pads + Volume Fader */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 88px",
          gap: 16,
          alignItems: "center",
          maxWidth: 560,
          marginTop: 16,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* 2x2 Pads */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 16,
            justifyItems: "center",
            alignItems: "center",
          }}
        >
          {[0, 1].map((r) =>
            [0, 1].map((c) => (
              <PadButton
                key={`pad-${r}-${c}`}
                label="PAD"
                sub={`vel ${VELS[r][c].toFixed(2)}`}
                onPress={() => onPadPress(r, c)}
              />
            ))
          )}
        </div>

        {/* Fader column */}
        <div className="vfader-wrap">
          <div className="vfader-title">
            {INSTRUMENTS.find((i) => i.id === selected)?.label ?? selected}
          </div>

          <div className="vfader-slot">
            <input
              className="vfader"
              type="range"
              min={-24}
              max={+6}
              step={0.1}
              value={instGainsDb[selected]}
              onChange={(e) => {
                const db = parseFloat(e.target.value);
                setInstGainsDb((prev) => ({ ...prev, [selected]: db }));
                const g = muteGainsRef.current.get(selected);
                if (g) g.gain.value = mutes[selected] ? 0 : dbToGain(db);
              }}
              title="Volume (selected instrument)"
            />
          </div>

          <div className="vfader-readout">
            {instGainsDb[selected] >= 0
              ? `+${instGainsDb[selected].toFixed(1)} dB`
              : `${instGainsDb[selected].toFixed(1)} dB`}
          </div>

          <button
  className={`btn solo-btn ${soloActive ? "solo-on" : ""}`}
  onClick={toggleSolo}
  aria-pressed={soloActive}
  title="Solo selected instrument (mute others)"
  style={{ width: "100%" }}
>
  Solo
</button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />


      {/* FX (Delay & Reverb) for selected instrument */}
<div className="fx-row" style={{ marginTop: 16 }}>
  <div className="fx-block">
    <div className="fx-label">DLY</div>
    <input
      className="slider slider-fx"
      type="range"
      min={0}
      max={100}
      step={1}
      value={instDelayWet[selected]}
      onChange={(e) => {
        const pct = parseInt(e.target.value, 10);
        setInstDelayWet(prev => ({ ...prev, [selected]: pct }));
        const g = delaySendGainsRef.current.get(selected);
        if (g) g.gain.value = pct / 100;
      }}
      title="Delay wet (%)"
    />
  </div>

  <div className="fx-block">
    <div className="fx-label">REV</div>
    <input
      className="slider slider-fx"
      type="range"
      min={0}
      max={100}
      step={1}
      value={instReverbWet[selected]}
      onChange={(e) => {
        const pct = parseInt(e.target.value, 10);
        setInstReverbWet(prev => ({ ...prev, [selected]: pct }));
        const g = reverbSendGainsRef.current.get(selected);
        if (g) g.gain.value = pct / 100;
      }}
      title="Reverb wet (%)"
    />
  </div>
</div>

<div className="revlen-wrap">
  {['S','M','L'].map((m) => (
    <button
      key={m}
      type="button"
      className={`revlen-btn ${revLenMode === m ? 'on' : ''}`}
      onClick={() => setRevLenMode(m)}
      title={
        m === 'S' ? 'Short (4 steps)' :
        m === 'M' ? 'Medium (8 steps)' :
                    'Long (16 steps)'
      }
    >
      {m}
    </button>
  ))}
</div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />


      {/* SWING — full width */}
<div style={{ marginTop: 16, width: "100%" }}>
  <div className="swing-row">
    {/* 2×2 compact buttons: Off / 8 / 16 / 32 */}
    <div className="swing-grid-2x2">
      {[
        { val: "none", label: "Off" },
        { val: "8",    label: "8"   },
        { val: "16",   label: "16"  },
        { val: "32",   label: "32"  },
      ].map(opt => {
        const active = instSwingType[selected] === opt.val;
        return (
          <button
            key={opt.val}
            type="button"
            className={`sg2-btn ${active ? "on" : "off"}`}
            aria-pressed={active}
            onClick={() =>
              setInstSwingType(prev => ({ ...prev, [selected]: opt.val }))
            }
            title={`Swing grid: ${opt.label}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>

    {/* per-instrument swing */}
    <div className="swing-block">
      <input
        className="slider slider-swing"
        type="range"
        min={0}
        max={100}
        step={1}
        value={instSwingType[selected] === "none" ? 0 : instSwingAmt[selected]}
        onChange={(e) =>
          setInstSwingAmt(prev => ({ ...prev, [selected]: parseInt(e.target.value, 10) }))
        }
        disabled={instSwingType[selected] === "none"}
        title="Swing amount (%)"
      />
      {/* per-instrument swing readout */}
<div className="swing-lcd">
  <span className="lcd-label">SWING&nbsp;&nbsp;</span>
  <span className="lcd-value">
    {instSwingType[selected] === "none" ? 0 : instSwingAmt[selected]}%
  </span>
</div>

    </div>

    {/* global swing scaler */}
    <div className="swing-global">
      <input
        className="slider slider-global"
        type="range"
        min={0}
        max={150}
        step={1}
        value={globalSwingPct}
        onChange={(e) => setGlobalSwingPct(parseInt(e.target.value, 10))}
        title={`Global swing: ${globalSwingPct}%`}
      />
      <div className="swing-lcd swing-lcd--global">
  <span className="lcd-label">GLOBAL&nbsp;&nbsp;</span>
  <span className="lcd-value">{globalSwingPct}%</span>
</div>
    </div>
  </div>
</div>





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

  // ===== sub components =====
  function renderInstrumentButton(inst) {
    const isSel = selected === inst.id;
    return (
      <button
        key={inst.id}
        onClick={() => selectInstrument(inst.id)}
        className="btn inst-btn"                // ← add inst-btn here
        title={`Select ${inst.label}`}
        style={{ background: isSel ? "#059669" : "#333" }}
      >
        <div style={{ fontWeight: 600 }}>{inst.label}</div>
      </button>
    );
  }
  

  function renderMuteButton(inst) {
    const muted = mutes[inst.id];
    return (
      <button
        key={`${inst.id}-mute`}
        onClick={() => toggleMute(inst.id)}
        className="btn"
        title={`Mute ${inst.label}`}
        style={{ background: muted ? "#b91c1c" : "#444" }}
      >
        {muted ? "Mute" : "Mute"}
      </button>
    );
  }
}

function PadButton({ label, sub, onPress }) {
  return (
    <button
      onPointerDown={onPress}
      onTouchStart={(e) => {
        e.preventDefault();
        onPress();
      }}
      style={{
        height: 144,
        width: 144,
        borderRadius: 16,
        background: "#2a2a2a",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{sub}</span>
      </div>
    </button>
  );
}

// ===== Audio utils =====
async function fetchAndDecode(ctx, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const arr = await res.arrayBuffer();
  return await ctx.decodeAudioData(arr);
}

function createClickBuffer(ctx, freq = 2000, dur = 0.003) {
  const length = Math.max(1, Math.floor(dur * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 50);
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
  }
  return buffer;
}

function makeImpulseResponse(ctx, duration = 2.5, decay = 2.5) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(duration * rate));
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        data[i] = (Math.random() * 2 - 1) * env; // noise tail with decay
        // tiny early reflections
        if (i > 200 && i < 1200) data[i] += 0.003 * (Math.random() * 2 - 1);
      }
    }
    return impulse;
  }