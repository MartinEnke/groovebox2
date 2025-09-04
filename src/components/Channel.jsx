// Channel.jsx
import React, { useState, useMemo } from "react";
import FoldSection from "./ui/FoldSection.jsx";
import PadButton from "./PadButton";
import { VELS } from "../constants/sequencer";
import { INSTRUMENTS } from "../constants/instruments";

// same fast-tap props you use in InstrumentGrid
const btnTouchProps = {
  style: {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
};

// keyboard fallback so buttons still work without a pointer
const onKeyActivate = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
};

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
                onPress={() => onPadPress(r, c)}   // PadButton already uses fast pointer handlers
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
              style={{ touchAction: "manipulation" }}   // prevents odd gesture delays on iOS
            />
          </div>

          <div className="lcd-compact">{numericDisplay}</div>

          {/* SOLO — pointerdown + keyboard fallback */}
          <button
            {...btnTouchProps}
            className={`press solo-btn edge ${soloActive ? "solo-on" : ""}`}
            aria-pressed={soloActive}
            title="Solo"
            onPointerDown={onToggleSolo}
            onKeyDown={onKeyActivate(onToggleSolo)}
          >
            Solo
          </button>
        </div>

        {/* Vol / Pitch — pointerdown + keyboard fallback */}
        <div className="mode-col">
          <button
            {...btnTouchProps}
            className={`press toggle xs ${mode === "vol" ? "on" : ""}`}
            aria-pressed={mode === "vol"}
            title="Volume mode"
            onPointerDown={() => setMode("vol")}
            onKeyDown={onKeyActivate(() => setMode("vol"))}
          >
            <span className="label-full">Vol</span>
            
          </button>

          <button
            {...btnTouchProps}
            className={`press toggle xs ${mode === "pitch" ? "on" : ""}`}
            aria-pressed={mode === "pitch"}
            title="Pitch mode"
            onPointerDown={() => setMode("pitch")}
            onKeyDown={onKeyActivate(() => setMode("pitch"))}
          >
            <span className="label-full">Pitch</span>
            
          </button>
        </div>
      </div>
    </FoldSection>
  );
}
