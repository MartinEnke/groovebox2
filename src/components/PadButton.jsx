// src/components/PadButton.jsx
import React from "react";
import useTapGesture from "../hooks/useTapGesture";

export default function PadButton({ label, sub, onPress }) {
  // Only fire onPress if it was a true tap; allow vertical page scrolling.
  const tap = useTapGesture(() => onPress?.(), { pan: "y", slop: 10, timeoutMs: 600 });

  return (
    <button
      type="button"
      {...tap}
      className="pad-btn"
      aria-label={sub ? `${label}, ${sub}` : label}
      title={label}
    >
      <div className="pad-btn__inner">
        <span className="pad-btn__label">{label}</span>
        <span className="pad-btn__sub">{sub}</span>
      </div>
    </button>
  );
}
