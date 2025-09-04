// src/components/PadButton.jsx
import React from "react";

export default function PadButton({ label, sub, onPress }) {
  return (
    <button
      type="button"
      className="pad-btn"
      data-tap-exempt
      onPointerDown={(e) => { e.preventDefault(); onPress?.(); }}
      onContextMenu={(e) => e.preventDefault()} // avoid long-press menu on iOS
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
