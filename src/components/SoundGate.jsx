// src/components/SoundGate.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function SoundGate({ engine, onlyOnIOS = true }) {
  const [ready, setReady] = useState(() => engine.getCtx?.()?.state === "running");

  const isIOS = useMemo(() => {
    const ua = navigator.userAgent || "";
    const iThing = /iPhone|iPad|iPod/i.test(ua);
    const iPadOnMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iThing || iPadOnMac;
  }, []);

  // If context is already running (or not iOS when onlyOnIOS), show nothing
  useEffect(() => {
    const ctx = engine.getCtx?.();
    if (!ctx) return;
    if (ctx.state === "running") setReady(true);

    const onState = () => setReady(engine.getCtx?.()?.state === "running");
    ctx.onstatechange = onState;
    return () => { if (ctx) ctx.onstatechange = null; };
  }, [engine]);

  if (ready || (onlyOnIOS && !isIOS)) return null;

  // Fire-and-forget helpers that stay in the same event frame.
  const tryResumeSync = () => {
    try {
      const ctx = engine.getCtx?.();
      if (ctx && ctx.state !== "running") {
        // Do NOT await — keep it synchronous to satisfy iOS gesture requirement.
        ctx.resume();
      }
    } catch {}
    try { engine.ensureRunning?.(); } catch {}
  };

  const nudgeMediaSync = () => {
    try {
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      );
      a.playsInline = true;
      // don't await; kick it off and ignore
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      setTimeout(() => { try { a.pause(); a.src = ""; } catch {} }, 180);
    } catch {}
  };

  // Tap/click anywhere OR the button
  const unlockNow = (e) => {
    e.preventDefault?.();
    // DO NOT stopPropagation — let your document-level unlock listeners also run.
    tryResumeSync();
    nudgeMediaSync();

    // Dismiss promptly; if resume completes slightly later, onstatechange will have setReady anyway.
    requestAnimationFrame(() => setReady(true));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-title"
      onPointerDown={unlockNow}
      onClick={unlockNow}
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
          background: "rgba(20,20,28,.94)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 12,
          padding: "16px 18px",
          color: "#fff",
          maxWidth: 420,
          width: "calc(100% - 32px)",
          textAlign: "left",
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <h2 id="sg-title" style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 8 }}>
          Hi there!
        </h2>
  
        <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.4, fontSize: 14, opacity: 0.95 }}>
          <div>
            Turn <b>OFF Silent Mode</b> (ringer switch) and raise the volume.
            </div>
        </ul>
  
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.9 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>
            This is a learning project to explore the React framework. <br/>
            It’s a drum-machine-style
            rhythm maker with:
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.35 }}>
            <li>16/32-step grid (place hits)</li>
            <li>Pitch (tune each sound)</li>
            <li>Sidechain (auto-duck other sounds)</li>
            <li>Delay/Reverb (space and echoes)</li>
            <li>Saturation (add grit)</li>
            <li>Swing (groove/shuffle)</li>
            <li>Drum-bus compression (glue the kit)</li>
          </ul>
          <p style={{ margin: "8px 0 0 0" }}>Have fun! :)</p>
        </div>
  
        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.8 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Disclaimer</div>
          <p style={{ margin: 0 }}>
          Data is stored locally in your browser—consider exporting a backup. <br/>
          Occasional bugs or data loss are possible. No warranties.”
          </p>
        </div>
  
        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); unlockNow(e); }}
            onClick={(e) => { e.stopPropagation(); unlockNow(e); }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.2)",
              background: "linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.08))",
              color: "#fff",
              cursor: "pointer",
              touchAction: "manipulation",
              fontWeight: 700,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
  
}
