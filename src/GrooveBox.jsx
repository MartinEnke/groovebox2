// src/GrooveBox.jsx

import React, { useEffect, useRef, useState } from "react";


// ===== Utility helpers =====
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

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

// 2x2 velocity matrix – tweak to taste
const VELS = [
  [1.00, 0.6],
  [0.75, 0.45],
];

// Click-step cycle (loud → soft → off)
const VELOCITY_CYCLE = [0, 0.45, 0.6, 0.75, 1.0];

// Sequencer constants
const PPQ = 4; // 4 steps per beat (16 steps per bar)
const STEPS_PER_BAR = 16;
const LOOKAHEAD_MS = 25;             // scheduler check interval
const SCHEDULE_AHEAD_TIME = 0.1;     // seconds to schedule into the future

export default function GrooveBox() {
  // ===== Audio graph refs =====
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const buffersRef = useRef(new Map()); // id -> AudioBuffer
  const muteGainsRef = useRef(new Map()); // id -> GainNode
  const metClickRef = useRef({ hi: null, lo: null });

  // Sequencer state
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [step, setStep] = useState(0); // UI indicator only

  // Selected instrument & mutes
  const [selected, setSelected] = useState(INSTRUMENTS[0].id);
  const [mutes, setMutes] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, false]))
  );

  // Patterns: instrument -> Array(16) of velocities (0 = off)
  const [patterns, setPatterns] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, new Array(STEPS_PER_BAR).fill(0)]))
  );

  // Scheduler internals
  const nextNoteTimeRef = useRef(0); // time (s) of next step
  const currentStepRef = useRef(0);
  const timerIdRef = useRef(null);

  // Skip-once map: keys like "kick-3" mean "ignore this step one time"
  const recentWritesRef = useRef(new Map());

  // Start-of-loop (bar) reference in AudioContext time
  const loopStartRef = useRef(0);

  // ===== Mirrors of state in refs to keep scheduler stable =====
  const patternsRef = useRef(patterns);
  const mutesRef = useRef(mutes);
  const metronomeOnRef = useRef(metronomeOn);

  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  useEffect(() => { metronomeOnRef.current = metronomeOn; }, [metronomeOn]);

  // ===== Init Audio =====
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // per-instrument mute gain nodes
    INSTRUMENTS.forEach((inst) => {
      const g = ctx.createGain();
      g.gain.value = 1.0;
      g.connect(master);
      muteGainsRef.current.set(inst.id, g);
    });

    // metronome click buffers (tiny bleeps)
    metClickRef.current.hi = createClickBuffer(ctx, 2000, 0.002);
    metClickRef.current.lo = createClickBuffer(ctx, 1200, 0.002);

    // unlock on first user gesture (iOS)
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
  }, []);

  // ===== Scheduling (decoupled from patterns/mutes/metronome state) =====
  useEffect(() => {
    if (!isPlaying || !audioCtxRef.current) return;

    // Set loopStart to the beginning of the current bar based on where we start
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;
    const startIdx = currentStepRef.current % STEPS_PER_BAR;
    loopStartRef.current = audioCtxRef.current.currentTime - startIdx * secondsPerStep;

    // don't restart on every patterns/mutes/metronome change; only when play or bpm changes
    nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;

    timerIdRef.current = setInterval(() => {
      schedule();
    }, LOOKAHEAD_MS);

    return () => clearInterval(timerIdRef.current);
  }, [isPlaying, bpm]); // keep metronome solid

  function schedule() {
    const ctx = audioCtxRef.current;
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
      const stepIndex = currentStepRef.current % STEPS_PER_BAR;

      // metronome (read from ref so toggling doesn't restart scheduler)
      if (metronomeOnRef.current) {
        const click = stepIndex % 4 === 0 ? metClickRef.current.hi : metClickRef.current.lo;
        playBuffer(click, 0.15, nextNoteTimeRef.current);
      }

      // notes per instrument (read patterns/mutes from refs)
      INSTRUMENTS.forEach((inst) => {
        const vel = (patternsRef.current?.[inst.id]?.[stepIndex]) || 0;
        if (vel > 0 && !mutesRef.current?.[inst.id]) {
          const key = `${inst.id}-${stepIndex}`;
          if (recentWritesRef.current.has(key)) {
            // Skip this pass once, then allow future playbacks
            recentWritesRef.current.delete(key);
          } else {
            const buf = buffersRef.current.get(inst.id);
            if (buf) playSample(inst.id, vel, nextNoteTimeRef.current);
          }
        }
      });

      // advance to next 16th note
      nextNoteTimeRef.current += secondsPerStep;
      currentStepRef.current = (currentStepRef.current + 1) % STEPS_PER_BAR;

      // update UI step (safe; doesn't affect scheduler stability)
      setStep((s) => (s + 1) % STEPS_PER_BAR);
    }
  }

  // ===== Compute precise step from AudioContext time (for recording) =====
  function getRecordingStepIndex() {
    const ctx = audioCtxRef.current;
    if (!ctx) return currentStepRef.current % STEPS_PER_BAR;

    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;
    const barDur = secondsPerStep * STEPS_PER_BAR;

    const now = ctx.currentTime;
    const elapsed = now - loopStartRef.current;

    // Guard against negative / startup jitter
    const safeElapsed = elapsed < 0 ? 0 : elapsed;

    // Steps from loop start; +epsilon to avoid floating point flicker at boundaries
    const steps = safeElapsed / secondsPerStep + 1e-6;
    const idx = Math.floor(steps % STEPS_PER_BAR);

    // Optional: if you want to shift forward when very close to a boundary:
    // const frac = steps - Math.floor(steps);
    // if (frac > 0.98) return (idx + 1) % STEPS_PER_BAR;

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
        // reset to the start of the bar
        currentStepRef.current = 0;
        setStep(0);
        // loopStartRef + nextNoteTimeRef are set in the effect below
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
      if (g) g.gain.value = next[instId] ? 0 : 1;
      return next;
    });
  }

  function selectInstrument(instId) {
    setSelected(instId);
  }

  function onPadPress(row, col) {
    const vel = VELS[row][col];
  
    // Always monitor immediately
    if (!mutes[selected]) {
      playSample(selected, vel, 0);
    }
  
    if (isRecording && isPlaying) {
      const idx = getRecordingStepIndex(); // uses AudioContext clock
  
      // Write now so UI updates immediately
      setPatterns((prev) => {
        const next = { ...prev, [selected]: [...prev[selected]] };
        next[selected][idx] = vel;
        return next;
      });
  
      // --- Only skip if this step is still ahead in THIS bar ---
      const ctx = audioCtxRef.current;
      const secondsPerBeat = 60.0 / bpm;
      const secondsPerStep = secondsPerBeat / PPQ;
      const now = ctx.currentTime;
      const tStepThisBar = loopStartRef.current + idx * secondsPerStep;
  
      const key = `${selected}-${idx}`;
      if (tStepThisBar > now + 1e-4) {
        // Step is in the future of the current bar → skip this upcoming pass only
        recentWritesRef.current.set(key, true);
      } else {
        // We've already passed this step in the current bar → next playback is next bar, don't skip
        // (also clear any stale token so we don’t accidentally skip next bar)
        recentWritesRef.current.delete(key);
      }
    }
  }
  
  function cycleStep(stepIdx) {
    setPatterns((prev) => {
      const curr = prev[selected][stepIdx] || 0;
  
      // find current index in cycle (with float tolerance)
      const i = VELOCITY_CYCLE.findIndex(v => Math.abs(v - curr) < 1e-6);
      const nextIdx = (i >= 0 ? i + 1 : 1) % VELOCITY_CYCLE.length; // default to first loud on empty
      const nextVel = VELOCITY_CYCLE[nextIdx];
  
      const next = { ...prev, [selected]: [...prev[selected]] };
      next[selected][stepIdx] = nextVel;
  
      // Audition immediately if now active and not muted
      if (nextVel > 0 && !mutes[selected]) {
        playSample(selected, nextVel, 0);
      }
  
      return next;
    });
  }

  // ===== Render =====
  return (
    <div style={{ color: "white" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: 0.4 }}>DRUMS</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
            <span>Metronome</span>
            <input
              type="checkbox"
              checked={metronomeOn}
              onChange={(e) => setMetronomeOn(e.target.checked)}
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>BPM</span>
            <input
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

      {/* Pads Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 480 }}>
        {[0, 1].map((r) => (
          <div key={`row-${r}`} style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 16 }}>
            {[0, 1].map((c) => (
              <PadButton
                key={`pad-${r}-${c}`}
                label={`PAD`}
                sub={`vel ${VELS[r][c].toFixed(2)}`}
                onPress={() => onPadPress(r, c)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Transport */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
        <button onClick={togglePlay} className="btn">{isPlaying ? "Stop" : "Play"}</button>
        <button onClick={toggleRecord} className="btn">{isRecording ? "Recording…" : "Record"}</button>
        <div style={{ marginLeft: 8, opacity: 0.8, fontSize: 14 }}>
          Step: {pad(step + 1)}/{STEPS_PER_BAR}
        </div>
        <button
          onClick={() => {
            setPatterns(
              Object.fromEntries(INSTRUMENTS.map((i) => [i.id, new Array(STEPS_PER_BAR).fill(0)]))
            );
            recentWritesRef.current.clear();
          }}
          className="btn"
        >
          Clear Pattern
        </button>
      </div>

      {/* Mini step LEDs preview for selected instrument */}
      {/* Step editor for selected instrument */}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24, maxWidth: 640 }}>
    {patterns[selected].map((v, i) => {
        const isActive = v > 0;
        const accent = i === step;
        const fill = isActive
        ? `rgba(52, 211, 153, ${0.35 + 0.65 * Math.max(0, Math.min(1, v))})` // brighter by velocity
        : "rgba(255,255,255,.15)";
        return (
        <button
            key={`st-${i}`}
            onClick={() => cycleStep(i)}
            title={`Step ${i + 1}: ${v.toFixed ? v.toFixed(2) : v} — click to cycle`}
            style={{
            height: 20,
            width: 20,
            borderRadius: 3,
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


      {/* Minimal CSS for .btn */}
      <style>{`
        .btn {
          padding: 8px 12px;
          border-radius: 12px;
          background: #444;
          color: white;
          border: 1px solid rgba(255,255,255,.1);
          box-shadow: 0 1px 2px rgba(0,0,0,.3);
          cursor: pointer;
          transition: transform .05s ease, background .15s ease;
        }
        .btn:hover { background: #555; }
        .btn:active { transform: scale(0.98); }
      `}</style>
    </div>
  );

  // ===== sub components =====
  function renderInstrumentButton(inst) {
    const isSel = selected === inst.id;
    return (
      <button
        key={inst.id}
        onClick={() => selectInstrument(inst.id)}
        className="btn"
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
        {muted ? "Muted" : "Mute"}
      </button>
    );
  }
}

function PadButton({ label, sub, onPress }) {
  return (
    <button
      onPointerDown={onPress}
      onTouchStart={(e) => { e.preventDefault(); onPress(); }}
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