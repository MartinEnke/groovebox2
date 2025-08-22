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
      <div style={{ marginTop: 8, width: "100%" }}>
        <div className="swing-row">
          <div className="swing-grid-2x2">
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
                  className={`sg2-btn ${active ? "on" : "off"}`}
                  aria-pressed={active}
                  onClick={() => setInstSwingType(prev => ({ ...prev, [selected]: opt.val }))}
                  title={`Swing grid: ${opt.label}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="swing-block">
            <input className="slider slider-swing" type="range" min={0} max={100} step={1}
              value={isOff ? 0 : amt}
              onChange={(e) => setInstSwingAmt(prev => ({ ...prev, [selected]: parseInt(e.target.value, 10) }))}
              disabled={isOff}
              title="Swing amount (%)"
            />
            <div className="swing-lcd">
              <span className="lcd-label">SWING&nbsp;&nbsp;</span>
              <span className="lcd-value">{isOff ? 0 : amt}%</span>
            </div>
          </div>

          <div className="swing-global">
            <input className="slider slider-global" type="range" min={0} max={150} step={1}
              value={globalSwingPct}
              onChange={(e) => setGlobalSwingPct(parseInt(e.target.value, 10))}
              title={`Global swing: ${globalSwingPct}%`}
            />
            <div className="swing-lcd swing-lcd--global">
              <span className="lcd-label">GLOBAL&nbsp;&nbsp;</span>
              <span className="lcd-value">{globalSwingPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </FoldSection>
  );
}
