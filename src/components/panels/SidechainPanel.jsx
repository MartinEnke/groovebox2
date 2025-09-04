// src/components/fx/SidechainPanel.jsx
import React, { useMemo } from "react";
import FoldSection from "../ui/FoldSection";
import { INSTRUMENTS } from "../../constants/instruments";
import { MAX_SC_LINKS } from "../../constants/sequencer";
import useTapGesture from "../../hooks/useTapGesture";

const HIDDEN_TARGETS = new Set(["ride"]); // hide Ride

export default function SidechainPanel({
  show, onToggle,
  selected,
  scMatrix, setScMatrix,
  scAmtDb, setScAmtDb,
  scAtkMs, setScAtkMs,
  scRelMs, setScRelMs,
}) {
  const selectedRow = scMatrix[selected] || {};

  // Only visible targets (no Ride)
  const TARGETS = useMemo(
    () => INSTRUMENTS.filter((tr) => !HIDDEN_TARGETS.has(tr.id)),
    []
  );

  // Count only visible links so cap matches UI
  const totalLinks = useMemo(() => {
    return Object.values(scMatrix).reduce((acc, row) => {
      return (
        acc +
        Object.entries(row || {}).filter(([k, v]) => v && !HIDDEN_TARGETS.has(k)).length
      );
    }, 0);
  }, [scMatrix]);

  const capReached = totalLinks >= MAX_SC_LINKS;
  const selectedLabel = INSTRUMENTS.find((i) => i.id === selected)?.label ?? selected;

  // touch-friendly style for sliders / native inputs
  const touchInputStyle = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <FoldSection title="Sidechain" show={show} onToggle={onToggle} centerAlways>
      <div className="fx-block sc-panel">
        {/* header/counter */}
        <div className="sc-header">
          <span className="sc-counter" title="Total sidechain links">
            Links: {totalLinks}/{MAX_SC_LINKS}
          </span>
        </div>

        {/* targets grid (Ride omitted) */}
        <div className="sc-targets">
          {TARGETS.map((tr) => {
            if (tr.id === selected) return null; // don’t target self
            const on = !!selectedRow[tr.id];
            const disabled = !on && capReached;

            const title = on
              ? `Disable: duck ${selectedLabel} on ${tr.label}`
              : disabled
              ? `Max ${MAX_SC_LINKS} links reached`
              : `Enable: duck ${selectedLabel} on ${tr.label}`;

            return (
              <ScTargetButton
                key={`sc-${selected}-${tr.id}`}
                tr={tr}
                selected={selected}
                on={on}
                disabled={disabled}
                capReached={capReached}
                setScMatrix={setScMatrix}
                title={title}
              />
            );
          })}
        </div>

        {/* sliders row */}
        <div className="sc-params">
          <div className="sc-param">
            <div className="fx-sublabel">AMT</div>
            <input
              className="slider slider-fx"
              type="range"
              min={0}
              max={24}
              step={0.5}
              value={scAmtDb[selected]}
              onChange={(e) =>
                setScAmtDb((prev) => ({ ...prev, [selected]: parseFloat(e.target.value) }))
              }
              title="Duck amount (dB)"
              style={touchInputStyle}
            />
          </div>

          <div className="sc-param">
            <div className="fx-sublabel">ATK</div>
            <input
              className="slider slider-fx"
              type="range"
              min={0}
              max={60}
              step={1}
              value={scAtkMs[selected]}
              onChange={(e) =>
                setScAtkMs((prev) => ({ ...prev, [selected]: parseInt(e.target.value, 10) }))
              }
              title="Attack (ms)"
              style={touchInputStyle}
            />
          </div>

          <div className="sc-param">
            <div className="fx-sublabel">REL</div>
            <input
              className="slider slider-fx"
              type="range"
              min={20}
              max={600}
              step={5}
              value={scRelMs[selected]}
              onChange={(e) =>
                setScRelMs((prev) => ({ ...prev, [selected]: parseInt(e.target.value, 10) }))
              }
              title="Release (ms)"
              style={touchInputStyle}
            />
          </div>
        </div>
      </div>
    </FoldSection>
  );
}

/** Individual SC target button wrapped with tap-vs-scroll guard */
function ScTargetButton({
  tr,
  selected,
  on,
  disabled,
  capReached,
  setScMatrix,
  title,
}) {
  const tap = useTapGesture(() => {
    if (disabled) return;
    const nextOn = !on;
    if (nextOn && capReached) return;
    setScMatrix((prev) => ({
      ...prev,
      [selected]: { ...(prev[selected] || {}), [tr.id]: nextOn },
    }));
  }, { pan: "y", slop: 10 });

  return (
    <button
      type="button"
      {...tap}
      className={`revlen-btn sc-btn ${on ? "on" : ""}`}
      aria-pressed={on}
      disabled={disabled}
      title={title}
    >
      {tr.label}
    </button>
  );
}
