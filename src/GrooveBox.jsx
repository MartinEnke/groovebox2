// src/GrooveBox.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import SoundGate from "./components/SoundGate";


import { SAMPLE_PACKS, PACK_IDS } from "./constants/packs";
import { INSTRUMENTS, CHOKE_GROUPS } from "./constants/instruments";
import { VELS, STEP_CYCLE_ORDER, PPQ, STEPS_PER_BAR, LOOKAHEAD_MS, SCHEDULE_AHEAD_TIME } from "./constants/sequencer";
import { SESSIONS_KEY, CURRENT_SESSION_KEY, SESSION_VERSION, SESSION_KEY } from "./constants/session";

import { pad, coerce16, deepClone } from "./utils/misc";

import { InstrumentGrid } from "./components/InstrumentGrid";
import Channel from "./components/Channel";
import SidechainPanel from "./components/panels/SidechainPanel";
import FXPanel from "./components/panels/FXPanel";   
import SwingPanel from "./components/panels/SwingPanel";
import SumBusPanel from "./components/panels/SumBusPanel";
import TransportBar from "./components/TransportBar";
import StepEditor from "./components/StepEditor";

import PackBar from "./components/header/PackBar";
import SessionBar from "./components/header/SessionBar";

import { useSessionStore } from "./state/useSessionStore";

import useAudioEngine from "./engine/useAudioEngine";

import useSessions from "./session/useSessions";



import useDisableZoomKeepScroll from "./hooks/useDisableZoomKeepScroll";
import useNoHorizontalWheel from "./hooks/useNoHorizontalWheel";



function LogoResetHotspot({ targetRef, active, onReset }) {
  const portalRef = React.useRef(null);
  

  React.useLayoutEffect(() => {
    if (!active || !targetRef.current) {
      if (portalRef.current) { portalRef.current.remove(); portalRef.current = null; }
      return;
    }

    const box = document.createElement("div");
    portalRef.current = box;
    document.body.appendChild(box);

    const styleBase = {
      position: "fixed",
      zIndex: "2147483647",      // above everything
      pointerEvents: "auto",
      background: "transparent",
      cursor: "pointer",
    };

    const place = () => {
      const r = targetRef.current?.getBoundingClientRect();
      if (!r) return;
      Object.assign(box.style, styleBase, {
        left: r.left + "px",
        top: r.top + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
    };

    const onDown = (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      onReset();
    };

    place();
    box.addEventListener("pointerdown", onDown, { capture: true, passive: false });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);

    const ro = new ResizeObserver(place);
    ro.observe(document.documentElement);
    if (targetRef.current) ro.observe(targetRef.current);

    return () => {
      try { box.removeEventListener("pointerdown", onDown, { capture: true }); } catch {}
      try { window.removeEventListener("resize", place); } catch {}
      try { window.removeEventListener("scroll", place, true); } catch {}
      try { ro.disconnect(); } catch {}
      try { box.remove(); } catch {}
      portalRef.current = null;
    };
  }, [active, targetRef, onReset]);

  return null;
}



export default function GrooveBox() {

  useDisableZoomKeepScroll();
  useNoHorizontalWheel();
  
  // Visual scheme (retro = original look, neo = modern)
  const [scheme, setScheme] = useState(() => {
      try {
        const saved = localStorage.getItem("gb-scheme");
        return (saved === "neo" || saved === "retro") ? saved : "neo"; // default = NEO
      } catch {
        return "neo";
      }
    });
    // Apply scheme BEFORE paint so it never lags behind during playback
    useLayoutEffect(() => {
      const root = document.documentElement;
      if (root.getAttribute("data-scheme") !== scheme) {
        root.setAttribute("data-scheme", scheme);
      }
      try { localStorage.setItem("gb-scheme", scheme); } catch {}
    }, [scheme]);

  
  // --- central store ---
  const { state, actions } = useSessionStore();


  const bpm         = state.transport.bpm;
  const isPlaying   = state.transport.isPlaying;
  const isRecording = state.transport.isRecording;
  const step        = state.transport.step;
  const metMode     = state.transport.metMode;

  const selected    = state.instrumentMix.selected;

  // --- audio engine (WebAudio graph) ---
  const engine = useAudioEngine();


// put near your other refs
const logoRef = useRef(null);

// strongest reload that mimics ⌘⇧R without touching sessions/scheme
const reloadLikeShiftCmdR = React.useCallback(() => {
  try { engine.getCtx()?.suspend(); } catch {}
  try { if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; } } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString()); // cache-bust like a hard refresh
  // no RAF — do it *now*, while we're still in the trusted input event
  window.location.replace(url.toString());
}, [engine]);

