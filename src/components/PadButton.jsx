// src/components/PadButton.jsx
import React from "react";
import { ensureAudioNow } from "../engine/unlockAudio";

export default function PadButton({ label, sub, onPress }) {
  return (
    <button
      type="button"
      className="pad-btn"
      data-tap-exempt
      onPointerDown={(e) => {
        e.preventDefault();       // keep it a single, crisp gesture
        ensureAudioNow();         // 🔊 make sure AudioContext is running
        onPress?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      aria-label={sub ? `${label} – ${sub}` : label}
    >
      <div className="pad-btn__inner">
        <span className="pad-btn__label">{label}</span>
        <span className="pad-btn__sub">{sub}</span>
      </div>
    </button>
  );
}
