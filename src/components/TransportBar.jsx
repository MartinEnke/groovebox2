// src/components/TransportBar.jsx
import React from "react";
import { pad } from "../utils/misc";
import { STEPS_PER_BAR } from "../constants/sequencer";

export default function TransportBar({
  isPlaying,
  togglePlay,
  isRecording,
  toggleRecord,
  step,
  clearSelectedPattern,
  clearAllPatternsAndLevels,
}) {
  // Down-only tap helper: fire on pointerdown, then eat the synthetic click.
  const downOnlyTap = (fn) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn?.();
    },
    onClickCapture: (e) => { e.preventDefault(); e.stopPropagation(); },
    onClick:        (e) => { e.preventDefault(); e.stopPropagation(); },
    style: {
      touchAction: "none",                 // no gesture interpretation; fastest tap
      WebkitTapHighlightColor: "transparent",
      userSelect: "none",
      WebkitUserSelect: "none",
    },
  });

  return (
    <div className="transport">
      {/* Play / Stop */}
      <button
        type="button"
        {...downOnlyTap(togglePlay)}
        className={`btn press playstop ${isPlaying ? "is-playing" : ""}`}
        aria-pressed={isPlaying}
        title={isPlaying ? "Stop" : "Play"}
      >
        <span className="tri" aria-hidden="true" />
        <span className="sq"  aria-hidden="true" />
      </button>

      {/* Record */}
      <button
        type="button"
        className={`btn press rec ${isRecording ? "on" : ""}`}
        aria-pressed={isRecording}
        title="Record"
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleRecord?.(); }}
        onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
      >
        <span className="rec-dot" aria-hidden="true" />
      </button>

      {/* Step LCD */}
      <div className="lcd">
        {pad(step + 1)}/{STEPS_PER_BAR}
      </div>

      {/* Del Pat */}
      <button
        type="button"
        className="btn press clear-btn pat"
        title="Clear selected instrument"
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          if (confirm("Clear the selected instrument's pattern?")) clearSelectedPattern?.();
        }}
        onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ touchAction: "none" }}
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Del All */}
      <button
        type="button"
        className="btn press clear-btn all"
        title="Clear all"
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          if (confirm("Clear ALL patterns and levels?\n\nThis cannot be undone.")) {
            clearAllPatternsAndLevels?.();
          }
        }}
        onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ touchAction: "none" }}
      >
        <span className="sym">Del All</span>
      </button>
    </div>
  );
}
