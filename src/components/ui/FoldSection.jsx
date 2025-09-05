// src/components/ui/FoldSection.jsx
import React from "react";
import useTapGesture from "../../hooks/useTapGesture";

export default function FoldSection({
  title,
  show,
  onToggle,
  centerAlways = false,
  children,
}) {
  // Guard taps from vertical swipes
  const tapChevron = useTapGesture(onToggle, { pan: "y", slop: 10, trigger: "up" });
  const tapTitle   = useTapGesture(onToggle, { pan: "y", slop: 10, trigger: "up" });

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: 6,
          marginBottom: 4,
          position: "relative",
          minHeight: 22,
        }}
      >
        {(centerAlways || !show) && (
          // Title becomes a small, centered button (tap to fold/unfold)
          <button
            type="button"
            {...tapTitle}
            aria-expanded={!!show}
            title={show ? `Collapse ${title}` : `Expand ${title}`}
            style={{
              ...(tapTitle.style || {}),
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              // keep it compact so it doesn't block scroll across the whole row
              padding: "0 10px",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,.55)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              zIndex: 2,
              cursor: "pointer",
            }}
          >
            {title}
          </button>
        )}

        <button
          type="button"
          {...tapChevron}
          style={{
            ...(tapChevron.style || {}),
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,.7)",
            cursor: "pointer",
            padding: "2px 4px",
            lineHeight: 0,
            zIndex: 3,
            minWidth: 28,
            minHeight: 28,
          }}
          aria-expanded={!!show}
          title={show ? `Collapse ${title}` : `Expand ${title}`}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              transform: show ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>

      {show ? children : null}
    </>
  );
}
