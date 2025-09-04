// src/components/PadButton.jsx
import React from "react";

export default function PadButton({ label, sub, onPress }) {
  return (
    <button
      type="button"
      className="pad-btn"
      data-tap-exempt
      // ultra-fast trigger
      onPointerDown={(e) => {
        // No need to preventDefault if touch-action:none is set,
        // but doing so is safe and avoids stray focus/selection.
        e.preventDefault();
        onPress?.();
      }}
      // no onTouchStart — we rely purely on pointer events
      style={{
        touchAction: "none",               // fastest; never treat as a scroll start
        WebkitTapHighlightColor: "transparent",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div className="pad-btn__inner">
        <span className="pad-btn__label">{label}</span>
        <span className="pad-btn__sub">{sub}</span>
      </div>
    </button>
  );
}
