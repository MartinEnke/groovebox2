import React, { useEffect, useState } from "react";
import FoldSection from "./ui/FoldSection.jsx";
import PadButton from "./PadButton";
import { VELS } from "../constants/sequencer";
import { INSTRUMENTS } from "../constants/instruments";


// helper (top-level in the file)
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function LcdNumber({
  value,                 // e.g., volumeDb (number)
  onCommit,              // e.g., (db) => onVolumeChange(db)
  min = -60,             // adjust to your range
  max = 12,
  step = 0.5,            // arrow increment
  smallStep = 0.1,       // Alt/Option increment
  bigStep = 3,           // Shift increment
  suffix = " dB",        // for display; not stored
  ariaLabel = "Volume dB"
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 10) / 10));

  // keep draft synced when prop changes externally
  useEffect(() => {
    setDraft(String(Math.round(value * 10) / 10));
  }, [value]);

  const commit = () => {
    const n = Number(draft.trim().replace(",", "."));
    if (Number.isFinite(n)) onCommit(clamp(n, min, max));
    else setDraft(String(Math.round(value * 10) / 10));
  };

  const nudge = (dir, incr) => {
    const base = Number(draft.replace(",", ".")); // try live draft first
    const curr = Number.isFinite(base) ? base : value;
    const next = clamp(curr + dir * incr, min, max);
    setDraft(String(Math.round(next * 10) / 10));
    onCommit(next);
  };

  return (
    <input
      className="lcd-compact lcd-input"
      type="text"                 // avoid mobile steppers; better keyboard
      inputMode="decimal"         // mobile decimal keypad
      pattern="[0-9.,\-]*"
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); setDraft(String(Math.round(value * 10) / 10)); }
        else if (e.key === "ArrowUp") {
          e.preventDefault();
          nudge(+1, e.shiftKey ? bigStep : (e.altKey ? smallStep : step));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          nudge(-1, e.shiftKey ? bigStep : (e.altKey ? smallStep : step));
        }
      }}
    />
  );
}


export default function Channel({
  show, onToggle,
  selected,
  volumeDb, onVolumeChange,
  pitchSemi = 0, onPitchChange,
  soloActive, onToggleSolo,
  onPadPress,
}) {
  const [mode, setMode] = useState("vol");
  const label = INSTRUMENTS.find((i) => i.id === selected)?.label ?? selected;

  const sliderMin   = mode === "vol" ? -24 : -12;
  const sliderMax   = mode === "vol" ? 6   : 12;
  const sliderStep  = mode === "vol" ? 0.1 : 1;
  const sliderValue = mode === "vol" ? volumeDb : pitchSemi;

  const numericDisplay =
    mode === "vol" ? Number(volumeDb).toFixed(1)
                   : `${pitchSemi > 0 ? "+" : ""}${Math.trunc(pitchSemi)}`;

  return (
    <FoldSection title={`Channel · ${label}`} show={show} onToggle={onToggle}>
      <div className="channel-block three-cols pads-left">
        {/* Pads */}
        <div className="pads-2x2 tiny-gap">
          {[0, 1].map((r) =>
            [0, 1].map((c) => (
              <PadButton
                key={`pad-${r}-${c}`}
                label="PAD"
                sub={`vel ${VELS[r][c].toFixed(2)}`}
                onPress={() => onPadPress(r, c)}
              />
            ))
          )}
        </div>

        {/* Fader + LCD + Solo */}
        <div className="vfader-wrap">
  <div className="vfader-slot">
    <input
      className="vfader"
      type="range"
      min={-60}
      max={12}
      step={0.1}
      value={volumeDb}
      onChange={(e) => onVolumeChange(Number(e.target.value))}
    />
  </div>

  <LcdNumber
    value={volumeDb}
    onCommit={onVolumeChange}
    min={-60}
    max={12}
    step={0.5}
    smallStep={0.1}
    bigStep={3}
    suffix=" dB"
    ariaLabel="Volume dB"
  />

  <button
    className={`solo-btn edge ${soloActive ? "solo-on" : ""}`}
    aria-pressed={soloActive}
    onClick={onToggleSolo}
  >
    SOLO
  </button>
</div>

      </div>
    </FoldSection>
  );
}