// attach a *native* capture listener so it wins even while playing
useEffect(() => {
  const el = logoRef.current;
  if (!el) return;

  const handler = (e) => {
    // grab it before React / other handlers
    e.preventDefault();
    e.stopPropagation();
    reloadLikeShiftCmdR();
  };

  // capture phase + non-passive so preventDefault works
  el.addEventListener("pointerdown", handler, { capture: true });
  return () => el.removeEventListener("pointerdown", handler, { capture: true });
}, [reloadLikeShiftCmdR]);


  useEffect(() => {
    if (engine.getCtx()) {
      applyAllFxSends();
      return;
    }
    // poll briefly until the engine is ready, then apply once
    let id = setInterval(() => {
      if (engine.getCtx()) {
        clearInterval(id);
        applyAllFxSends();
      }
    }, 50);
    return () => clearInterval(id);
  }, [engine]);

  // ===== Sample-packs =====
  const [selectedPack, setSelectedPack] = useState(PACK_IDS[0]);
  const [packLoading, setPackLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPackLoading(true);
      try {
        await engine.selectPack(selectedPack, SAMPLE_PACKS);
        if (!cancelled && engine.getCtx()) {
          applyAllFxSends();            // ← ensure returns reflect current sliders
        }
      } finally {
        if (!cancelled) setPackLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [engine, selectedPack]);

  // ===== Folds (UI sections) =====
  const [showPads,    setShowPads]    = useState(true);
  const [showSC,      setShowSC]      = useState(false);
  const [showFX,      setShowFX]      = useState(false);
  const [showSwingUI, setShowSwingUI] = useState(false);
  const [showSum,     setShowSum]     = useState(false);

  // ===== FX (state only; nodes updated via engine helpers) =====
  const [instDelayWet, setInstDelayWet] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );
  const [instDelayMode, setInstDelayMode] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "N8"]))
  );

  const [instReverbWet, setInstReverbWet] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );
  const [instRevMode, setInstRevMode] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "M"]))
  );


  const [instSatWet, setInstSatWet] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]))
  );
  const [instSatMode, setInstSatMode] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, "tape"]))
  );


  function updateSat(instId, pctOverride) {
    const pct  = pctOverride ?? instSatWet[instId] ?? 0;
    const mode = instSatMode[instId] ?? "tape";
    engine.setSaturationWet(instId, pct, mode);
  }
  useEffect(() => {
    INSTRUMENTS.forEach(i => updateSat(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instSatWet, instSatMode]);

  // keep engine sends in sync when mode/wet changes
  function updateDelaySends(instId, pctOverride) {
    const pct  = pctOverride ?? instDelayWet[instId] ?? 0;
    const mode = instDelayMode[instId] ?? "N8";
    engine.setDelayWet(instId, pct, mode);
  }
  useEffect(() => {
    INSTRUMENTS.forEach((i) => updateDelaySends(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instDelayMode, instDelayWet]);

  function updateReverbSends(instId, pctOverride) {
    const pct  = pctOverride ?? instReverbWet[instId] ?? 0;
    const mode = instRevMode[instId] ?? "M";
    engine.setReverbWet(instId, pct, mode);
  }
  useEffect(() => {
    INSTRUMENTS.forEach((i) => updateReverbSends(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instRevMode, instReverbWet]);


  function applyAllFxSends() {
    const dw = instDelayWetRef.current;
    const dm = instDelayModeRef.current;
    const rw = instReverbWetRef.current;
    const rm = instRevModeRef.current;
    INSTRUMENTS.forEach((i) => {
      engine.setDelayWet(i.id, dw?.[i.id] ?? 0, dm?.[i.id] ?? "N8");
      engine.setReverbWet(i.id, rw?.[i.id] ?? 0, rm?.[i.id] ?? "M");
      engine.setSaturationWet(i.id, instSatWet[i.id] ?? 0, instSatMode[i.id] ?? "tape");
    });
  }

  // add refs near your other refs
  const instDelayWetRef = useRef(instDelayWet);
  const instDelayModeRef = useRef(instDelayMode);
  const instReverbWetRef = useRef(instReverbWet);
  const instRevModeRef = useRef(instRevMode);
  useEffect(() => { instDelayWetRef.current = instDelayWet; }, [instDelayWet]);
  useEffect(() => { instDelayModeRef.current = instDelayMode; }, [instDelayMode]);
  useEffect(() => { instReverbWetRef.current = instReverbWet; }, [instReverbWet]);
  useEffect(() => { instRevModeRef.current = instRevMode; }, [instRevMode]);


  // ===== Sidechain =====
  const [scMatrix, setScMatrix] = useState(
    Object.fromEntries(
      INSTRUMENTS.map((t) => [
        t.id,
        Object.fromEntries(INSTRUMENTS.map((s) => [s.id, false])),
      ])
    )
  );
  const [scAmtDb, setScAmtDb] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 6]))
  ); // dB
  const [scAtkMs, setScAtkMs] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 12]))
  ); // ms
  const [scRelMs, setScRelMs] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 180]))
  ); // ms

  // Refs for scheduler (so schedule() can read latest)
  const scMatrixRef = useRef(scMatrix);
  const scAmtDbRef  = useRef(scAmtDb);
  const scAtkMsRef  = useRef(scAtkMs);
  const scRelMsRef  = useRef(scRelMs);
  useEffect(() => { scMatrixRef.current = scMatrix; }, [scMatrix]);
  useEffect(() => { scAmtDbRef.current  = scAmtDb;  }, [scAmtDb]);
  useEffect(() => { scAtkMsRef.current  = scAtkMs;  }, [scAtkMs]);
  useEffect(() => { scRelMsRef.current  = scRelMs;  }, [scRelMs]);

  // ===== Sum bus (state only; nodes via engine) =====
  const [sumGainDb, setSumGainDb] = useState(0); // makeup/output gain
  const [limiterOn, setLimiterOn] = useState(true); // limiter toggle
  const [sumMeterDb, setSumMeterDb] = useState(-Infinity); // peak dBFS readout
  const [sumLowCut, setSumLowCut] = useState(false);
  const [sumHighCut, setSumHighCut] = useState(false);

  const [sumComp, setSumComp] = useState({
    threshold: -12, ratio: 3, attack: 0.003, release: 0.25, knee: 3,
  });

  // Route sum-bus state to engine
  useEffect(() => { engine.setSumComp(sumComp); }, [engine, sumComp]);
  useEffect(() => { engine.setLimiterOn(limiterOn); }, [engine, limiterOn]);
  useEffect(() => { engine.setSumGainDb(sumGainDb); }, [engine, sumGainDb]);
  useEffect(() => {
      engine.setSumFilters({
        lowCutOn:  sumLowCut,
        highCutOn: sumHighCut,
        lowCutHz:  230,
        highCutHz: 3000,
        Q:         1.0,
      });
    }, [engine, sumLowCut, sumHighCut]);

  // Meter (dBFS peak)
  useEffect(() => {
    const analyser = engine.getAnalyser();
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    let rafId;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
      const db = 20 * Math.log10(peak || 1e-8); // avoid -Infinity
      setSumMeterDb(db);
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  // ===== Metronome mode =====
  const metModeRef = useRef(metMode);
  useEffect(() => { metModeRef.current = state.transport.metMode; }, [state.transport.metMode]);

  function cycleMetronomeMode() {
    const next =
      metMode === "beats" ? "all" :
      metMode === "all"   ? "off" :
      "beats";
    actions.transport.setMetMode(next);
  }

  // ===== UI row latching / expansion =====
  const [uiLatchedRow, setUiLatchedRow] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "A"]))
  );

  const [rowExpanded, setRowExpanded] = useState(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: false, B: false }]))
  );

  function toggleRowExpanded(instId, row) {
    setRowExpanded((prev) => ({
      ...prev,
      [instId]: { ...prev[instId], [row]: !prev[instId][row] },
    }));
  }

  // ===== Tempo → engine =====
  useEffect(() => {
    engine.updateTempo(bpm);
  }, [engine, bpm]);

  // ===== Musical state (mutes/volumes/swing/patterns/rows) =====
  const [mutes, setMutes] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, false]))
  );
  const [instGainsDb, setInstGainsDb] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );


  const instGainsDbRef = useRef({});
  useEffect(() => { instGainsDbRef.current = instGainsDb; }, [instGainsDb]);


  const [soloActive, setSoloActive] = useState(false);
  const prevMutesRef = useRef(null);

  const [globalSwingPct, setGlobalSwingPct] = useState(100);
  const globalSwingPctRef = useRef(100);
  useEffect(() => { globalSwingPctRef.current = globalSwingPct; }, [globalSwingPct]);

  const [instSwingType, setInstSwingType] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "none"]))
  );
  const [instSwingAmt, setInstSwingAmt] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]))
  );
  const instSwingTypeRef = useRef(instSwingType);
  const instSwingAmtRef  = useRef(instSwingAmt);
  useEffect(() => { instSwingTypeRef.current = instSwingType; }, [instSwingType]);
  useEffect(() => { instSwingAmtRef.current  = instSwingAmt;  }, [instSwingAmt]);

  const [patterns, setPatterns] = useState(
    Object.fromEntries(
      INSTRUMENTS.map((i) => [
        i.id,
        { A: new Array(STEPS_PER_BAR).fill(0), B: new Array(STEPS_PER_BAR).fill(0) },
      ])
    )
  );

  const [rowActive, setRowActive] = useState(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: true, B: false }]))
  );

  // ===== Scheduler mirrors =====
  const nextNoteTimeRef = useRef(0);
  const currentStepRef  = useRef(0);
  const timerIdRef      = useRef(null);
  const recentWritesRef = useRef(new Map()); // keys like "kick-A-3"
  const loopStartRef    = useRef(0);

  const patternsRef = useRef(patterns);
  const mutesRef    = useRef(mutes);
  const rowActiveRef= useRef(rowActive);
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { mutesRef.current    = mutes;    }, [mutes]);
  useEffect(() => { rowActiveRef.current= rowActive;}, [rowActive]);

  const latchedRowRef = useRef(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "A"]))
  );

  // ===== Solo helpers (now notify engine) =====
  function applyMutes(newMutes) {
    setMutes(newMutes);
    mutesRef.current = newMutes;
    INSTRUMENTS.forEach((i) => {
      engine.updateInstrumentGain(i.id, instGainsDbRef.current[i.id] ?? 0, newMutes[i.id]);
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

  // ===== Meter/FX/tempo done; sidechain helper forwards to engine for now =====
  function scheduleDuckEnvelopes(triggerId, when) {
    engine.duckFromTrigger(
      triggerId,
      when,
      scMatrixRef.current,
      scAmtDbRef.current,
      scAtkMsRef.current,
      scRelMsRef.current
    );
  }

  // ===== Build/Apply session =====
  function buildSession() {
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
      instRevMode,
      instSatWet,
      instSatMode,         // {instId: 'S'|'M'|'L'}

      // sidechain
      scMatrix,            // target->trigger->bool
      scAmtDb,             // {targetId: dB}
      scAtkMs,             // {targetId: ms}
      scRelMs,             // {targetId: ms}

      // sum bus
      sumComp,             // {threshold, ratio, attack, release, knee}
      sumGainDb,
      limiterOn,
      sumLowCut,
      sumHighCut,

      // (Optional UI niceties)
      rowExpanded,         // {instId:{A:bool,B:bool}}
      selected,            // selected instrument id

      instPitchSemi,
    };
  }

  // after calling your useSessions hook:
const {
  sessions,
  presets,               // NEW
  currentSessionName,
  currentPresetName,     // NEW
  isPresetActive,        // NEW
  saveNamedSession,
  loadNamedSession,
  loadPreset,            // NEW
  deleteNamedSession,
  exportSessionToFile,
  importSessionFromFile,
} = useSessions({ buildSession, applySession, autoLoadLast: true });

// ...



  
  async function applySession(raw) {
    if (!raw || typeof raw !== "object") return;
    const s = deepClone(raw);

    if (!("v" in s) || s.v > SESSION_VERSION) {
      console.warn("Session version is newer than this app. Attempting to load anyway.");

    }

    const packId = PACK_IDS.includes(s.selectedPack) ? s.selectedPack : PACK_IDS[0];

    const nextPatterns = {};
    INSTRUMENTS.forEach((i) => {
      const p = s.patterns?.[i.id];
      nextPatterns[i.id] = {
        A: coerce16(p?.A),
        B: coerce16(p?.B),
      };
    });

    const fallbackBoolRows = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: true, B: false }]));
    const fallbackDbMap    = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    const fallbackZeroMap  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    const fallbackSatMode  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "tape"]));   
    const fallbackModeDly  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "N8"]));
    const fallbackModeRev  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "M"]));
    const fallbackSwingT   = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, "none"]));
    const fallbackSwingA   = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
    const fallbackPitchMap = Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]));
    


    const safeMap = (src, fb) =>
      Object.fromEntries(INSTRUMENTS.map((i) => [i.id, (src && src[i.id] !== undefined) ? src[i.id] : fb[i.id]]));

    // === Set pack first (engine will load buffers) ===
    setSelectedPack(packId);

    // === Core transport / grid
    actions.transport.setBpm(Number.isFinite(s.bpm) ? s.bpm : 120);
    actions.transport.setMetMode(["beats", "all", "off"].includes(s.metMode) ? s.metMode : "beats");
    setPatterns(nextPatterns);
    setRowActive(s.rowActive ? { ...fallbackBoolRows, ...s.rowActive } : fallbackBoolRows);

    // === Per-instrument volumes/mutes/solo
    setInstGainsDb(safeMap(s.instGainsDb, fallbackDbMap));
    applyMutes(
      s.mutes ? safeMap(s.mutes, Object.fromEntries(INSTRUMENTS.map(i => [i.id, false])))
              : Object.fromEntries(INSTRUMENTS.map(i => [i.id, false]))
    );
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
    setInstSatWet(safeMap(s.instSatWet, fallbackZeroMap));
    setInstSatMode(safeMap(s.instSatMode, fallbackSatMode));

    // Immediately reflect the loaded snapshot to the engine.
    // (Do NOT read from React state here — use the snapshot 's' you just loaded.)
    INSTRUMENTS.forEach(i => {
      const id = i.id;
      const wetD = s.instDelayWet?.[id]  ?? 0;
      const modeD= s.instDelayMode?.[id] ?? "N8";
      engine.setDelayWet(id, wetD, modeD);

      const wetR = s.instReverbWet?.[id]  ?? 0;
      const modeR= s.instRevMode?.[id]    ?? "M";
      engine.setReverbWet(id, wetR, modeR);
      engine.setSaturationWet(id, s.instSatWet?.[id] ?? 0, (s.instSatMode?.[id] ?? "tape"));
      engine.setInstrumentPitch(id, s.instPitchSemi?.[id] ?? 0);
    });

    // Also ensure post-gain/mute is reflected immediately (don’t wait for effects).
    INSTRUMENTS.forEach(i => {
      const id = i.id;
      const db = s.instGainsDb?.[id] ?? 0;
      const muted = s.mutes?.[id] ?? false;
      engine.updateInstrumentGain(id, db, muted);
    });
    

    // === Sidechain
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
    setSumLowCut(!!s.sumLowCut);
    setSumHighCut(!!s.sumHighCut);

    setInstPitchSemi(
      s.instPitchSemi
        ? Object.fromEntries(
            INSTRUMENTS.map(i => [
              i.id,
              Math.max(-12, Math.min(12, Math.round(s.instPitchSemi[i.id] ?? 0))),
            ])
          )
        : fallbackPitchMap
    );

    // === Optional UI niceties ===
    if (s.rowExpanded) setRowExpanded(s.rowExpanded);
    if (s.selected && INSTRUMENTS.some(i => i.id === s.selected)) actions.mix.setSelected(s.selected);
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
    const id = setTimeout(() => {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [
    selectedPack,
    bpm, metMode,
    patterns, rowActive,
    instGainsDb, mutes, soloActive,
    instSwingType, instSwingAmt, globalSwingPct,
    instDelayWet, instDelayMode,
    instReverbWet, instRevMode,
    scMatrix, scAmtDb, scAtkMs, scRelMs,
    sumComp, sumGainDb, limiterOn, sumLowCut, sumHighCut,
    rowExpanded, selected
  ]);

  // keep engine’s post-gain/mutes aligned whenever these change
  useEffect(() => {
    INSTRUMENTS.forEach(i => {
      engine.updateInstrumentGain(i.id, instGainsDb[i.id] ?? 0, mutes[i.id]);
    });
  }, [engine, instGainsDb, mutes]);


  const [instPitchSemi, setInstPitchSemi] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]))
  );

  // Selected channel volume change (also update engine)
  function handleSelectedVolumeChange(db) {
    setInstGainsDb(prev => ({ ...prev, [selected]: db }));
    engine.updateInstrumentGain(selected, db, mutesRef.current?.[selected]);
  }
  
  function handleSelectedPitchChange(semi) {
    const clamped = Math.max(-12, Math.min(12, Math.round(semi)));
    setInstPitchSemi(prev => ({ ...prev, [selected]: clamped }));
    engine.setInstrumentPitch(selected, clamped);
  }
  

