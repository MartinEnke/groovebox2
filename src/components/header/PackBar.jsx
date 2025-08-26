import React from "react";

export default function PackBar({
  selectedPack, setSelectedPack, packLoading,
  packIds, samplePacks,
  metMode, cycleMetronomeMode,
  bpm, setBpm,
  scheme = "retro", setScheme,
}) {
  const isRetro = scheme === "retro";

  // Original inline styles for Retro (unchanged)
  const wrapStyle   = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
  const leftStyle   = { display: "flex", alignItems: "center", gap: 8 };
  const selectStyle = {
    background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)",
    color: "white", padding: "6px 10px", borderRadius: 8, fontWeight: 600, letterSpacing: 0.4, minWidth: 160,
  };
  const rightStyle  = { display: "flex", alignItems: "center", gap: 12 };

  return (
    <div className={isRetro ? "" : "packbar"} style={isRetro ? wrapStyle : undefined}>
      <div className={isRetro ? "" : "packbar__group"} style={isRetro ? leftStyle : undefined}>
        <label className={isRetro ? "" : "packbar__label"} style={isRetro ? { fontSize: 12, opacity: 0.85 } : undefined}>
          Pack
        </label>
        <div className={isRetro ? "" : "select-wrap"}>
          <select
            value={selectedPack}
            onChange={(e) => setSelectedPack(e.target.value)}
            disabled={packLoading}
            title="Choose sample pack"
            className={isRetro ? "" : "select"}
            style={isRetro ? selectStyle : undefined}
          >
            {packIds.map((pid) => (
              <option key={pid} value={pid}>{samplePacks[pid]?.label ?? pid}</option>
            ))}
          </select>
          {packLoading && (
            <span className={isRetro ? "" : "hint"} style={isRetro ? { fontSize: 12, opacity: 0.7 } : undefined}>
              loading…
            </span>
          )}
        </div>
      </div>

      <div className={isRetro ? "" : "packbar__group packbar__group--controls"} style={isRetro ? rightStyle : undefined}>
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

        <div className={isRetro ? "" : "bpm-wrap"} style={isRetro ? { display: "flex", alignItems: "center", gap: 8 } : undefined}>
          <span className={isRetro ? "" : "bpm-label"}>BPM</span>
          <input
            className="slider slider-bpm"
            type="range" min={60} max={200}
            value={bpm} onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            aria-label="Tempo in BPM"
          />
          <span className={isRetro ? "" : "bpm-readout"} style={isRetro ? { width: 32, textAlign: "right" } : undefined}>
            {bpm}
          </span>
        </div>

        
      </div>
    </div>
  );
}
