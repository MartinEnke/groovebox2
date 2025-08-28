import React, { useState } from "react";
import FoldSection from "./ui/FoldSection.jsx";
import PadButton from "./PadButton";
import { VELS } from "../constants/sequencer";
import { INSTRUMENTS } from "../constants/instruments";

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
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (mode === "vol") onVolumeChange?.(v);
                else onPitchChange?.(v);
              }}
              aria-label={mode === "vol" ? "Volume" : "Pitch"}
            />
          </div>

          <div className="lcd-compact">{numericDisplay}</div>

          <button
            className={`press solo-btn edge ${soloActive ? "solo-on" : ""}`}
            aria-pressed={soloActive}
            onClick={onToggleSolo}
            title="Solo"
          >
            Solo
          </button>
        </div>

        {/* Vol / Pitch */}
        <div className="mode-col">
          <button
            className={`press toggle xs ${mode === "vol" ? "on" : ""}`}
            aria-pressed={mode === "vol"}
            onClick={() => setMode("vol")}
            title="Volume mode"
          >
            Vol
          </button>
          <button
            className={`press toggle xs ${mode === "pitch" ? "on" : ""}`}
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
