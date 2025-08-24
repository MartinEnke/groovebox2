import React, { useState } from "react";
import FoldSection from "./ui/FoldSection.jsx";
import PadButton from "./PadButton";
import { VELS } from "../constants/sequencer";
import { INSTRUMENTS } from "../constants/instruments";

export default function Channel({
  show,
  onToggle,
  selected,
  volumeDb,
  pitchSemi,
  onVolumeChange,
  onPitchChange,
  soloActive,
  onToggleSolo,
  onPadPress,
}) {
  const label = INSTRUMENTS.find((i) => i.id === selected)?.label ?? selected;
  const [mode, setMode] = useState("vol"); // "vol" | "pitch"

  return (
    <FoldSection title="Channel" show={show} onToggle={onToggle}>
      <div className="channel-block three-cols pads-left">
        {/* LEFT: 2×2 pads */}
        <div className="pads-2x2">
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

        {/* MIDDLE: vertical fader + readout + Solo */}
        <div className="vfader-wrap">
          <div className="vfader-slot">
            <input
              className="vfader"
              type="range"
              min={mode === "vol" ? -24 : -12}
              max={mode === "vol" ? 6 : 12}
              step={mode === "vol" ? 0.1 : 1}
              value={mode === "vol" ? volumeDb : pitchSemi}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (mode === "vol") onVolumeChange?.(v);
                else onPitchChange?.(v);
              }}
              aria-label={mode === "vol" ? "Volume" : "Pitch (semitones)"}
              orient="vertical"
            />
          </div>

          <div className="lcd-compact" aria-live="polite">
            {mode === "vol" ? Number(volumeDb).toFixed(1) : `${pitchSemi > 0 ? "+" : ""}${pitchSemi}`}
          </div>

          <button
            className={`press solo-btn edge ${soloActive ? "solo-on" : ""}`}
            aria-pressed={soloActive}
            onClick={onToggleSolo}
            title="Solo"
          >
            Solo
          </button>
        </div>

        {/* RIGHT: Vol/Pitch toggle buttons (small, edgy) */}
        <div className="mode-col">
          <button
            className={`press toggle xs edge ${mode === "vol" ? "on" : ""}`}
            aria-pressed={mode === "vol"}
            onClick={() => setMode("vol")}
            title="Volume mode"
          >
            Vol
          </button>
          <button
            className={`press toggle xs edge ${mode === "pitch" ? "on" : ""}`}
            aria-pressed={mode === "pitch"}
            onClick={() => setMode("pitch")}
            title="Pitch mode"
          >
            Pitch
          </button>
        </div>
      </div>
    </FoldSection>
  );
}