// ===== Scheduling =====
useEffect(() => {
  if (!isPlaying || !engine.getCtx()) return;

  // align loop start to current bar
  const ctx = engine.getCtx();
  const secondsPerBeat = 60.0 / bpm;
  const secondsPerStep = secondsPerBeat / PPQ;
  const startIdx = currentStepRef.current % STEPS_PER_BAR;
  loopStartRef.current = ctx.currentTime - startIdx * secondsPerStep;

  nextNoteTimeRef.current = ctx.currentTime + 0.05;

  timerIdRef.current = setInterval(() => {
    schedule();
  }, LOOKAHEAD_MS);

  return () => clearInterval(timerIdRef.current);
}, [engine, isPlaying, bpm]);

function getSwingOffsetSec(instId, stepIndex, secondsPerBeat) {
  const type = instSwingTypeRef.current?.[instId] ?? "none";
  const amtLocal = (instSwingAmtRef.current?.[instId] ?? 0) / 100;
  const amtGlobal = (globalSwingPctRef.current ?? 100) / 100;
  const amt = amtLocal * amtGlobal;

  if (type === "none" || amt <= 0) return 0;

  const withinBeat = stepIndex % 4;

  if (type === "8") {
    // delay the off-beat 8th (index 2 within each beat)
    return withinBeat === 2 ? amt * (secondsPerBeat / 6) : 0;
  }
  if (type === "16") {
    // delay off 16ths (indices 1 and 3)
    const isOff16 = withinBeat % 2 === 1;
    return isOff16 ? amt * ((secondsPerBeat / 4) / 3) : 0;
  }
  if (type === "32") {
    // micro-swing: smaller delay on off-16ths (approx 32nd feel)
    const isOff16 = withinBeat % 2 === 1;
    return isOff16 ? amt * ((secondsPerBeat / 8) / 3) : 0;
  }
  return 0;
}

