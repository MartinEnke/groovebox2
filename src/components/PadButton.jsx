// src/components/PadButton.jsx
import React from "react";
import { ensureAudioNow } from "../engine/unlockAudio";

export default function PadButton({ label, sub, onPress }) {
  return (
    <button
      type="button"
      className="pad-btn"
      data-tap-exempt
      onPointerDown={async (e) => {
        e.preventDefault();
        const resumed = await ensureAudioNow();      // ⬅️ make sure context is running
        if (resumed) {
          // first tap after a suspended state—give Safari one tick
          setTimeout(() => onPress?.(), 0);
        } else {
          onPress?.();
        }
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
