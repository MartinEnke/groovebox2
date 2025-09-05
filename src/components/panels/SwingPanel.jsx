// src/components/panels/SwingPanel.jsx
import React from "react";
import FoldSection from "../ui/FoldSection";
import useTapGesture from "../../hooks/useTapGesture";

export default function SwingPanel({
  show, onToggle,
  selected,
  instSwingType, setInstSwingType,
  instSwingAmt,  setInstSwingAmt,
  globalSwingPct, setGlobalSwingPct,
}) {
  const type = instSwingType[selected] ?? "none";
  const amt  = instSwingAmt[selected] ?? 0;
  const isOff = type === "none";

  // touch-friendly style for sliders
  const touchInputStyle = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <FoldSection title="Groove" show={show} onToggle={onToggle}>
      <div className="swing-card compact">
        {/* INLINE selector (Off · 8 · 16 · 32) */}
        <div className="swing-grid-inline">
          {[
            { val: "none", label: "Off" },
            { val: "8",    label: "8"   },
            { val: "16",   label: "16"  },
            { val: "32",   label: "32"  },
          ].map(opt => {
            const active = type === opt.val;
            const tap = useTapGesture(() => {
              setInstSwingType(prev => ({ ...prev, [selected]: opt.val }));
            }, { pan: "y", slop: 10 });

            return (
              <button
                key={opt.val}
                type="button"
                {...tap}
                className={`sg2-btn ${active ? "on" : ""}`}
                aria-pressed={active}
                title={`Swing grid: ${opt.label}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Instrument swing (slider + LCD) */}
        <div className="swing-inline">
          <div className="fx-sublabel">INSTRUMENT SWING</div>
          <div className="swing-slider-row">
            <input
              className="slider slider-swing"
              type="range" min={0} max={100} step={1}
              value={isOff ? 0 : amt}
              onChange={(e) =>
                setInstSwingAmt(prev => ({ ...prev, [selected]: parseInt(e.target.value, 10) }))
              }
              disabled={isOff}
              title="Swing amount (%)"
              style={touchInputStyle}
            />
            <div className={`swing-lcd ${isOff ? "is-disabled" : ""}`}>
              <span className="lcd-label">&nbsp;&nbsp;</span>
              <span className="lcd-value">{isOff ? 0 : amt}%</span>
            </div>
          </div>
        </div>

        {/* Global swing (slider + LCD) */}
        <div className="swing-inline">
          <div className="fx-sublabel">GLOBAL AMOUNT</div>
          <div className="swing-slider-row">
            <input
              className="slider slider-global"
              type="range" min={0} max={150} step={1}
              value={globalSwingPct}
              onChange={(e) => setGlobalSwingPct(parseInt(e.target.value, 10))}
              title={`Global swing: ${globalSwingPct}%`}
              style={touchInputStyle}
            />
            <div className="swing-lcd swing-lcd--global">
              <span className="lcd-label">&nbsp;&nbsp;</span>
              <span className="lcd-value">{globalSwingPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </FoldSection>
  );
}
