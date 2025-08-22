import React from "react";
import { INSTRUMENTS } from "../constants/instruments";

export function InstrumentGrid({ selected, selectInstrument, mutes, toggleMute }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {INSTRUMENTS.slice(0, 5).map((inst) => (
          <button
            key={inst.id}
            onClick={() => selectInstrument(inst.id)}
            className="btn inst-btn"
            title={`Select ${inst.label}`}
            style={{ background: selected === inst.id ? "#059669" : "#333" }}
          >
            <div style={{ fontWeight: 600 }}>{inst.label}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 8 }}>
        {INSTRUMENTS.slice(0, 5).map((inst) => {
          const muted = mutes[inst.id];
          return (
            <button
              key={`${inst.id}-mute`}
              onClick={() => toggleMute(inst.id)}
              className="btn"
              title={`Mute ${inst.label}`}
              style={{ background: muted ? "#b91c1c" : "#444" }}
            >
              {muted ? "Mute" : "Mute"}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 16 }}>
        {INSTRUMENTS.slice(5, 10).map((inst) => (
          <button
            key={inst.id}
            onClick={() => selectInstrument(inst.id)}
            className="btn inst-btn"
            title={`Select ${inst.label}`}
            style={{ background: selected === inst.id ? "#059669" : "#333" }}
          >
            <div style={{ fontWeight: 600 }}>{inst.label}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 8 }}>
        {INSTRUMENTS.slice(5, 10).map((inst) => {
          const muted = mutes[inst.id];
          return (
            <button
              key={`${inst.id}-mute`}
              onClick={() => toggleMute(inst.id)}
              className="btn"
              title={`Mute ${inst.label}`}
              style={{ background: muted ? "#b91c1c" : "#444" }}
            >
              {muted ? "Mute" : "Mute"}
            </button>
          );
        })}
      </div>
    </>
  );
}
