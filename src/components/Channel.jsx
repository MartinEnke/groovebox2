// Channel.jsx
import React, { useState, useRef, useLayoutEffect } from "react";
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

  const numericDisplay = mode === "vol"
    ? Number(volumeDb).toFixed(1)
    : `${pitchSemi > 0 ? "+" : ""}${Math.trunc(pitchSemi)}`;

  // NEW: sync fader height to pads
  const padsRef = useRef(null);
  const slotRef = useRef(null);

  useLayoutEffect(() => {
    if (!padsRef.current || !slotRef.current) return;
    const update = () => {
      const h = padsRef.current.offsetHeight || 180;
      slotRef.current.style.setProperty("--vfader-h", `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(padsRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <FoldSection title={`Channel · ${label}`} show={show} onToggle={onToggle}>
      <div className="channel-block three-cols pads-left">
        {/* Pads (tiny gap, no overlap) */}
        <div className="pads-2x2 tiny-gap" ref={padsRef}>
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

        {/* Vertical fader + numeric + Solo */}
        <div className="vfader-wrap">
          <div className="vfader-slot" ref={slotRef}>
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
              onInput={(e) => {
                // smoother dragging on Chrome/Edge
                const v = Number(e.target.value);
                if (mode === "vol") onVolumeChange?.(v);
                else onPitchChange?.(v);
              }}
              aria-label={mode === "vol" ? "Volume" : "Pitch"}
              orient="vertical" /* works in Firefox */
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

        {/* Vol/Pitch buttons to the RIGHT of the fader */}
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
