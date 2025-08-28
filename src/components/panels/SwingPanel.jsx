import React from "react";
import FoldSection from "../ui/FoldSection";

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
            return (
              <button
                key={opt.val}
                type="button"
                className={`sg2-btn ${active ? "on" : ""}`}
                aria-pressed={active}
                onClick={() => setInstSwingType(prev => ({ ...prev, [selected]: opt.val }))}
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
