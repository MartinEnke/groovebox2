// src/components/InstrumentGrid.jsx
import React, { memo } from "react";
import { INSTRUMENTS } from "../constants/instruments";
import useTapGesture from "../hooks/useTapGesture"; // ← ensure this path matches your tree

export function InstrumentGrid({
  selected,
  selectInstrument,
  mutes,
  toggleMute,
  instruments = INSTRUMENTS,
}) {
  const rows = [instruments.slice(0, 5), instruments.slice(5, 10)];
  return (
    <>
      {rows.map((row, idx) => (
        <InstrumentRow
          key={idx}
          row={row}
          topMargin={idx === 0 ? 0 : 16}
          selected={selected}
          selectInstrument={selectInstrument}
          mutes={mutes}
          toggleMute={toggleMute}
        />
      ))}
    </>
  );
}

const InstrumentRow = memo(function InstrumentRow({
  row,
  topMargin = 0,
  selected,
  selectInstrument,
  mutes,
  toggleMute,
}) {
  return (
    <>
      {/* instrument buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginTop: topMargin,
        }}
      >
        {row.map((inst) => (
          <InstrumentButton
            key={inst.id}
            inst={inst}
            isSelected={selected === inst.id}
            onSelect={() => selectInstrument(inst.id)}
          />
        ))}
      </div>

      {/* mutes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginTop: 8,
        }}
      >
        {row.map((inst) => (
          <MuteButton
            key={`${inst.id}-mute`}
            inst={inst}
            muted={!!mutes[inst.id]}
            onToggle={() => toggleMute(inst.id)}
          />
        ))}
      </div>
    </>
  );
});

// InstrumentButton — tap vs scroll
const InstrumentButton = memo(function InstrumentButton({ inst, isSelected, onSelect }) {
  const tap = useTapGesture(onSelect, { pan: "y", slop: 10 });
  return (
    <button
      type="button"
      {...tap}
      className={`btn inst-btn ${isSelected ? "is-selected" : ""}`}
      title={`Select ${inst.label}`}
      aria-pressed={isSelected}
    >
      <div style={{ fontWeight: 600 }}>{inst.label}</div>
    </button>
  );
});

// MuteButton — tap vs scroll
const MuteButton = memo(function MuteButton({ inst, muted, onToggle }) {
  const tap = useTapGesture(onToggle, { pan: "y", slop: 10 });
  return (
    <button
      type="button"
      {...tap}
      className={`btn mute-btn ${muted ? "is-muted" : ""}`}
      title={`Mute ${inst.label}`}
      aria-pressed={muted}
    >
      {muted ? "Mute" : "Mute"}
    </button>
  );
});