function schedule() {
  const ctx = engine.getCtx();
  if (!ctx) return;

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

    // 2) Metronome
    const mm = metModeRef.current;
    if (mm === "beats") {
      if (stepIndex % 4 === 0) engine.click("hi", nextNoteTimeRef.current);
    } else if (mm === "all") {
      engine.click(stepIndex % 4 === 0 ? "hi" : "lo", nextNoteTimeRef.current);
    }

    // 3) Schedule notes (HH→OHH choke + sidechain)
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
        targets.forEach(tid => engine.choke(tid, when));

        // Sidechain envelopes
        scheduleDuckEnvelopes(inst.id, when);

        // Finally play the note (skip if buffer missing in current pack)
        if (!engine.getBuffer(inst.id)) return;
        engine.playSample(inst.id, vel, when);
      }
    });

    // 4) Update the UI step to THIS step index
    actions.transport.setStep(stepIndex);

    // 5) Advance scheduler
    nextNoteTimeRef.current += secondsPerStep;
    currentStepRef.current = (currentStepRef.current + 1) % STEPS_PER_BAR;
  }
}

// ===== Compute precise step from AudioContext time (for recording) =====
function getRecordingStepIndex() {
  const ctx = engine.getCtx();
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

// ===== UI handlers =====
function togglePlay() {
  const ctx = engine.getCtx();
  if (!ctx) return;

  // Make sure the context is unlocked on iOS
  if (ctx.state !== "running") {
    try { ctx.resume(); } catch {}
  }

  const next = !isPlaying;
  if (next) {
    // (optional) ensure clean start aligned to now
    currentStepRef.current = 0;
    actions.transport.setStep(0);
    loopStartRef.current = ctx.currentTime;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
  }
  actions.transport.setIsPlaying(next);
}

function toggleRecord() {
  actions.transport.setIsRecording(!isRecording);
}

function toggleMute(instId) {
  setMutes((prev) => {
    const next = { ...prev, [instId]: !prev[instId] };
    engine.updateInstrumentGain(instId, instGainsDb[instId] ?? 0, next[instId]);
    return next;
  });
}

function selectInstrument(instId) {
  actions.mix.setSelected(instId);
}

function onPadPress(r, c) {
  const vel = VELS[r][c];

  // Monitor immediately
  if (!mutes[selected]) {
    const targets = CHOKE_GROUPS[selected] || [];
    const now = engine.getCtx()?.currentTime || 0;
    targets.forEach(tid => engine.choke(tid, now));
    engine.playSample(selected, vel, 0);
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
    const ctx = engine.getCtx();
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

  // reset volume to 0 dB and unmute (and reflect in engine)
  setInstGainsDb((prev) => ({ ...prev, [selected]: 0 }));
  setMutes((prev) => {
    const next = { ...prev, [selected]: false };
    mutesRef.current = next;
    return next;
  });
  engine.updateInstrumentGain(selected, 0, false);

  // clear any skip tokens for this instrument (both rows)
  for (const key of Array.from(recentWritesRef.current.keys())) {
    if (key.startsWith(`${selected}-`)) {
      recentWritesRef.current.delete(key);
    }
  }

  // reset FX sends for selected (state + engine)
  setInstDelayWet(prev => ({ ...prev, [selected]: 0 }));
  setInstReverbWet(prev => ({ ...prev, [selected]: 0 }));
  engine.setDelayWet(selected, 0, instDelayMode[selected] ?? "N8");
  engine.setReverbWet(selected, 0, instRevMode[selected] ?? "M");
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
  const swingAmtZero  = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, 0]));
  setInstSwingType(swingTypeNone);
  setInstSwingAmt(swingAmtZero);
  instSwingTypeRef.current = swingTypeNone;
  instSwingAmtRef.current  = swingAmtZero;

  // 4) Reset all FX sends (state + engine)
  const zeroWet = Object.fromEntries(INSTRUMENTS.map(i => [i.id, 0]));
  setInstDelayWet(zeroWet);
  setInstReverbWet(zeroWet);
  setInstSatWet(zeroWet);
  INSTRUMENTS.forEach((i) => {
    engine.setDelayWet(i.id, 0, "N8");
    engine.setReverbWet(i.id, 0, "M");
    engine.setSaturationWet(i.id, 0, "tape");
  });

  // 5) Unmute everything and reflect in engine
  const allUnmuted = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, false]));
  setMutes(allUnmuted);
  mutesRef.current = allUnmuted;

  // 6) Apply 0 dB to engine post-gains
  INSTRUMENTS.forEach((i) => {
    engine.updateInstrumentGain(i.id, 0, false);
  });

  // 7) Clear skip-once tokens & solo
  recentWritesRef.current.clear();
  setSoloActive(false);
  prevMutesRef.current = null;
}


