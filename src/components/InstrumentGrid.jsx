// src/components/InstrumentGrid.jsx
import React, { memo } from "react";
import { INSTRUMENTS } from "../constants/instruments";

export function InstrumentGrid({
  selected,
  selectInstrument,
  mutes,
  toggleMute,
  instruments = INSTRUMENTS, // allows testing/custom sets if needed
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

const InstrumentButton = memo(function InstrumentButton({ inst, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="btn inst-btn"
      title={`Select ${inst.label}`}
      style={{ background: isSelected ? "#059669" : "#333" }}
    >
      <div style={{ fontWeight: 600 }}>{inst.label}</div>
    </button>
  );
});

const MuteButton = memo(function MuteButton({ inst, muted, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="btn"
      title={`Mute ${inst.label}`}
      style={{ background: muted ? "#b91c1c" : "#444" }}
    >
      {muted ? "Mute" : "Mute"}
    </button>
  );
});
