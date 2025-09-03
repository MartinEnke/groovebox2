import React, { memo } from "react";
import { INSTRUMENTS } from "../constants/instruments";

const btnTouchProps = {
  style: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
};

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

// InstrumentButton
const InstrumentButton = memo(function InstrumentButton({ inst, isSelected, onSelect }) {
  return (
    <button
      {...btnTouchProps}
      onPointerDown={onSelect}
      className={`btn inst-btn ${isSelected ? "is-selected" : ""}`}
      title={`Select ${inst.label}`}
    >
      <div style={{ fontWeight: 600 }}>{inst.label}</div>
    </button>
  );
});

// MuteButton
const MuteButton = memo(function MuteButton({ inst, muted, onToggle }) {
  return (
    <button
      {...btnTouchProps}
      onPointerDown={onToggle}
      className={`btn mute-btn ${muted ? "is-muted" : ""}`}
      title={`Mute ${inst.label}`}
    >
      {muted ? "Mute" : "Mute"}
    </button>
  );
});
