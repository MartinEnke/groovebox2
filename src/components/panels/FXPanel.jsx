import React from "react";

export default function FXPanel({
  selected,
  // Delay
  instDelayWet, setInstDelayWet,
  instDelayMode, setInstDelayMode,
  updateDelaySends,
  // Reverb
  instReverbWet, setInstReverbWet,
  instRevMode, setInstRevMode,
  updateReverbSends,
}) {
  const delayPct = instDelayWet[selected] ?? 0;
  const revPct   = instReverbWet[selected] ?? 0;

  return (
    <div className="fx-row" style={{ marginTop: 8 }}>
      {/* DELAY */}
      <div className="fx-block">
        <div className="fx-label">DLY</div>

        <input
          className="slider slider-fx"
          type="range"
          min={0}
          max={100}
          step={1}
          value={delayPct}
          onChange={(e) => {
            const pct = parseInt(e.target.value, 10);
            setInstDelayWet((prev) => ({ ...prev, [selected]: pct }));
            updateDelaySends(selected, pct); // immediate audible change
          }}
          title="Delay wet (%)"
        />

        <div className="revlen-wrap">
          {[
            { key: "N16", label: "1/16" },
            { key: "N8",  label: "1/8"  },
            { key: "N3_4",label: "3/4"  },
          ].map((opt) => {
            const on = instDelayMode[selected] === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                className={`revlen-btn ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => {
                  setInstDelayMode((prev) => ({ ...prev, [selected]: opt.key }));
                  updateDelaySends(selected); // switch active bus
                }}
                title={`Delay mode ${opt.label}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* REVERB */}
      <div className="fx-block">
        <div className="fx-label">REV</div>

        <input
          className="slider slider-fx"
          type="range"
          min={0}
          max={100}
          step={1}
          value={revPct}
          onChange={(e) => {
            const pct = parseInt(e.target.value, 10);
            setInstReverbWet((prev) => ({ ...prev, [selected]: pct }));
            updateReverbSends(selected, pct); // immediate audible change
          }}
          title="Reverb wet (%)"
        />

        <div className="revlen-wrap">
          {["S", "M", "L"].map((m) => {
            const on = instRevMode[selected] === m;
            return (
              <button
                key={m}
                type="button"
                className={`revlen-btn ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => {
                  setInstRevMode((prev) => ({ ...prev, [selected]: m }));
                  updateReverbSends(selected); // switch IR bus
                }}
                title={
                  m === "S" ? "Short (4 steps)" :
                  m === "M" ? "Medium (8 steps)" :
                               "Long (16 steps)"
                }
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
