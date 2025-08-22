import React, { useMemo } from "react";
import FoldSection from "../ui/FoldSection";
import { INSTRUMENTS } from "../../constants/instruments";
import { MAX_SC_LINKS } from "../../constants/sequencer";

export default function SidechainPanel({
  show, onToggle,
  selected,
  scMatrix, setScMatrix,
  scAmtDb, setScAmtDb,
  scAtkMs, setScAtkMs,
  scRelMs, setScRelMs,
}) {
  const selectedRow = scMatrix[selected] || {};

  const totalLinks = useMemo(() => {
    return Object.values(scMatrix).reduce(
      (acc, row) => acc + Object.values(row).filter(Boolean).length,
      0
    );
  }, [scMatrix]);

  const capReached = totalLinks >= MAX_SC_LINKS;
  const selectedLabel = INSTRUMENTS.find(i => i.id === selected)?.label ?? selected;

  return (
    <FoldSection title="Sidechain" show={show} onToggle={onToggle} centerAlways>
      <div className="fx-block" style={{ marginTop: 8 }}>
        <div className="fx-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, opacity: .8 }}>
            Links: {totalLinks}/{MAX_SC_LINKS}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,auto)", gap: 6, marginBottom: 8 }}>
          {INSTRUMENTS.map(tr => {
            if (tr.id === selected) return null;
            const on = !!selectedRow[tr.id];
            const disabled = !on && capReached;
            const title = on
              ? `Disable: duck ${selectedLabel} on ${tr.label}`
              : disabled ? `Max ${MAX_SC_LINKS} links reached`
                         : `Enable: duck ${selectedLabel} on ${tr.label}`;

            return (
              <button
                key={`sc-${selected}-${tr.id}`}
                type="button"
                className={`revlen-btn ${on ? "on" : ""}`}
                aria-pressed={on}
                disabled={disabled}
                onClick={() => {
                  const nextOn = !on;
                  if (nextOn && capReached) return;
                  setScMatrix(prev => ({
                    ...prev,
                    [selected]: { ...(prev[selected] || {}), [tr.id]: nextOn }
                  }));
                }}
                title={title}
                style={disabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
              >
                {tr.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <div className="fx-sublabel">AMT</div>
            <input className="slider slider-fx" type="range" min={0} max={24} step={0.5}
              value={scAmtDb[selected]}
              onChange={(e)=> setScAmtDb(prev => ({ ...prev, [selected]: parseFloat(e.target.value) }))}
              title="Duck amount (dB)"
            />
          </div>
          <div>
            <div className="fx-sublabel">ATK</div>
            <input className="slider slider-fx" type="range" min={0} max={60} step={1}
              value={scAtkMs[selected]}
              onChange={(e)=> setScAtkMs(prev => ({ ...prev, [selected]: parseInt(e.target.value,10) }))}
              title="Attack (ms)"
            />
          </div>
          <div>
            <div className="fx-sublabel">REL</div>
            <input className="slider slider-fx" type="range" min={20} max={600} step={5}
              value={scRelMs[selected]}
              onChange={(e)=> setScRelMs(prev => ({ ...prev, [selected]: parseInt(e.target.value,10) }))}
              title="Release (ms)"
            />
          </div>
        </div>
      </div>
    </FoldSection>
  );
}
