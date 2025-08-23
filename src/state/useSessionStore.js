import { useMemo, useReducer } from "react";
import { INSTRUMENTS } from "../constants/instruments";
import { STEPS_PER_BAR, STEP_CYCLE_ORDER } from "../constants/sequencer";
import {
  buildMap,
  buildRowActiveMap,
  buildRowExpandedMap,
  buildUiLatchedRowMap,
  buildPatternMap,
  withStep,
} from "./perInstrument";

// -------------------------
// Initial (mirrors your JSX)
// -------------------------
const initial = (() => ({
  transport: {
    bpm: 120,
    isPlaying: false,
    isRecording: false,
    metMode: "beats", // "beats" | "all" | "off"
    step: 0,
  },

  packs: {
    selectedPack: null,      // fill from UI on mount
    packLoading: false,
  },

  instrumentMix: {
    selected: INSTRUMENTS[0].id,
    instGainsDb: buildMap(0),
    mutes: buildMap(false),
    soloActive: false,
  },

  swing: {
    globalSwingPct: 100,
    instSwingType: buildMap("none"), // "none"|"8"|"16"|"32"
    instSwingAmt: buildMap(0),       // 0..100
  },

  fx: {
    instDelayWet: buildMap(0),
    instDelayMode: buildMap("N8"), // "N16"|"N8"|"N3_4"
    instReverbWet: buildMap(0),
    instRevMode: buildMap("M"),    // "S"|"M"|"L"
  },

  sidechain: {
    // matrix: target -> trigger -> bool
    scMatrix: Object.fromEntries(
      INSTRUMENTS.map((t) => [
        t.id,
        Object.fromEntries(INSTRUMENTS.map((s) => [s.id, false])),
      ])
    ),
    scAmtDb: buildMap(6),
    scAtkMs: buildMap(12),
    scRelMs: buildMap(180),
  },

  sumBus: {
    sumComp: { threshold: -12, ratio: 3, attack: 0.003, release: 0.25, knee: 3 },
    sumGainDb: 0,
    limiterOn: true,
    sumMeterDb: -Infinity,
  },

  patterns: buildPatternMap(STEPS_PER_BAR), // {inst:{A:[16],B:[16]}}
  rowActive: buildRowActiveMap(true, false),

  ui: {
    rowExpanded: buildRowExpandedMap(false, false),
    uiLatchedRow: buildUiLatchedRowMap("A"),
    folds: { pads: true, sc: false, fx: false, swing: false, sum: false },
  },

  sessions: {
    sessions: {},               // { [name]: sessionObj }
    currentSessionName: "",     // active name
  },
}))();

// ---------------
// Reducer helpers
// ---------------
const merge = (slice, payload) => ({ ...slice, ...payload });

