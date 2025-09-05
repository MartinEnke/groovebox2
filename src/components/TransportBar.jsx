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
  // Use trigger:'down' so the action fires immediately on first tap.
  // pan:'none' => no swipe guard (we don’t want scroll to cancel these).
  const playTap = useTapGesture(() => togglePlay?.(), {
    trigger: "down",
    pan: "none",
  });

  const recTap = useTapGesture(() => toggleRecord?.(), {
    trigger: "down",
    pan: "none",
  });

  const delPatTap = useTapGesture(() => {
    if (confirm("Clear the selected instrument's pattern?")) {
      clearSelectedPattern?.();
    }
  }, { trigger: "down", pan: "none" });

  const delAllTap = useTapGesture(() => {
    if (confirm("Clear ALL patterns and levels?\n\nThis cannot be undone.")) {
      clearAllPatternsAndLevels?.();
    }
  }, { trigger: "down", pan: "none" });

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
        <span className="sq" aria-hidden="true" />
      </button>

      {/* Record */}
      <button
        type="button"
        {...recTap}
        className={`btn press rec ${isRecording ? "on" : ""}`}
        aria-pressed={isRecording}
        title="Record"
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
        {...delPatTap}
        className="btn press clear-btn pat"
        title="Clear selected instrument"
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Del All */}
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
