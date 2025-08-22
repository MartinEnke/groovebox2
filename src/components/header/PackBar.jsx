import React from "react";

export default function PackBar({
  selectedPack,
  setSelectedPack,
  packLoading,
  packIds,
  samplePacks,
  metMode,
  cycleMetronomeMode,
  bpm,
  setBpm,
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      {/* Pack picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 12, opacity: 0.85 }}>Pack</label>
        <select
          value={selectedPack}
          onChange={(e) => setSelectedPack(e.target.value)}
          disabled={packLoading}
          title="Choose sample pack"
          style={{
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.2)",
            color: "white",
            padding: "6px 10px",
            borderRadius: 8,
            fontWeight: 600,
            letterSpacing: 0.4,
            minWidth: 160,
          }}
        >
          {packIds.map((pid) => (
            <option key={pid} value={pid}>
              {samplePacks[pid]?.label ?? pid}
            </option>
          ))}
        </select>
        {packLoading && <span style={{ fontSize: 12, opacity: 0.7 }}>loading…</span>}
      </div>

      {/* Metronome + BPM */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className={`btn metro-btn mode-${metMode}`}
          onClick={cycleMetronomeMode}
          title={
            metMode === "beats" ? "Metronome: 4 downbeats (click for 16th)"
            : metMode === "all" ? "Metronome: all 16th (click for off)"
            : "Metronome: off (click for 4 downbeats)"
          }
        >
          {metMode === "beats" ? "MET 4" : metMode === "all" ? "MET 16" : "MET OFF"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>BPM</span>
          <input
            className="slider slider-bpm"
            type="range"
            min={60}
            max={200}
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
          />
          <span style={{ width: 32, textAlign: "right" }}>{bpm}</span>
        </div>
      </div>
    </div>
  );
}
