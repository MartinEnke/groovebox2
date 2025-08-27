import React from "react";

export default function PadButton({ label, sub, onPress }) {
  return (
    <button
      type="button"
      className="pad-btn"
      onPointerDown={onPress}
      onTouchStart={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      <div className="pad-btn__inner">
        <span className="pad-btn__label">{label}</span>
        <span className="pad-btn__sub">{sub}</span>
      </div>
    </button>
  );
}
