// src/components/header/PackBar.jsx
import React, { useMemo } from "react";
import useTapGesture from "../../hooks/useTapGesture";

export default function PackBar({
  selectedPack, setSelectedPack, packLoading,
  packIds, samplePacks,
  metMode, cycleMetronomeMode,
  bpm, setBpm,
  scheme = "retro",
}) {
  const metTap = useTapGesture(() => cycleMetronomeMode?.(), { pan: "y", slop: 10 });

  // For sliders/buttons etc.
  const inputTouchProps = useMemo(
    () => ({
      style: {
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      },
    }),
    []
  );

  /**
   * SPECIAL: for <select> on iOS — ensure SINGLE TAP opens the picker.
   * - Stop parent tap guards at capture phase.
   * - On first touchend, focus() + click() to open immediately.
   * - preventDefault() to avoid the synthetic follow-up click.
   * - Mark as data-tap-exempt so any pointer-based guards skip it.
   */
  const selectTouchProps = useMemo(
    () => ({
      "data-tap-exempt": "", // recognized by useTapGesture's isExempt()
      style: {
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "auto",
        WebkitUserSelect: "auto",
        pointerEvents: "auto",
      },
      // Keep parents from swallowing the interaction
      onPointerDownCapture: (e) => e.stopPropagation(),
      onMouseDownCapture: (e) => e.stopPropagation(),
      onTouchStartCapture: (e) => e.stopPropagation(),
      // Force the native picker to open on first tap on iOS Safari
      onTouchEndCapture: (e) => {
        e.stopPropagation();
        const el = e.currentTarget; // <select>
        if (el && !el.disabled) {
          try { el.focus(); } catch {}
          try { el.click(); } catch {}
        }
        // prevent ghost click that would require a second tap
        e.preventDefault();
      },
      onClickCapture: (e) => e.stopPropagation(),
    }),
    []
  );

  const metTitle =
    metMode === "beats"
      ? "Metronome: 4 downbeats (tap for 16th)"
      : metMode === "all"
      ? "Metronome: all 16th (tap for off)"
      : "Metronome: off (tap for 4 downbeats)";

  const metLabel = metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF";

  if (scheme === "retro") {
    return (
      <div className="packbar-retro">
        <div className="packbar-line packbar-line1">
          <select
            {...selectTouchProps}
            value={selectedPack}
            onChange={(e) => setSelectedPack(e.target.value)}
            disabled={packLoading}
            title="Choose sample pack"
          >
            {packIds.map((pid) => (
              <option key={pid} value={pid}>
                {samplePacks[pid]?.label ?? pid}
              </option>
            ))}
          </select>

          <button
            type="button"
            {...metTap}
            className={`metro-btn mode-${metMode}`}
            aria-pressed={metMode !== "off"}
            title={metTitle}
          >
            {metLabel}
          </button>
        </div>

        <div className="packbar-line packbar-line2">
          <span className="bpm-label">BPM</span>
          <input
            {...inputTouchProps}
            className="slider slider-bpm"
            type="range"
            min={60}
            max={200}
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            aria-label="Tempo in BPM"
          />
          <span className="bpm-readout">{bpm}</span>
        </div>
      </div>
    );
  }

  // NEO
  return (
    <div className="packbar-neo">
      <div className="packbar-line1">
        <span className="bar-label">Pack</span>
        <select
          {...selectTouchProps}
          className="pack-select"
          value={selectedPack}
          onChange={(e) => setSelectedPack(e.target.value)}
          disabled={packLoading}
          title="Choose sample pack"
        >
          {packIds.map((pid) => (
            <option key={pid} value={pid}>
              {samplePacks[pid]?.label ?? pid}
            </option>
          ))}
        </select>

        <button
          type="button"
          {...metTap}
          className={`metro-btn mode-${metMode}`}
          aria-pressed={metMode !== "off"}
          title={metTitle}
        >
          {metLabel}
        </button>
      </div>

      <div className="packbar-line2">
        <span className="bpm-label">BPM</span>
        <input
          {...inputTouchProps}
          className="slider slider-bpm"
          type="range"
          min={60}
          max={200}
          value={bpm}
          onChange={(e) => setBpm(parseInt(e.target.value, 10))}
          aria-label="Tempo in BPM"
        />
        <span className="bpm-readout">{bpm}</span>
      </div>
    </div>
  );
}
