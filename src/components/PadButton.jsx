import React from "react";

export default function PadButton({ label, sub, onPress }) {
  return (
    <button
      onPointerDown={onPress}
      onTouchStart={(e) => { e.preventDefault(); /* don't call onPress here */ }}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 16,
        background: "#2a2a2a",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{sub}</span>
      </div>
    </button>
  );
}
