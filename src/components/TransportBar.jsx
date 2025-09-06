// src/components/TransportBar.jsx
import React, { useMemo } from "react";
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
  /**
   * Make single-tap rock solid on mobile:
   * - Fire play/record immediately on pointerdown (no swipe guard).
   * - Stop propagation at capture phase so no parent tap-guards interfere.
   * - On touchend, prevent the synthetic click (ghost click).
   */
  const tapCaptureDownProps = useMemo(
    () => ({
      onPointerDownCapture: (e) => e.stopPropagation(),
      onTouchStartCapture:  (e) => e.stopPropagation(),
      onTouchEndCapture:    (e) => { e.stopPropagation(); e.preventDefault(); },
      onClickCapture:       (e) => e.stopPropagation(),
    }),
    []
  );

  /**
   * For confirm-style deletes we still use the safer "up" trigger,
   * but we also guard against parent handlers and ghost clicks.
   */
  const tapCaptureUpProps = useMemo(
    () => ({
      onPointerDownCapture: (e) => e.stopPropagation(),
      onTouchStartCapture:  (e) => e.stopPropagation(),
      onTouchEndCapture:    (e) => { e.stopPropagation(); e.preventDefault(); },
      onClickCapture:       (e) => e.stopPropagation(),
    }),
    []
  );

  // Play/Stop: fire immediately on pointerdown, no swipe guard
  const playTap = useTapGesture(() => togglePlay?.(), {
    trigger: "down",
    pan: "none",
  });

  // Record: instant as well
  const recTap = useTapGesture(() => toggleRecord?.(), {
    trigger: "down",
    pan: "none",
  });

  // Delete selected pattern (safer on "up")
  const delPatTap = useTapGesture(() => {
    if (confirm("Clear the selected instrument's pattern?")) {
      clearSelectedPattern?.();
    }
  }, { trigger: "up", pan: "y", slop: 10 });

  // Delete ALL
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
        {...tapCaptureDownProps}
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
        {...tapCaptureDownProps}
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
        {...tapCaptureUpProps}
        {...delPatTap}
        className="btn press clear-btn pat"
        title="Clear selected instrument"
      >
        <span className="sym">Del Pat</span>
      </button>

      {/* Del All */}
      <button
        type="button"
        {...tapCaptureUpProps}
        {...delAllTap}
        className="btn press clear-btn all"
        title="Clear all"
      >
        <span className="sym">Del All</span>
      </button>
    </div>
  );
}