// replace your RetroLogo with this version
const RetroLogo = React.forwardRef(function RetroLogo({ onActivate }, ref) {
  return (
    <h1
      ref={ref}
      className="gb-wordmark"
      aria-label="GrooveBox"
      role="button"
      tabIndex={0}
      onClick={onActivate} // still keep React handler as a fallback
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate?.(); }
      }}
      style={{ cursor: "pointer" }}
    >
      GrooveBox
    </h1>
  );
});


// attach native listeners so reset still works while playing
useEffect(() => {
  const el = logoRef.current;
  if (!el) return;

  const fireReset = (e) => {
    // keep it a trusted user gesture
    e.preventDefault?.();
    e.stopPropagation?.();
    e.stopImmediatePropagation?.();
    reloadLikeShiftCmdR();
  };

  // Element-level capture (still keep it; cheap and works when no overlay)
  el.addEventListener("pointerdown", fireReset, { capture: true, passive: false });

  // Window capture fallback using coordinate hit-test (works even if a cover blocks hit-testing/path)
  const hitTestAt = (x, y) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const onWindowAny = (e) => {
    // pointerdown / mousedown
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (x == null || y == null) return;
    if (hitTestAt(x, y)) fireReset(e);
  };

  // Listen to several starters to dodge other handlers
  const opts = { capture: true, passive: false };
  window.addEventListener("pointerdown", onWindowAny, opts);
  window.addEventListener("mousedown", onWindowAny, opts);
  window.addEventListener("touchstart", onWindowAny, opts);

  return () => {
    el.removeEventListener("pointerdown", fireReset, { capture: true });
    window.removeEventListener("pointerdown", onWindowAny, { capture: true });
    window.removeEventListener("mousedown", onWindowAny, { capture: true });
    window.removeEventListener("touchstart", onWindowAny, { capture: true });
  };
}, [reloadLikeShiftCmdR]);


