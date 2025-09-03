import React from "react";
import { pad } from "../utils/misc";
import { STEPS_PER_BAR } from "../constants/sequencer";

const btnTouchProps = {
  style: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
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
  return (
    <div className="transport">
      {/* Play / Stop (triangle / square) */}
      <button
        {...btnTouchProps}
        onPointerDown={togglePlay}
        className={`btn press playstop ${isPlaying ? "is-playing" : ""}`}
        aria-pressed={isPlaying}
        title={isPlaying ? "Stop" : "Play"}
      >
        <span className="tri" aria-hidden="true"></span>
        <span className="sq" aria-hidden="true"></span>
      </button>

      {/* Record (dot only) */}
      <button
        {...btnTouchProps}
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
        {...btnTouchProps}
        onPointerDown={clearSelectedPattern}
        className="btn press clear-btn pat"
        title="Clear selected instrument"
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Clear all (Del All) */}
      <button
        {...btnTouchProps}
        onPointerDown={clearAllPatternsAndLevels}
        className="btn press clear-btn all"
        title="Clear all"
      >
        <span className="sym">Del All</span>
      </button>
    </div>
  );
}
