// StepEditor.jsx
import React, { memo, useMemo } from "react";

const btnTouchProps = {
  style: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
};

const onKeyActivate = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
};

export default function StepEditor({
  patterns,
  selected,
  rowActive,
  toggleRowActiveUI,
  rowExpanded,
  toggleRowExpanded,
  uiLatchedRow,
  step,
  cycleStepRow,
}) {
  const pattA = useMemo(() => patterns[selected]?.A ?? Array(16).fill(0), [patterns, selected]);
  const pattB = useMemo(() => patterns[selected]?.B ?? Array(16).fill(0), [patterns, selected]);

  return (
    <div className="step-editor" style={{ marginTop: 24 }}>
      <Row
        row="A"
        values={pattA}
        isRowOn={!!rowActive[selected]?.A}
        expanded={!!rowExpanded[selected]?.A}
        latchedRow={uiLatchedRow[selected] || "A"}
        step={step}
        onToggleRow={() => toggleRowActiveUI(selected, "A")}
        onToggleExpand={() => toggleRowExpanded(selected, "A")}
        onCycleStep={(i) => cycleStepRow("A", i)}
      />
      <Row
        row="B"
        values={pattB}
        isRowOn={!!rowActive[selected]?.B}
        expanded={!!rowExpanded[selected]?.B}
        latchedRow={uiLatchedRow[selected] || "A"}
        step={step}
        onToggleRow={() => toggleRowActiveUI(selected, "B")}
        onToggleExpand={() => toggleRowExpanded(selected, "B")}
        onCycleStep={(i) => cycleStepRow("B", i)}
        topMargin={14}
      />
    </div>
  );
}

const Row = memo(function Row({
  row, values, isRowOn, expanded, latchedRow, step,
  onToggleRow, onToggleExpand, onCycleStep, topMargin = 0,
}) {
  return (
    <div className="step-row" style={{ marginTop: topMargin }}>
      <div className="row-head">
        {/* A/B toggle — fast tap + keyboard */}
        <button
          type="button"
          {...btnTouchProps}
          className="btn btn-ab"
          onPointerDown={onToggleRow}
          onKeyDown={onKeyActivate(onToggleRow)}
          aria-pressed={isRowOn}
          title={`Row ${row} ${isRowOn ? "On" : "Off"}`}
          style={{
            ...btnTouchProps.style,
            background: isRowOn ? "#059669" : "#333",
            fontWeight: 800,
          }}
        >
          {row}
        </button>

        <div style={{ flex: 1 }} />

        {/* Chevron expand — fast tap + keyboard */}
        <button
          type="button"
          {...btnTouchProps}
          className={`btn btn-ab-chevron ${expanded ? "open" : ""}`}
          onPointerDown={onToggleExpand}
          onKeyDown={onKeyActivate(onToggleExpand)}
          aria-expanded={expanded}
          title={expanded ? "Collapse (1×16)" : "Expand (2×8 large)"}
          style={btnTouchProps.style}
        >
          ▾
        </button>
      </div>

      <div
        className="row-steps"
        style={{
          display: "grid",
          gridTemplateColumns: expanded ? "repeat(8, 1fr)" : "repeat(16, 1fr)",
          gap: expanded ? 10 : 8,
          alignItems: "center",
          minWidth: 0, // iOS grid shrink fix
        }}
      >
        {values.map((v, i) => {
          const isActive = v > 0;
          const accent = i === step && latchedRow === row;
          const fill = isActive
  ? `rgba(52, 211, 153, ${0.35 + 0.65 * Math.max(0, Math.min(1, v))})`
  : `rgba(255,255,255,.15)`;

          return (
            <button
              key={`${row}-${i}`}
              type="button"
              {...btnTouchProps}
              onPointerDown={() => onCycleStep(i)}
              onKeyDown={onKeyActivate(() => onCycleStep(i))}
              aria-pressed={isActive}
              aria-label={`Row ${row}, Step ${i + 1}${isActive ? " (on)" : ""}`}
              title={`Row ${row} • Step ${i + 1}`}
              style={{
                ...btnTouchProps.style,
                height: expanded ? 44 : 24,
                width: "100%",
                borderRadius: expanded ? 6 : 3,
                background: fill,
                outline: accent ? "2px solid #34d399" : "none",
                border: "1px solid rgba(255,255,255,.12)",
                padding: 0,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    </div>
  );
});