// === GrooveBox.jsx ===
function ThemeButtons({ scheme, setScheme }) {
  const retroRef = React.useRef(null);
  const neoRef = React.useRef(null);

  React.useEffect(() => {
    const rr = retroRef.current;
    const nn = neoRef.current;
    if (!rr || !nn) return;

    const makeHandler = (value) => (e) => {
      // Win the race: run before any bubbling transport handlers
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      setScheme(value);
    };

    const onRetro = makeHandler("retro");
    const onNeo = makeHandler("neo");

    // capture + non-passive so preventDefault actually works on touch
    rr.addEventListener("pointerdown", onRetro, { capture: true, passive: false });
    nn.addEventListener("pointerdown", onNeo, { capture: true, passive: false });

    return () => {
      rr.removeEventListener("pointerdown", onRetro, { capture: true });
      nn.removeEventListener("pointerdown", onNeo, { capture: true });
    };
  }, [setScheme]);

  return (
    <div className="gb-theme-switch" role="tablist" aria-label="Theme switch">
      <button
        ref={retroRef}
        type="button"
        className={`gb-theme-btn ${scheme === "retro" ? "is-active" : ""}`}
        aria-pressed={scheme === "retro"}
        // Fallback if nothing is intercepting
        onClick={() => setScheme("retro")}
        // Bonus: React capture also helps in many cases
        onPointerDownCapture={(e) => { /* harmless backup */ }}
      >
        RETRO
      </button>

      <button
        ref={neoRef}
        type="button"
        className={`gb-theme-btn ${scheme === "neo" ? "is-active" : ""}`}
        aria-pressed={scheme === "neo"}
        onClick={() => setScheme("neo")}
        onPointerDownCapture={(e) => { /* harmless backup */ }}
      >
        NEO
      </button>
    </div>
  );
}

