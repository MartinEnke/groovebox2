import React from "react";

export default function PackBar({
  selectedPack, setSelectedPack, packLoading,
  packIds, samplePacks,
  metMode, cycleMetronomeMode,
  bpm, setBpm,
  scheme = "retro", setScheme,
}) {
  const isRetro = scheme === "retro";

  if (isRetro) {
    // RETRO: Met next to Pack (row 1), BPM on its own row (row 2)
    return (
      <div className="packbar-retro">
        {/* Row 1 — Pack + Met */}
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
            title={
              metMode === "beats"
                ? "Metronome: 4 downbeats (click for 16th)"
                : metMode === "all"
                ? "Metronome: all 16th (click for off)"
                : "Metronome: off (click for 4 downbeats)"
            }
            aria-pressed={metMode !== "off"}
          >
            {metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF"}
          </button>
        </div>

        {/* Row 2 — BPM slider + readout */}
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

  /* === NEO / default === (your original) */
  const wrapStyle   = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
  const leftStyle   = { display: "flex", alignItems: "center", gap: 8 };
  const selectStyle = {
    background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)",
    color: "white", padding: "6px 10px", borderRadius: 8, fontWeight: 600, letterSpacing: 0.4, minWidth: 160,
  };
  const rightStyle  = { display: "flex", alignItems: "center", gap: 12 };

  return (
    <div className="packbar" style={wrapStyle}>
      <div className="packbar__group" style={leftStyle}>
        <label className="packbar__label" style={{ fontSize: 12, opacity: 0.85 }}>
          Pack
        </label>
        <div className="select-wrap">
          <select
            value={selectedPack}
            onChange={(e) => setSelectedPack(e.target.value)}
            disabled={packLoading}
            title="Choose sample pack"
            className="select"
            style={selectStyle}
          >
            {packIds.map((pid) => (
              <option key={pid} value={pid}>{samplePacks[pid]?.label ?? pid}</option>
            ))}
          </select>
          {packLoading && (
            <span className="hint" style={{ fontSize: 12, opacity: 0.7 }}>
              loading…
            </span>
          )}
        </div>
      </div>

      <div className="packbar__group packbar__group--controls" style={rightStyle}>
        <button
          className={`btn metro-btn mode-${metMode}`}
          onClick={cycleMetronomeMode}
          title={
            metMode === "beats" ? "Metronome: 4 downbeats (click for 16th)"
            : metMode === "all" ? "Metronome: all 16th (click for off)"
            : "Metronome: off (click for 4 downbeats)"
          }
          aria-pressed={metMode !== "off"}
        >
          {metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF"}
        </button>

        <div className="bpm-wrap" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bpm-label">BPM</span>
          <input
            className="slider slider-bpm"
            type="range" min={60} max={200}
            value={bpm} onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            aria-label="Tempo in BPM"
          />
          <span className="bpm-readout" style={{ width: 32, textAlign: "right" }}>
            {bpm}
          </span>
        </div>
      </div>
    </div>
  );
}
