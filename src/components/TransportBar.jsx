// src/components/TransportBar.jsx
import React from "react";
import { pad } from "../utils/misc";
import { STEPS_PER_BAR } from "../constants/sequencer";
import useTapGesture from "../hooks/useTapGesture";

export default function TransportBar({
  isPlaying,
  togglePlay,
  isRecording,
  toggleRecord,
  step,
  clearSelectedPattern,
  clearAllPatternsAndLevels,
}) {
  // Swipe-safe taps (fires on pointer UP if it wasn’t a scroll)
  const playTap = useTapGesture(() => togglePlay?.(), { trigger: "up", pan: "y", slop: 10 });
const recTap  = useTapGesture(() => toggleRecord?.(), { trigger: "up", pan: "y", slop: 10 });

const delPatTap = useTapGesture(() => {
  if (confirm("Clear the selected instrument's pattern?")) {
    clearSelectedPattern?.();
  }
}, { trigger: "up", pan: "y", slop: 10 });

const delAllTap = useTapGesture(() => {
  if (confirm("Clear ALL patterns and levels?\n\nThis cannot be undone.")) {
    clearAllPatternsAndLevels?.();
  }
}, { trigger: "up", pan: "y", slop: 10 });

  return (
    <div className="transport">
      {/* Play / Stop (triangle / square) */}
      <button
        type="button"
        {...playTap}
        className={`btn press playstop ${isPlaying ? "is-playing" : ""}`}
        aria-pressed={isPlaying}
        title={isPlaying ? "Stop" : "Play"}
      >
        <span className="tri" aria-hidden="true" />
        <span className="sq"  aria-hidden="true" />
      </button>

      {/* Record (dot only) */}
      <button
        type="button"
        {...recTap}
        className={`btn press rec ${isRecording ? "on" : ""}`}
        aria-pressed={isRecording}
        title="Record"
      >
        <span className="rec-dot" aria-hidden="true" />
      </button>

      {/* Digital step display */}
      <div className="lcd">{pad(step + 1)}/{STEPS_PER_BAR}</div>

      {/* Clear selected (Del Pat) */}
      <button
        type="button"
        {...delPatTap}
        className="btn press clear-btn pat"
        title="Clear selected instrument"
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Clear all (Del All) */}
      <button
        type="button"
        {...delAllTap}
        className="btn press clear-btn all"
        title="Clear all"
      >
        <span className="sym">Del All</span>
      </button>
    </div>
  );
}
