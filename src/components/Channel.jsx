// src/components/Channel.jsx
import React from "react";
import PadButton from "./PadButton";
import { VELS } from "../constants/sequencer";
import { INSTRUMENTS } from "../constants/instruments";

export default function Channel({
  show,
  onToggle,
  selected,
  volumeDb,
  onVolumeChange,
  soloActive,
  onToggleSolo,
  onPadPress,
}) {
  const label = INSTRUMENTS.find((i) => i.id === selected)?.label ?? selected;

  return (
    <>
      {/* Fold header (CHANNEL) */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 6,
          marginBottom: 4,
          position: "relative",
        }}
      >
        {!show && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
              color: "rgba(255,255,255,.55)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Channel
          </div>
        )}
        <button
          onClick={onToggle}
          aria-expanded={show}
          title={show ? "Collapse pads" : "Expand pads"}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,.7)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: "2px 4px",
          }}
        >
          {show ? "▾" : "▸"}
        </button>
      </div>

      {show && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 88px",
            gap: 16,
            alignItems: "center",
            maxWidth: 560,
            marginTop: 8,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {/* 2×2 Pads */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 16,
              justifyItems: "center",
              alignItems: "center",
            }}
          >
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

          {/* Volume fader + solo */}
          <div className="vfader-wrap">
            <div className="vfader-title">{label}</div>

            <div className="vfader-slot">
              <input
                className="vfader"
                type="range"
                min={-24}
                max={+6}
                step={0.1}
                value={volumeDb}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                title="Volume (selected instrument)"
              />
            </div>

            <div className="vfader-readout">
              {volumeDb >= 0 ? `+${volumeDb.toFixed(1)} dB` : `${volumeDb.toFixed(1)} dB`}
            </div>

            <button
              className={`btn solo-btn ${soloActive ? "solo-on" : ""}`}
              onClick={onToggleSolo}
              aria-pressed={soloActive}
              title="Solo selected instrument (mute others)"
              style={{ width: "100%" }}
            >
              Solo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