// 1) define a handler (above the return in GrooveBox.jsx)
const handleNewSession = () => {
  // your existing "New" logic (unchanged)
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

  // clear current selection if you were tracking it
  // (keep this if you actually have setCurrentSessionName in scope)
  try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch {}
  // if you *do* have setCurrentSessionName available, also do:
  // setCurrentSessionName("");

  setShowPads(true);
  setShowSC(false);
  setShowFX(false);
  setShowSwingUI(false);
  setShowSum(false);
};


// ===== Render =====
return (
  <div
    style={{ color: "white" }}
    className={scheme === "neo" ? "gb-root" : undefined}
    data-scheme={scheme}
  >
    
    <SoundGate engine={engine} onlyOnIOS />

    {/* RETRO PANEL: Brand row + controls */}
    

      {/* ROW 0: Logo (left) + Theme Toggle (right) */}
      <header className="gb-retro-header">
  <div className="gb-brand">
    <RetroLogo ref={logoRef} onActivate={reloadLikeShiftCmdR} />
  </div>
  <ThemeButtons scheme={scheme} setScheme={setScheme} />
</header>
<LogoResetHotspot
  targetRef={logoRef}
  active={isPlaying}   // hotspot only while playing
  onReset={() => {
    try { actions.transport.setIsPlaying(false); } catch {}
    try { engine.getCtx()?.suspend(); } catch {}
    try { if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; } } catch {}
    // hard refresh (cache-busted)
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  }}
/>
<div style={{ height: 3, background: "rgba(255,255,255,.1)", margin: "8px 0" }} />

      {/* ROW 1: Pack + Metronome + BPM */}
      <div className="gb-row gb-row--packs">
        <PackBar
          selectedPack={selectedPack}
          setSelectedPack={setSelectedPack}
          packLoading={packLoading}
          packIds={PACK_IDS}
          samplePacks={SAMPLE_PACKS}
          metMode={metMode}
          cycleMetronomeMode={cycleMetronomeMode}
          bpm={bpm}
          setBpm={actions.transport.setBpm}
          scheme={scheme}
          setScheme={setScheme}
        />
      </div>
      {/* Divider */}
    <div style={{margin: "8px 0" }} />

      {/* ROW 2: Session */}
      <div className="gb-row gb-row--session">
      <SessionBar
  sessions={sessions}
  currentSessionName={currentSessionName}
  loadNamedSession={loadNamedSession}
  saveNamedSession={saveNamedSession}
  deleteNamedSession={deleteNamedSession}
  exportSessionToFile={exportSessionToFile}
  importSessionFromFile={importSessionFromFile}

  // presets (read-only)
  presets={presets}
  currentPresetName={currentPresetName}
  loadPreset={loadPreset}
  isPresetActive={isPresetActive}

  // new handler
  onNewSession={handleNewSession}
