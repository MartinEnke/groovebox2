// src/components/TransportBar.jsx
import React, { useMemo, useRef, useCallback } from "react";
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
   * Instant mobile-friendly press behavior:
   * - Fire on touchstart (prevents any delay).
   * - Suppress the subsequent synthetic click (ghost click).
   * - Also handle pointer/mouse for desktop.
   */
  const useInstantPress = (onPress) => {
    const suppressClickRef = useRef(false);

    const onTouchStart = useCallback((e) => {
      // First, stop the gesture from bubbling to any global tap guards
      e.stopPropagation();
      // Prevent the follow-up click
      e.preventDefault();
      suppressClickRef.current = true;

      onPress?.();
    }, [onPress]);

    const onPointerDown = useCallback((e) => {
      // If this came from touch, we already handled it on touchstart
      if (e.pointerType === "touch") return;
      onPress?.();
    }, [onPress]);

    const onMouseDown = useCallback((e) => {
      // Safety for non-pointer browsers
      onPress?.();
    }, [onPress]);

    const onClickCapture = useCallback((e) => {
      if (suppressClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickRef.current = false;
      }
    }, []);

    return {
      "data-tap-exempt": "",
      onTouchStart,
      onPointerDown,
      onMouseDown,
      onClickCapture,
      onContextMenu: (e) => e.preventDefault(),
      style: {
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      },
    };
  };

  const playPress = useInstantPress(() => togglePlay?.());
  const recPress  = useInstantPress(() => toggleRecord?.());

  /**
   * Delete buttons: keep tap guard on "up" (with small slop) + capture stops
   * so they work with a single tap and don’t get swallowed by parents.
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
        {...playPress}
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
        {...recPress}
        className={`btn press rec ${isRecording ? "on" : ""}`}
        aria-pressed={isRecording}
        title="Record"
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
