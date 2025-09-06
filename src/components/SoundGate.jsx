// src/components/SoundGate.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Props:
 * - onlyOnIOS: show only on iOS (default true)
 * - autoResume: try to resume AudioContext on mount (default true)
 * - requireAcknowledge: keep panel up until user clicks Continue (default false)
 */
export default function SoundGate({
  engine,
  onlyOnIOS = true,
  autoResume = true,
  requireAcknowledge = false,
}) {
  const [ready, setReady] = useState(() => engine.getCtx?.()?.state === "running");
  const [ack, setAck] = useState(false);

  // iOS (incl. iPadOS-on-Mac)
  const isIOS = useMemo(() => {
    const ua = navigator.userAgent || "";
    const iThing = /iPhone|iPad|iPod/i.test(ua);
    const iPadOnMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iThing || iPadOnMac;
  }, []);

  // Optional auto-resume on mount
  useEffect(() => {
    if (!autoResume) return;
    const ctx = engine.getCtx?.();
    if (!ctx) return;

    if (ctx.state !== "running") {
      (async () => {
        try { await engine.ensureRunning?.(); } catch {}
        if (engine.getCtx?.()?.state === "running") setReady(true);
      })();
    } else {
      setReady(true);
    }

    const onState = () => setReady(engine.getCtx?.()?.state === "running");
    ctx.onstatechange = onState;
    return () => { if (ctx) ctx.onstatechange = null; };
  }, [engine, autoResume]);

  if (onlyOnIOS && !isIOS) return null;

  const shouldShow = requireAcknowledge ? !ack : !ready;
  if (!shouldShow) return null;

  const nudgeMedia = async () => {
    try {
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      );
      a.playsInline = true;
      await a.play();
      a.pause();
    } catch {}
  };

  const unlockNow = async (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    try { await engine.ensureRunning?.(); } catch {}
    await nudgeMedia();
    setReady(engine.getCtx?.()?.state === "running");
    setAck(true);
  };

  const accent = "#1fe0b3";
  const shellFont =
    "'Inter', 'Avenir Next', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-title"
      // Button-only dismiss — backdrop clicks do nothing to avoid accidental close
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,.6)",
      }}
    >
      <div
        style={{
          fontFamily: shellFont,
          background: "rgba(20,20,28,.94)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 14,
          // Bigger on desktop: generous maxWidth
          maxWidth: 560,                      // ↑ was 420
          width: "calc(100% - 40px)",
          padding: "18px 20px",
          color: "#f5f7fa",
          textAlign: "left",
          lineHeight: 1.45,
          boxShadow: "0 16px 40px rgba(0,0,0,.5)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <h2
          id="sg-title"
          style={{
            margin: 0,
            marginBottom: 10,
            fontSize: 18,                      // ↑ slightly larger
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#e9fff7",
            textShadow: "0 0 18px rgba(31,224,179,.12)",
          }}
        >
          Hi there!
        </h2>

        <p style={{ margin: 0, fontSize: 15 }}>
          Turn <b style={{ color: accent }}>OFF Silent Mode</b> (ringer switch) and raise the volume.
        </p>

        <div style={{ marginTop: 16, fontSize: 14.5, opacity: 0.95 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>
            This is a learning project to explore React.<br />
            It’s a drum-machine-style rhythm maker with:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>16/32-step grid (place hits)</li>
            <li>Pitch (tune each sound)</li>
            <li>
              Sidechain <span style={{ color: accent }}>(auto-duck)</span> other sounds
            </li>
            <li>Delay / Reverb (space & echoes)</li>
            <li>Saturation (add grit)</li>
            <li>Swing (groove / shuffle)</li>
            <li>Drum-bus compression (glue the kit)</li>
          </ul>
          <p style={{ margin: "10px 0 0 0", color: "#e9fff7" }}>Have fun! :)</p>
        </div>

        <div style={{ marginTop: 14, fontSize: 12.5, opacity: 0.85 }}>
          <div style={{ fontWeight: 750, marginBottom: 4, color: "#f0f3f7" }}>Disclaimer</div>
          <p style={{ margin: 0 }}>
            Data lives locally in your browser —
            <span style={{ color: accent }}> consider exporting a backup</span>.<br />
            Occasional bugs or data loss are possible; no warranties.
          </p>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); unlockNow(e); }}
            onClick={(e) => { e.stopPropagation(); unlockNow(e); }}
            style={{
              fontFamily: shellFont,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.18)",
              background: `linear-gradient(180deg, ${accent}33, ${accent}1f)`,
              color: "#eafff6",
              cursor: "pointer",
              fontWeight: 800,
              letterSpacing: 0.3,
              boxShadow:
                "0 0 16px rgba(31,224,179,.26), inset 0 1px 0 rgba(255,255,255,.14), 0 3px 0 rgba(0,0,0,.45)",
              transition: "transform .05s ease, filter .15s ease",
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "translateY(1px)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
