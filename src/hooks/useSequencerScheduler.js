import { useEffect, useRef, useState } from "react";
import { INSTRUMENTS } from "../constants/instruments";
import { PPQ, STEPS_PER_BAR } from "../constants/sequencer";

/**
 * Timing loop + scheduling (metronome, swing, latch rows, choke, sidechain).
 *
 * @param {object} p
 * @param {boolean} p.isPlaying
 * @param {number}  p.bpm
 * @param {object}  p.patterns       // { instId: {A:[16], B:[16]} }
 * @param {object}  p.mutes          // { instId: bool }
 * @param {object}  p.rowActive      // { instId: {A:bool, B:bool} }
 * @param {string}  p.metMode        // "beats" | "all" | "off"
 * @param {object}  p.instSwingType  // { instId: 'none'|'8'|'16'|'32' }
 * @param {object}  p.instSwingAmt   // { instId: 0..100 }
 * @param {number}  p.globalSwingPct // 0..150
 * @param {object}  p.sidechain      // { scMatrix, scAmtDb, scAtkMs, scRelMs }
 * @param {object}  p.chokeGroups    // e.g. { hihat: ['openhihat'] }
 *
 * @param {function} p.playSample(instId, vel, when)
 * @param {function} p.chokeVoices(instId, when)
 * @param {function} p.playBuffer(buffer, gain, when)
 * @param {object}   p.metClickRef   // { hi, lo }
 * @param {object}   p.duckGainsRef  // targetId -> Map<triggerId, GainNode>
 * @param {function} p.setUiLatchedRow(nextMap) // optional; if omitted returns uiLatchedRow state
 *
 * @returns { step, uiLatchedRow, getRecordingStepIndex, recentWritesRef, loopStartRef }
 */
