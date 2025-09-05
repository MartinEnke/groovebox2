import React, { useEffect, useMemo, useState } from "react";

export default function SoundGate({ engine, onlyOnIOS = true }) {
  const [ready, setReady] = useState(() => engine.getCtx()?.state === "running");

  // iOS (incl. iPadOS on MacIntel)
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

  const tryUnlock = async (e) => {
    // make *sure* this gesture is used for audio
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();

    await engine.ensureRunning?.();
    await nudgeMedia();

    // re-check after microtask and a tick; iOS sometimes flips to "running" slightly later
    requestAnimationFrame(() => {
      const okNow = engine.getCtx?.()?.state === "running";
      if (okNow) { setReady(true); return; }

      setTimeout(() => {
        const okLater = engine.getCtx?.()?.state === "running";
        if (okLater) setReady(true);
        // else keep the gate visible; user can hit "Continue anyway"
      }, 120);
    });
  };

  const dismissAnyway = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    setReady(true); // let user proceed even if audio stayed suspended
  };

  return (
    <div
      // full-screen overlay
      style={{
        position: "fixed", inset: 0, zIndex: 99999, display: "grid", placeItems: "center",
        background: "rgba(0,0,0,.6)",
      }}
      // allow both pointer and click to cover all iOS cases
      onPointerDown={tryUnlock}
      onClick={tryUnlock}
    >
      <div
        style={{
          background: "rgba(20,20,28,.9)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 12,
          padding: "16px 18px",
          color: "#fff",
          textAlign: "center",
          maxWidth: 360,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          🔊 Tap to enable sound
        </div>
        <div style={{ opacity: .8, fontSize: 14, lineHeight: 1.35 }}>
          If still silent, turn <b>OFF Silent Mode</b> (ring switch).
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            type="button"
            onPointerDown={tryUnlock}
            onClick={tryUnlock}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.2)",
              background: "linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.08))",
              color: "#fff",
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            Enable
          </button>

          <button
            type="button"
            onPointerDown={dismissAnyway}
            onClick={dismissAnyway}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "rgba(255,255,255,.85)",
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