// ---------------
// Reducer
// ---------------
function reducer(state, action) {
  switch (action.type) {
    // Transport
    case "transport/merge":
      return { ...state, transport: merge(state.transport, action.payload) };

    // Packs
    case "packs/merge":
      return { ...state, packs: merge(state.packs, action.payload) };

    // Instrument mix
    case "mix/setSelected":
      return { ...state, instrumentMix: { ...state.instrumentMix, selected: action.payload } };
    case "mix/setGainDb": {
      const { instId, db } = action.payload;
      return {
        ...state,
        instrumentMix: {
          ...state.instrumentMix,
          instGainsDb: { ...state.instrumentMix.instGainsDb, [instId]: db },
        },
      };
    }
    case "mix/setMute": {
      const { instId, muted } = action.payload;
      return {
        ...state,
        instrumentMix: {
          ...state.instrumentMix,
          mutes: { ...state.instrumentMix.mutes, [instId]: muted },
        },
      };
    }
    case "mix/toggleMute": {
      const { instId } = action.payload;
      const prev = !!state.instrumentMix.mutes[instId];
      return {
        ...state,
        instrumentMix: {
          ...state.instrumentMix,
          mutes: { ...state.instrumentMix.mutes, [instId]: !prev },
        },
      };
    }
    case "mix/setSolo":
      return { ...state, instrumentMix: { ...state.instrumentMix, soloActive: !!action.payload } };

    // Swing
    case "swing/merge":
      return { ...state, swing: merge(state.swing, action.payload) };
    case "swing/setInstType": {
      const { instId, type } = action.payload;
      return {
        ...state,
        swing: {
          ...state.swing,
          instSwingType: { ...state.swing.instSwingType, [instId]: type },
        },
      };
    }
    case "swing/setInstAmt": {
      const { instId, amt } = action.payload;
      return {
        ...state,
        swing: {
          ...state.swing,
          instSwingAmt: { ...state.swing.instSwingAmt, [instId]: amt },
        },
      };
    }

    // FX
    case "fx/setDelayWet": {
      const { instId, wet } = action.payload;
      return { ...state, fx: { ...state.fx, instDelayWet: { ...state.fx.instDelayWet, [instId]: wet } } };
    }
    case "fx/setDelayMode": {
      const { instId, mode } = action.payload;
      return { ...state, fx: { ...state.fx, instDelayMode: { ...state.fx.instDelayMode, [instId]: mode } } };
    }
    case "fx/setReverbWet": {
      const { instId, wet } = action.payload;
      return { ...state, fx: { ...state.fx, instReverbWet: { ...state.fx.instReverbWet, [instId]: wet } } };
    }
    case "fx/setRevMode": {
      const { instId, mode } = action.payload;
      return { ...state, fx: { ...state.fx, instRevMode: { ...state.fx.instRevMode, [instId]: mode } } };
    }

    // Sidechain
    case "sc/setMatrix": {
      return { ...state, sidechain: { ...state.sidechain, scMatrix: action.payload } };
    }
    case "sc/toggleCell": {
      const { targetId, triggerId } = action.payload;
      const next = structuredClone(state.sidechain.scMatrix);
      next[targetId][triggerId] = !next[targetId][triggerId];
      return { ...state, sidechain: { ...state.sidechain, scMatrix: next } };
    }
    case "sc/setAmtDb": {
      const { instId, db } = action.payload;
      return { ...state, sidechain: { ...state.sidechain, scAmtDb: { ...state.sidechain.scAmtDb, [instId]: db } } };
    }
    case "sc/setAtkMs": {
      const { instId, ms } = action.payload;
      return { ...state, sidechain: { ...state.sidechain, scAtkMs: { ...state.sidechain.scAtkMs, [instId]: ms } } };
    }
    case "sc/setRelMs": {
      const { instId, ms } = action.payload;
      return { ...state, sidechain: { ...state.sidechain, scRelMs: { ...state.sidechain.scRelMs, [instId]: ms } } };
    }

    // Sum bus
    case "sum/merge":
      return { ...state, sumBus: merge(state.sumBus, action.payload) };
    case "sum/setMeterDb":
      return { ...state, sumBus: { ...state.sumBus, sumMeterDb: action.payload } };

    // Patterns / rows
    case "patterns/setAll":
      return { ...state, patterns: action.payload };
    case "patterns/setFor":
      return {
        ...state,
        patterns: {
          ...state.patterns,
          [action.payload.instId]: {
            A: [...action.payload.value.A],
            B: [...action.payload.value.B],
          },
        },
      };
    case "patterns/cycleStep": {
      const { instId, row, stepIdx } = action.payload;
      const curr = state.patterns[instId][row][stepIdx] ?? 0;
      let i = STEP_CYCLE_ORDER.findIndex((v) => Math.abs(v - curr) < 1e-6);
      if (i === -1) i = STEP_CYCLE_ORDER.length - 1;
      const nextVel = STEP_CYCLE_ORDER[(i + 1) % STEP_CYCLE_ORDER.length];
      return { ...state, patterns: withStep(state.patterns, instId, row, stepIdx, nextVel) };
    }
    case "rowActive/merge":
      return { ...state, rowActive: { ...state.rowActive, ...action.payload } };

    // UI
    case "ui/merge":
      return { ...state, ui: merge(state.ui, action.payload) };
    case "ui/toggleFold": {
      const key = action.payload; // 'pads' | 'sc' | 'fx' | 'swing' | 'sum'
      return {
        ...state,
        ui: { ...state.ui, folds: { ...state.ui.folds, [key]: !state.ui.folds[key] } },
      };
    }
    case "ui/toggleRowExpanded": {
      const { instId, row } = action.payload;
      const next = { ...state.ui.rowExpanded };
      next[instId] = { ...next[instId], [row]: !next[instId][row] };
      return { ...state, ui: { ...state.ui, rowExpanded: next } };
    }
    case "ui/setUiLatchedRow":
      return { ...state, ui: { ...state.ui, uiLatchedRow: action.payload } };

    // Sessions dictionary + current
    case "sessions/merge":
      return { ...state, sessions: merge(state.sessions, action.payload) };

    // Resets used by “New Session”
    case "all/resetSoft": {
      return {
        ...state,
        patterns: buildPatternMap(STEPS_PER_BAR),
        instrumentMix: {
          ...state.instrumentMix,
          instGainsDb: buildMap(0),
          mutes: buildMap(false),
          soloActive: false,
        },
        swing: {
          ...state.swing,
          instSwingType: buildMap("none"),
          instSwingAmt: buildMap(0),
          globalSwingPct: 100,
        },
        fx: {
          ...state.fx,
          instDelayWet: buildMap(0),
          instReverbWet: buildMap(0),
          instDelayMode: buildMap("N8"),
          instRevMode: buildMap("M"),
        },
        rowActive: buildRowActiveMap(true, false),
        ui: {
          ...state.ui,
          rowExpanded: buildRowExpandedMap(false, false),
          uiLatchedRow: buildUiLatchedRowMap("A"),
          folds: { pads: true, sc: false, fx: false, swing: false, sum: false },
        },
      };
    }

    default:
      return state;
  }
}

