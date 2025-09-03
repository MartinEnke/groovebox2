import React, { useEffect, useRef } from "react";
import { pad } from "../utils/misc";
import { STEPS_PER_BAR } from "../constants/sequencer";

const btnTouchStyle = {
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  userSelect: "none",
  WebkitUserSelect: "none",
};

export default function TransportBar({
  isPlaying,                // boolean
  togglePlay,               // () => void
  isRecording,              // boolean
  toggleRecord,             // () => void
  step,                     // number (0-based)
  clearSelectedPattern,     // () => void
  clearAllPatternsAndLevels // () => void
}) {
  // container + button refs
  const wrapRef   = useRef(null);
  const playRef   = useRef(null);
  const recRef    = useRef(null);
  const delPatRef = useRef(null);
  const delAllRef = useRef(null);

  // Window-capture router: even if an overlay steals the event, we grab it first,
  // hit-test against our buttons, and invoke the right action.
  useEffect(() => {
    const container = wrapRef.current;
    if (!container) return;

    const within = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    const hit = (el, x, y) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return within(r, x, y);
    };

    const handler = (e) => {
      // capture-phase, before anyone else
      const x = e.clientX;
      const y = e.clientY;

      const cr = container.getBoundingClientRect();
      if (!within(cr, x, y)) return; // outside transport — ignore

      // This *is* our transport region → don't let overlays consume it
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      // Route to the specific control by geometry
      if (hit(playRef.current, x, y))       { try { togglePlay(); } catch {} return; }
      if (hit(recRef.current, x, y))        { try { toggleRecord(); } catch {} return; }
      if (hit(delPatRef.current, x, y))     { try { clearSelectedPattern(); } catch {} return; }
      if (hit(delAllRef.current, x, y))     { try { clearAllPatternsAndLevels(); } catch {} return; }
      // If you later add more buttons, add them here.
    };

    const opts = { capture: true, passive: false };
    window.addEventListener("pointerdown", handler, opts);
    window.addEventListener("click", handler, opts); // iOS belt & suspenders
    return () => {
      window.removeEventListener("pointerdown", handler, opts);
      window.removeEventListener("click", handler, opts);
    };
  }, [togglePlay, toggleRecord, clearSelectedPattern, clearAllPatternsAndLevels]);

  return (
    <div
      ref={wrapRef}
      className="transport"
      style={{
        position: "relative",       // create stacking context
        zIndex: 100000,             // sit above any accidental overlay
        pointerEvents: "auto",
      }}
    >
      {/* Play / Stop (triangle / square) */}
      <button
        ref={playRef}
        style={btnTouchStyle}
        onPointerDown={togglePlay} // fallback if nothing overlays
        className={`btn press playstop ${isPlaying ? "is-playing" : ""}`}
        aria-pressed={isPlaying}
        title={isPlaying ? "Stop" : "Play"}
      >
        <span className="tri" aria-hidden="true"></span>
        <span className="sq" aria-hidden="true"></span>
      </button>

      {/* Record (dot only) */}
      <button
        ref={recRef}
        style={btnTouchStyle}
        onPointerDown={toggleRecord}
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
        ref={delPatRef}
        style={btnTouchStyle}
        onPointerDown={clearSelectedPattern}
        className="btn press clear-btn pat"
        title="Clear selected instrument"
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Clear all (Del All) */}
      <button
        ref={delAllRef}
        style={btnTouchStyle}
        onPointerDown={clearAllPatternsAndLevels}
        className="btn press clear-btn all"
        title="Clear all"
      >
        <span className="sym">Del All</span>
      </button>
    </div>
  );
}
