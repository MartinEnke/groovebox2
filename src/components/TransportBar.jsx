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
  // refs to attach native capture listeners
  const playRef  = useRef(null);
  const recRef   = useRef(null);
  const delPatRef= useRef(null);
  const delAllRef= useRef(null);

  // attach capture-phase handlers so they still fire while playing
  useEffect(() => {
    const add = (el, fn) => {
      if (!el) return () => {};
      const handler = (e) => {
        // win the race; stop anything else from eating the tap
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        try { fn(); } catch {}
      };
      const opts = { capture: true, passive: false };
      el.addEventListener("pointerdown", handler, opts);
      el.addEventListener("click", handler, opts); // belt & suspenders on iOS
      return () => {
        el.removeEventListener("pointerdown", handler, opts);
        el.removeEventListener("click", handler, opts);
      };
    };

    const cleanups = [
      add(playRef.current,  togglePlay),
      add(recRef.current,   toggleRecord),
      add(delPatRef.current,clearSelectedPattern),
      add(delAllRef.current,clearAllPatternsAndLevels),
    ];
    return () => cleanups.forEach((off) => off && off());
  }, [togglePlay, toggleRecord, clearSelectedPattern, clearAllPatternsAndLevels]);

  return (
    <div
      className="transport"
      style={{ pointerEvents: "auto" }} // ensure not disabled by any ancestor
    >
      {/* Play / Stop (triangle / square) */}
      <button
        ref={playRef}
        style={btnTouchStyle}
        onPointerDown={togglePlay} // fallback
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