export function useSequencerScheduler({
  isPlaying,
  bpm,
  patterns,
  mutes,
  rowActive,
  metMode,
  instSwingType,
  instSwingAmt,
  globalSwingPct,
  sidechain,
  chokeGroups,

  playSample,
  chokeVoices,
  playBuffer,
  metClickRef,
  duckGainsRef,

  setUiLatchedRow: setUiLatchedRowExternal,
}) {
  // UI state
  const [step, setStep] = useState(0);
  const [uiLatchedRow, setUiLatchedRowInternal] = useState(
    Object.fromEntries(INSTRUMENTS.map(i => [i.id, "A"]))
  );
  const setUiLatchedRow = setUiLatchedRowExternal || setUiLatchedRowInternal;

  // Refs
  const audioCtxRef = useRef(null); // we can derive from click buffers
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerIdRef = useRef(null);
  const loopStartRef = useRef(0);
  const latchedRowRef = useRef(Object.fromEntries(INSTRUMENTS.map(i => [i.id, "A"])));
  const recentWritesRef = useRef(new Map());

  // Mirrors (avoid stale closures)
  const patternsRef = useRef(patterns); useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  const mutesRef    = useRef(mutes);    useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  const rowActiveRef= useRef(rowActive);useEffect(() => { rowActiveRef.current = rowActive; }, [rowActive]);
  const metModeRef  = useRef(metMode);  useEffect(() => { metModeRef.current = metMode; }, [metMode]);

  const instSwingTypeRef = useRef(instSwingType); useEffect(() => { instSwingTypeRef.current = instSwingType; }, [instSwingType]);
  const instSwingAmtRef  = useRef(instSwingAmt);  useEffect(() => { instSwingAmtRef.current = instSwingAmt; }, [instSwingAmt]);
  const globalSwingPctRef= useRef(globalSwingPct);useEffect(() => { globalSwingPctRef.current = globalSwingPct; }, [globalSwingPct]);

  const scMatrixRef = useRef(sidechain.scMatrix); useEffect(() => { scMatrixRef.current = sidechain.scMatrix; }, [sidechain.scMatrix]);
  const scAmtDbRef  = useRef(sidechain.scAmtDb);  useEffect(() => { scAmtDbRef.current  = sidechain.scAmtDb;  }, [sidechain.scAmtDb]);
  const scAtkMsRef  = useRef(sidechain.scAtkMs);  useEffect(() => { scAtkMsRef.current  = sidechain.scAtkMs;  }, [sidechain.scAtkMs]);
  const scRelMsRef  = useRef(sidechain.scRelMs);  useEffect(() => { scRelMsRef.current  = sidechain.scRelMs;  }, [sidechain.scRelMs]);

  // try to grab a context from met click node
  useEffect(() => {
    const hi = metClickRef?.current?.hi;
    if (hi && hi.sampleRate) {
      // no direct ctx; but we can infer when scheduling via currentTime on any node param
    }
  }, [metClickRef]);

  // ===== helpers =====
  function getSwingOffsetSec(instId, stepIndex, secondsPerBeat) {
    const type = instSwingTypeRef.current?.[instId] ?? "none";
    const amtLocal = (instSwingAmtRef.current?.[instId] ?? 0) / 100;
    const amtGlobal = (globalSwingPctRef.current ?? 100) / 100;
    const amt = amtLocal * amtGlobal;

    if (type === "none" || amt <= 0) return 0;

    const withinBeat = stepIndex % 4;
    if (type === "8")   return withinBeat === 2 ? amt * (secondsPerBeat / 6) : 0;
    if (type === "16")  return (withinBeat % 2 === 1) ? amt * ((secondsPerBeat / 4) / 3) : 0;
    if (type === "32")  return (withinBeat % 2 === 1) ? amt * ((secondsPerBeat / 8) / 3) : 0;
    return 0;
  }

  function scheduleDuckEnvelopes(triggerId, when, ctxCurrentTime) {
    // For every TARGET that listens to this trigger, dip its specific duck gain
    INSTRUMENTS.forEach((target) => {
      if (!scMatrixRef.current?.[target.id]?.[triggerId]) return;
      const dg = duckGainsRef.current.get(target.id)?.get(triggerId);
      if (!dg) return;

      const g = dg.gain;
      const amtDb = scAmtDbRef.current?.[target.id] ?? 6;
      const atkMs = scAtkMsRef.current?.[target.id] ?? 12;
      const relMs = scRelMsRef.current?.[target.id] ?? 180;

      const dip = Math.max(0.0001, dbToGain(-amtDb));
      const atk = Math.max(0.001, atkMs / 1000);
      const rel = Math.max(0.001, relMs / 1000);

      const t0 = Math.max(when, ctxCurrentTime);
      g.cancelScheduledValues(t0);
      g.setValueAtTime(1.0, t0);
      g.exponentialRampToValueAtTime(dip, t0 + atk);
      g.exponentialRampToValueAtTime(1.0, t0 + atk + rel);
    });
  }

  // ===== scheduler =====
  useEffect(() => {
    if (!isPlaying) return;

    // We need a real AudioContext time reference. Use any duck gain node param.
    const anyTarget = INSTRUMENTS[0]?.id;
    const anyParam =
      duckGainsRef.current.get(anyTarget)?.values().next().value?.gain || null;
    if (!anyParam) return;

    // align loop start to current bar
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;
    const startIdx = currentStepRef.current % STEPS_PER_BAR;
    const ctxNow = anyParam.context.currentTime;
    loopStartRef.current = ctxNow - startIdx * secondsPerStep;

    nextNoteTimeRef.current = ctxNow + 0.05;

    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD_TIME = 0.1;

    const tick = () => {
      const ctx = anyParam.context;
      while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
        const stepIndex = currentStepRef.current % STEPS_PER_BAR;

        // 1) Latch rows at bar start and reflect in UI
        if (stepIndex === 0) {
          INSTRUMENTS.forEach((inst) => {
            const ra = rowActiveRef.current?.[inst.id] || { A: true, B: false };
            const prev = latchedRowRef.current[inst.id] || "A";
            if (ra.A && ra.B) latchedRowRef.current[inst.id] = prev === "A" ? "B" : "A";
            else if (ra.A)    latchedRowRef.current[inst.id] = "A";
            else if (ra.B)    latchedRowRef.current[inst.id] = "B";
            else              latchedRowRef.current[inst.id] = prev || "A";
          });

          // sync to UI state
          setUiLatchedRow((prev) => {
            let changed = false;
            const next = { ...prev };
            INSTRUMENTS.forEach((inst) => {
              const v = latchedRowRef.current[inst.id];
              if (next[inst.id] !== v) { next[inst.id] = v; changed = true; }
            });
            return changed ? next : prev;
          });
        }

        // 2) Metronome
        const mm = metModeRef.current;
        if (mm !== "off") {
          const hi = metClickRef.current.hi;
          const lo = metClickRef.current.lo;
          if (mm === "beats") {
            if (stepIndex % 4 === 0) playBuffer(hi, 0.15, nextNoteTimeRef.current);
          } else {
            const click = stepIndex % 4 === 0 ? hi : lo;
            playBuffer(click, 0.15, nextNoteTimeRef.current);
          }
        }

        // 3) Notes (with choke + duck + swing offset)
        INSTRUMENTS.forEach((inst) => {
          const row = latchedRowRef.current[inst.id] || "A";
          const patt = patternsRef.current?.[inst.id]?.[row];
          const vel  = (patt?.[stepIndex]) || 0;

          if (vel > 0 && !mutesRef.current?.[inst.id]) {
            const key = `${inst.id}-${row}-${stepIndex}`;
            if (recentWritesRef.current.has(key)) {
              recentWritesRef.current.delete(key);
              return;
            }

            const when =
              nextNoteTimeRef.current +
              getSwingOffsetSec(inst.id, stepIndex, secondsPerBeat);

            // choke group
            const targets = (chokeGroups && chokeGroups[inst.id]) ? chokeGroups[inst.id] : [];
            targets.forEach(tid => chokeVoices(tid, when));

            // sidechain ducks
            scheduleDuckEnvelopes(inst.id, when, anyParam.context.currentTime);

            // play
            playSample(inst.id, vel, when);
          }
        });

        // 4) UI step
        setStep(stepIndex);

        // 5) advance
        nextNoteTimeRef.current += secondsPerStep;
        currentStepRef.current = (currentStepRef.current + 1) % STEPS_PER_BAR;
      }
    };

    const id = setInterval(tick, LOOKAHEAD_MS);
    timerIdRef.current = id;
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, bpm]); // other deps are via refs

  // ===== public helpers =====
  function getRecordingStepIndex() {
    // derive currentTime from any duck param
    const anyTarget = INSTRUMENTS[0]?.id;
    const anyParam =
      duckGainsRef.current.get(anyTarget)?.values().next().value?.gain || null;
    if (!anyParam) return currentStepRef.current % STEPS_PER_BAR;

    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / PPQ;

    const now = anyParam.context.currentTime;
    const elapsed = now - loopStartRef.current;
    const safeElapsed = elapsed < 0 ? 0 : elapsed;

    const steps = safeElapsed / secondsPerStep + 1e-6;
    const idx = Math.floor(steps % STEPS_PER_BAR);
    return idx;
  }

  return {
    step,
    uiLatchedRow,
    getRecordingStepIndex,
    recentWritesRef,
    loopStartRef,
  };
}
