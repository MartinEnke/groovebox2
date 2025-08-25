import React from "react";
import FoldSection from "../ui/FoldSection";

export default function FXPanel({
  show, onToggle,
  selected,

  // Delay
  instDelayWet, setInstDelayWet,
  instDelayMode, setInstDelayMode,
  updateDelaySends,

  // Reverb
  instReverbWet, setInstReverbWet,
  instRevMode, setInstRevMode,
  updateReverbSends,

  // Saturation (new)
  instSatWet, setInstSatWet,
  instSatMode, setInstSatMode,
  updateSat,
}) {
  const delayPct = instDelayWet[selected] ?? 0;
  const revPct   = instReverbWet[selected] ?? 0;
  const satPct   = instSatWet?.[selected] ?? 0;

  return (
    <FoldSection title="FX" show={show} onToggle={onToggle}>
      <div className="fx-row" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {/* Delay */}
        <div className="fx-block">
          <div className="fx-label">DLY</div>
          <input
            className="slider slider-fx"
            type="range" min={0} max={100} step={1}
            value={delayPct}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              setInstDelayWet(prev => ({ ...prev, [selected]: pct }));
              updateDelaySends(selected, pct);
            }}
            title="Delay wet (%)"
          />
          <div className="revlen-wrap">
            {[
              { key: "N16", label: "1/16" },
              { key: "N8",  label: "1/8"  },
              { key: "N3_4",label: "3/4"  },
            ].map(opt => {
              const on = instDelayMode[selected] === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`revlen-btn ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    setInstDelayMode(prev => ({ ...prev, [selected]: opt.key }));
                    updateDelaySends(selected);
                  }}
                  title={`Delay mode ${opt.label}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reverb */}
        <div className="fx-block">
          <div className="fx-label">REV</div>
          <input
            className="slider slider-fx"
            type="range" min={0} max={100} step={1}
            value={revPct}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              setInstReverbWet(prev => ({ ...prev, [selected]: pct }));
              updateReverbSends(selected, pct);
            }}
            title="Reverb wet (%)"
          />
          <div className="revlen-wrap">
            {["S","M","L"].map(m => {
              const on = instRevMode[selected] === m;
              return (
                <button
                  key={m}
                  type="button"
                  className={`revlen-btn ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    setInstRevMode(prev => ({ ...prev, [selected]: m }));
                    updateReverbSends(selected);
                  }}
                  title={m === "S" ? "Short (4 steps)" : m === "M" ? "Medium (8 steps)" : "Long (16 steps)"}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Saturation */}
        <div className="fx-block">
          <div className="fx-label">SAT</div>
          <input
            className="slider slider-fx"
            type="range" min={0} max={100} step={1}
            value={satPct}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              setInstSatWet(prev => ({ ...prev, [selected]: pct }));
              updateSat(selected, pct);
            }}
            title="Saturation amount (mix % / drive)"
          />
          <div className="revlen-wrap">
            {[
              { key: "tape", label: "Tape" },
              { key: "warm", label: "Warm" },
              { key: "hard", label: "Hard" },
            ].map(opt => {
              const on = (instSatMode?.[selected] ?? "tape") === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`revlen-btn ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    setInstSatMode(prev => ({ ...prev, [selected]: opt.key }));
                    updateSat(selected);
                  }}
                  title={`Saturation mode: ${opt.label}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </FoldSection>
  );
}
