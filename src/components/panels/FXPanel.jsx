// src/components/fx/FXPanel.jsx
import React from "react";
import FoldSection from "../ui/FoldSection";
import useTapGesture from "../../hooks/useTapGesture";

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

  // Saturation
  instSatWet, setInstSatWet,
  instSatMode, setInstSatMode,
  updateSat,
}) {
  const delayPct = instDelayWet[selected] ?? 0;
  const revPct   = instReverbWet[selected] ?? 0;
  const satPct   = instSatWet?.[selected] ?? 0;

  // touch-friendly style for sliders / native inputs
  const touchInputStyle = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <FoldSection title="FX" show={show} onToggle={onToggle} centerAlways>
      <div className="fx-row fx-panel three">
        {/* Delay */}
        <div className="fx-block">
          <div className="fx-label">DELAY</div>
          <input
            className="slider slider-fx"
            type="range"
            min={0}
            max={100}
            step={1}
            value={delayPct}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              setInstDelayWet(prev => ({ ...prev, [selected]: pct }));
              updateDelaySends(selected, pct);
            }}
            title="Delay wet (%)"
            style={touchInputStyle}
          />
          <div className="revlen-wrap">
            {[
              { key: "N16", label: "1/16" },
              { key: "N8",  label: "1/8"  },
              { key: "N3_4",label: "3/4"  },
            ].map(opt => {
              const on = instDelayMode[selected] === opt.key;
              return (
                <FXToggleButton
                  key={opt.key}
                  on={on}
                  title={`Delay mode ${opt.label}`}
                  onTap={() => {
                    setInstDelayMode(prev => ({ ...prev, [selected]: opt.key }));
                    updateDelaySends(selected);
                  }}
                >
                  {opt.label}
                </FXToggleButton>
              );
            })}
          </div>
        </div>

        {/* Reverb */}
        <div className="fx-block">
          <div className="fx-label">REVERB</div>
          <input
            className="slider slider-fx"
            type="range"
            min={0}
            max={100}
            step={1}
            value={revPct}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              setInstReverbWet(prev => ({ ...prev, [selected]: pct }));
              updateReverbSends(selected, pct);
            }}
            title="Reverb wet (%)"
            style={touchInputStyle}
          />
          <div className="revlen-wrap">
            {["S","M","L"].map(m => {
              const on = instRevMode[selected] === m;
              return (
                <FXToggleButton
                  key={m}
                  on={on}
                  title={m === "S" ? "Short (4 steps)" : m === "M" ? "Medium (8 steps)" : "Long (16 steps)"}
                  onTap={() => {
                    setInstRevMode(prev => ({ ...prev, [selected]: m }));
                    updateReverbSends(selected);
                  }}
                >
                  {m}
                </FXToggleButton>
              );
            })}
          </div>
        </div>

        {/* Saturation */}
        <div className="fx-block">
          <div className="fx-label">SATURATION</div>
          <input
            className="slider slider-fx"
            type="range"
            min={0}
            max={100}
            step={1}
            value={satPct}
            onChange={(e) => {
              const pct = parseInt(e.target.value, 10);
              setInstSatWet(prev => ({ ...prev, [selected]: pct }));
              updateSat(selected, pct);
            }}
            title="Saturation amount (mix % / drive)"
            style={touchInputStyle}
          />
          <div className="revlen-wrap">
            {[
              { key: "tape", label: "Tape" },
              { key: "warm", label: "Warm" },
              { key: "hard", label: "Hard" },
            ].map(opt => {
              const on = (instSatMode?.[selected] ?? "tape") === opt.key;
              return (
                <FXToggleButton
                  key={opt.key}
                  on={on}
                  title={`Saturation mode: ${opt.label}`}
                  onTap={() => {
                    setInstSatMode(prev => ({ ...prev, [selected]: opt.key }));
                    updateSat(selected);
                  }}
                >
                  {opt.label}
                </FXToggleButton>
              );
            })}
          </div>
        </div>
      </div>
    </FoldSection>
  );
}

/** Generic FX toggle button with tap-vs-scroll guard */
function FXToggleButton({ on, title, onTap, children }) {
  // Scroll-safe, one-tap (same settings as Sidechain’s buttons)
  const tap = useTapGesture(onTap, { pan: "y", slop: 10 });

  return (
    <button
      type="button"
      {...tap}
      className={`revlen-btn ${on ? "on" : ""}`}
      aria-pressed={on}
      title={title}
    >
      {children}
    </button>
  );
}