// -------------------------
// Public hook + action API
// -------------------------
export function useSessionStore() {
  const [state, dispatch] = useReducer(reducer, initial);

  const actions = useMemo(() => ({
    transport: {
      setBpm: (bpm) => dispatch({ type: "transport/merge", payload: { bpm } }),
      setMetMode: (metMode) => dispatch({ type: "transport/merge", payload: { metMode } }),
      setIsPlaying: (isPlaying) => dispatch({ type: "transport/merge", payload: { isPlaying } }),
      setIsRecording: (isRecording) => dispatch({ type: "transport/merge", payload: { isRecording } }),
      setStep: (step) => dispatch({ type: "transport/merge", payload: { step } }),
      togglePlay:     () => dispatch({ type: "transport/merge", payload: (s)=>({ isPlaying: !s?.isPlaying }) }),
      toggleRecord:   () => dispatch({ type: "transport/merge", payload: (s)=>({ isRecording: !s?.isRecording }) }),
      // Note: the two ^ 'payload as fn' form is a convenience if you later wrap dispatch
    },

    packs: {
      setSelected: (id) => dispatch({ type: "packs/merge", payload: { selectedPack: id } }),
      setLoading:  (on) => dispatch({ type: "packs/merge", payload: { packLoading: !!on } }),
    },

    mix: {
      setSelected: (id) => dispatch({ type: "mix/setSelected", payload: id }),
      setGainDb:   (instId, db) => dispatch({ type: "mix/setGainDb", payload: { instId, db } }),
      setMute:     (instId, muted) => dispatch({ type: "mix/setMute", payload: { instId, muted } }),
      toggleMute:  (instId) => dispatch({ type: "mix/toggleMute", payload: { instId } }),
      setSolo:     (on) => dispatch({ type: "mix/setSolo", payload: !!on }),
    },

    swing: {
      setGlobal: (pct) => dispatch({ type: "swing/merge", payload: { globalSwingPct: pct } }),
      setInstType: (instId, type) => dispatch({ type: "swing/setInstType", payload: { instId, type } }),
      setInstAmt:  (instId, amt)  => dispatch({ type: "swing/setInstAmt",  payload: { instId, amt } }),
    },

    fx: {
      setDelayWet:  (instId, wet) => dispatch({ type: "fx/setDelayWet",  payload: { instId, wet } }),
      setDelayMode: (instId, mode)=> dispatch({ type: "fx/setDelayMode", payload: { instId, mode } }),
      setReverbWet: (instId, wet) => dispatch({ type: "fx/setReverbWet", payload: { instId, wet } }),
      setRevMode:   (instId, mode)=> dispatch({ type: "fx/setRevMode",   payload: { instId, mode } }),
    },

    sidechain: {
      setMatrix: (m) => dispatch({ type: "sc/setMatrix", payload: m }),
      toggleCell: (targetId, triggerId) =>
        dispatch({ type: "sc/toggleCell", payload: { targetId, triggerId } }),
      setAmtDb: (instId, db) => dispatch({ type: "sc/setAmtDb", payload: { instId, db } }),
      setAtkMs: (instId, ms) => dispatch({ type: "sc/setAtkMs", payload: { instId, ms } }),
      setRelMs: (instId, ms) => dispatch({ type: "sc/setRelMs", payload: { instId, ms } }),
    },

    sum: {
      setComp: (p) => dispatch({ type: "sum/merge", payload: { sumComp: { ...p } } }),
      setGainDb: (db) => dispatch({ type: "sum/merge", payload: { sumGainDb: db } }),
      setLimiterOn: (on) => dispatch({ type: "sum/merge", payload: { limiterOn: !!on } }),
      setMeterDb: (db) => dispatch({ type: "sum/setMeterDb", payload: db }),
    },

    patterns: {
      setAll: (p) => dispatch({ type: "patterns/setAll", payload: p }),
      setFor: (instId, value) => dispatch({ type: "patterns/setFor", payload: { instId, value } }),
      cycleStep: (instId, row, stepIdx) =>
        dispatch({ type: "patterns/cycleStep", payload: { instId, row, stepIdx } }),
      clearInstrument: (instId) =>
        dispatch({
          type: "patterns/setFor",
          payload: { instId, value: { A: new Array(STEPS_PER_BAR).fill(0), B: new Array(STEPS_PER_BAR).fill(0) } },
        }),
      clearAll: () => dispatch({ type: "patterns/setAll", payload: buildPatternMap(STEPS_PER_BAR) }),
    },

    rows: {
      setActiveFor: (instId, value /* {A,B} */) =>
        dispatch({ type: "rowActive/merge", payload: { [instId]: value } }),
    },

    ui: {
      toggleFold: (key) => dispatch({ type: "ui/toggleFold", payload: key }),
      toggleRowExpanded: (instId, row) =>
        dispatch({ type: "ui/toggleRowExpanded", payload: { instId, row } }),
      setUiLatchedRow: (map) => dispatch({ type: "ui/setUiLatchedRow", payload: map }),
    },

    sessions: {
      setDict: (sessions) => dispatch({ type: "sessions/merge", payload: { sessions } }),
      setCurrent: (name) => dispatch({ type: "sessions/merge", payload: { currentSessionName: name } }),
    },

    // Used by "New" button to reset musical state & UI folds
    resetSoft: () => dispatch({ type: "all/resetSoft" }),
  }), []);

  return { state, actions };
}