/>
      </div>
    

    {/* Divider */}
    <div style={{ height: 3, background: "rgba(255,255,255,.1)", margin: "8px 0" }} />
  

{/* Instruments + Mutes */}
<InstrumentGrid
  selected={selected}
  selectInstrument={selectInstrument}
  mutes={mutes}
  toggleMute={toggleMute}
/>

{/* Divider */}
<div style={{ height: 3, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />


{/* Channel (pads + fader + solo) */}
<Channel
  show={showPads}
  onToggle={() => setShowPads(s => !s)}
  selected={selected}
  volumeDb={instGainsDb[selected]}

  onVolumeChange={handleSelectedVolumeChange}
  pitchSemi={instPitchSemi[selected]}
  
  onPitchChange={handleSelectedPitchChange}
  soloActive={soloActive}
  onToggleSolo={toggleSolo}
  onPadPress={onPadPress}
/>

{/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

{/* Sidechain */}
<SidechainPanel
  show={showSC}
  onToggle={() => setShowSC(s => !s)}
  selected={selected}
  scMatrix={scMatrix} setScMatrix={setScMatrix}
  scAmtDb={scAmtDb} setScAmtDb={setScAmtDb}
  scAtkMs={scAtkMs} setScAtkMs={setScAtkMs}
  scRelMs={scRelMs} setScRelMs={setScRelMs}
/>

{/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

{/* FX */}
<FXPanel
  show={showFX}
  onToggle={() => setShowFX(s => !s)}
  selected={selected}
  instDelayWet={instDelayWet} setInstDelayWet={setInstDelayWet}
  instDelayMode={instDelayMode} setInstDelayMode={setInstDelayMode}
  updateDelaySends={updateDelaySends}
  instReverbWet={instReverbWet} setInstReverbWet={setInstReverbWet}
  instRevMode={instRevMode} setInstRevMode={setInstRevMode}
  updateReverbSends={updateReverbSends}
  instSatWet={instSatWet} setInstSatWet={setInstSatWet}
  instSatMode={instSatMode} setInstSatMode={setInstSatMode}
  updateSat={updateSat}
/>

{/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

{/* Swing / Groove */}
<SwingPanel
  show={showSwingUI}
  onToggle={() => setShowSwingUI(s => !s)}
  selected={selected}
  instSwingType={instSwingType} setInstSwingType={setInstSwingType}
  instSwingAmt={instSwingAmt}   setInstSwingAmt={setInstSwingAmt}
  globalSwingPct={globalSwingPct} setGlobalSwingPct={setGlobalSwingPct}
/>

{/* Divider */}
<div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "24px 0" }} />

{/* Sum Bus */}
<SumBusPanel
  show={showSum}
  onToggle={() => setShowSum(s => !s)}
  limiterOn={limiterOn} setLimiterOn={setLimiterOn}
  sumComp={sumComp} setSumComp={setSumComp}
  sumGainDb={sumGainDb} setSumGainDb={setSumGainDb}
  sumMeterDb={sumMeterDb}
  lowCutOn={sumLowCut} setLowCutOn={setSumLowCut}
  highCutOn={sumHighCut} setHighCutOn={setSumHighCut}
/>

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
   
<StepEditor
  patterns={patterns}
  selected={selected}
  rowActive={rowActive}
  toggleRowActiveUI={toggleRowActiveUI}
  rowExpanded={rowExpanded}
  toggleRowExpanded={toggleRowExpanded}
  uiLatchedRow={uiLatchedRow}
  step={step}
  cycleStepRow={cycleStepRow}
/>

</div>  
);
}  