import React, { useState, useMemo } from "react";
import FoldSection from "./ui/FoldSection.jsx";
import PadButton from "./PadButton";
import { VELS } from "../constants/sequencer";
import { INSTRUMENTS } from "../constants/instruments";
import useTapGesture from "../hooks/useTapGesture";

export default function Channel({
  show, onToggle,
  selected,
  volumeDb, onVolumeChange,
  pitchSemi = 0, onPitchChange,
  soloActive, onToggleSolo,
  onPadPress,
}) {
  const [mode, setMode] = useState("vol");
  const label = useMemo(
    () => INSTRUMENTS.find((i) => i.id === selected)?.label ?? selected,
    [selected]
  );

  const sliderMin   = mode === "vol" ? -24 : -12;
  const sliderMax   = mode === "vol" ? 6   : 12;
  const sliderStep  = mode === "vol" ? 0.1 : 1;
  const sliderValue = mode === "vol" ? volumeDb : pitchSemi;

  const numericDisplay = useMemo(
    () => (mode === "vol"
      ? Number(volumeDb).toFixed(1)
      : `${pitchSemi > 0 ? "+" : ""}${Math.trunc(pitchSemi)}`),
    [mode, volumeDb, pitchSemi]
  );

  // tap-vs-scroll guards (allow vertical page scroll)
  const soloTap  = useTapGesture(onToggleSolo,             { pan: "y", slop: 10 });
  const volTap   = useTapGesture(() => setMode("vol"),     { pan: "y", slop: 10 });
  const pitchTap = useTapGesture(() => setMode("pitch"),   { pan: "y", slop: 10 });

  return (
    <FoldSection title={`Channel · ${label}`} show={show} onToggle={onToggle} centerAlways>
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
              style={{ touchAction: "manipulation" }}
            />
          </div>

          <div className="lcd-compact">{numericDisplay}</div>

          <button
            type="button"
            {...soloTap}
            className={`press solo-btn edge ${soloActive ? "solo-on" : ""}`}
            aria-pressed={soloActive}
            title="Solo"
          >
            Solo
          </button>
        </div>

        {/* Vol / Pitch */}
        <div className="mode-col">
          <button
            type="button"
            {...volTap}
            className={`press toggle xs ${mode === "vol" ? "on" : ""}`}
            aria-pressed={mode === "vol"}
            title="Volume mode"
          >
            <span className="label-full">Vol</span>
            
          </button>
          <button
            type="button"
            {...pitchTap}
            className={`press toggle xs ${mode === "pitch" ? "on" : ""}`}
            aria-pressed={mode === "pitch"}
            title="Pitch mode"
          >
            <span className="label-full">Pitch</span>
            
          </button>
        </div>
      </div>
    </FoldSection>
  );
}
