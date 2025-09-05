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
  // Play/Stop: fire immediately on pointerdown, no swipe guard
  const playTap = useTapGesture(() => togglePlay?.(), {
    trigger: "down",
    pan: "none",
  });

  // Record can stay instant too
  const recTap = useTapGesture(() => toggleRecord?.(), {
    trigger: "down",
    pan: "none",
  });

  // (keep your existing 'up' guard on the delete buttons if you want)
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
      {/* Play / Stop */}
      <button
        type="button"
        {...playTap}
        // hard-override touchAction for this button to avoid scroll cancellation
        style={{ ...(playTap.style || {}), touchAction: "none" }}
        className={`btn press playstop ${isPlaying ? "is-playing" : ""}`}
        aria-pressed={isPlaying}
        title={isPlaying ? "Stop" : "Play"}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="tri" aria-hidden="true" />
        <span className="sq"  aria-hidden="true" />
      </button>

      {/* Record */}
      <button
        type="button"
        {...recTap}
        style={{ ...(recTap.style || {}), touchAction: "none" }}
        className={`btn press rec ${isRecording ? "on" : ""}`}
        aria-pressed={isRecording}
        title="Record"
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="rec-dot" aria-hidden="true" />
      </button>

      {/* LCD */}
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
