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
   * Single-tap friendly capture props for instant buttons:
   * - NO stopPropagation on pointerdown/touchstart (lets trigger:"down" fire)
   * - Prevent ghost click on touchend
   * - Mark as data-tap-exempt so parent tap guards ignore these buttons
   */
  const tapCaptureDownProps = useMemo(
    () => ({
      "data-tap-exempt": "",
      onTouchEndCapture: (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      onClickCapture: (e) => e.stopPropagation(),
      // intentionally no onPointerDownCapture / onTouchStartCapture
    }),
    []
  );

  /**
   * For confirm-style deletes (trigger on "up"):
   * keep the safer capture stops so parents don't eat the tap,
   * and prevent the ghost click.
   */
  const tapCaptureUpProps = useMemo(
    () => ({
      "data-tap-exempt": "",
      onPointerDownCapture: (e) => e.stopPropagation(),
      onTouchStartCapture:  (e) => e.stopPropagation(),
      onTouchEndCapture:    (e) => { e.preventDefault(); e.stopPropagation(); },
      onClickCapture:       (e) => e.stopPropagation(),
    }),
    []
  );

  // Play/Stop: fire immediately on pointerdown
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
        // avoid scroll interference for this control
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
