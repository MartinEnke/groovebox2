// src/components/SoundGate.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function SoundGate({ engine, onlyOnIOS = true }) {
  const [ready, setReady] = useState(() => engine.getCtx?.()?.state === "running");

  // Detect iOS (incl. iPadOS on MacIntel)
  const isIOS = useMemo(() => {
    const ua = navigator.userAgent || "";
    const iThing = /iPhone|iPad|iPod/i.test(ua);
    const iPadOnMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iThing || iPadOnMac;
  }, []);

  // Try to auto-resume once on mount
  useEffect(() => {
    const ctx = engine.getCtx?.();
    if (!ctx) return;
    if (ctx.state === "running") { setReady(true); return; }

    (async () => {
      try { await engine.ensureRunning?.(); } catch {}
      if (engine.getCtx?.()?.state === "running") setReady(true);
    })();

    const onState = () => setReady(engine.getCtx?.()?.state === "running");
    ctx.onstatechange = onState;
    return () => { if (ctx) ctx.onstatechange = null; };
  }, [engine]);

  // If already running, or not iOS (and we only show on iOS), render nothing
  if (ready || (onlyOnIOS && !isIOS)) return null;

  const nudgeMedia = async () => {
    try {
      // tiny silent WAV to "prime" media routing on some iOS builds
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      );
      a.playsInline = true;
      await a.play();
      a.pause();
    } catch {}
  };

  const onAcknowledge = async (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    await engine.ensureRunning?.();
    await nudgeMedia();
    requestAnimationFrame(() => {
      const okNow = engine.getCtx?.()?.state === "running";
      if (okNow) { setReady(true); return; }
      setTimeout(() => {
        if (engine.getCtx?.()?.state === "running") setReady(true);
      }, 120);
    });
  };

  const dismissAnyway = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setReady(true); // let user proceed even if audio stayed suspended
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sound tip"
      style={{
        position: "fixed", inset: 0, zIndex: 99999, display: "grid", placeItems: "center",
        background: "rgba(0,0,0,.6)"
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
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
          🔈 If it’s silent…
        </div>

        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.4, fontSize: 14, opacity: 0.95 }}>
          <li>Turn <b>OFF Silent Mode</b> (ringer switch) and raise the volume.</li>
          <li>On iOS, audio may start only after your first tap—this is normal.</li>
        </ul>

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>About</div>
          <div>
            This is a small learning project to explore the React framework and Web&nbsp;Audio.
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Disclaimer</div>
          <div>
            Provided “as is”, without warranties. Data is stored locally in your browser; 
            please export backups if needed. I can’t guarantee against data loss or bugs.
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onPointerDown={dismissAnyway}
            onClick={dismissAnyway}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "rgba(255,255,255,.9)",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Continue
          </button>

          <button
            type="button"
            onPointerDown={onAcknowledge}
            onClick={onAcknowledge}
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
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
