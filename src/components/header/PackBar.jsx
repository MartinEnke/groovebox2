// PackBar.jsx
import React from "react";

export default function PackBar({
  selectedPack, setSelectedPack, packLoading,
  packIds, samplePacks,
  metMode, cycleMetronomeMode,
  bpm, setBpm,
  scheme = "retro",
}) {
  const isRetro = scheme === "retro";

  if (isRetro) {
    // (your existing Retro return stays exactly as-is)
    return (
      <div className="packbar-retro">
        <div className="packbar-line packbar-line1">
          <select
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
            className={`metro-btn mode-${metMode}`}
            onClick={cycleMetronomeMode}
            aria-pressed={metMode !== "off"}
            title={
              metMode === "beats"
                ? "Metronome: 4 downbeats (click for 16th)"
                : metMode === "all"
                ? "Metronome: all 16th (click for off)"
                : "Metronome: off (click for 4 downbeats)"
            }
          >
            {metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF"}
          </button>
        </div>

        <div className="packbar-line packbar-line2">
          <span className="bpm-label">BPM</span>
          <input
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

  // NEO — exact order: [Pack label][select][Met] on row 1, BPM row 2
  return (
    <div className="packbar-neo">
      <div className="packbar-line1">
        <span className="bar-label">Pack</span>
        <select
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
          className={`metro-btn mode-${metMode}`}
          onClick={cycleMetronomeMode}
          aria-pressed={metMode !== "off"}
          title={
            metMode === "beats"
              ? "Metronome: 4 downbeats (click for 16th)"
              : metMode === "all"
              ? "Metronome: all 16th (click for off)"
              : "Metronome: off (click for 4 downbeats)"
          }
        >
          {metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF"}
        </button>
      </div>

      <div className="packbar-line2">
        <span className="bpm-label">BPM</span>
        <input
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
