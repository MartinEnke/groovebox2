import React, { useEffect, useMemo, useState } from "react";

export default function SoundGate({ engine, onlyOnIOS = true }) {
  const [ready, setReady] = useState(() => engine.getCtx()?.state === "running");

  // Robust iOS detection (covers iPadOS on M1 which reports MacIntel)
  const isIOS = useMemo(() => {
    const ua = navigator.userAgent || "";
    const iThing = /iPhone|iPad|iPod/i.test(ua);
    const iPadOnMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iThing || iPadOnMac;
  }, []);

  // Auto-try resume once on mount
  useEffect(() => {
    const ctx = engine.getCtx();
    if (!ctx) return;

    if (ctx.state === "running") {
      setReady(true);
      return;
    }

    (async () => {
      try { await engine.ensureRunning?.(); } catch {}
      if (engine.getCtx()?.state === "running") setReady(true);
    })();

    const onState = () => setReady(engine.getCtx()?.state === "running");
    ctx.onstatechange = onState;
    return () => { if (ctx) ctx.onstatechange = null; };
  }, [engine]);

  // If running, or (desktop & onlyOnIOS), don't render the gate
  if (ready || (onlyOnIOS && !isIOS)) return null;

  const unlock = async () => {
    await engine.ensureRunning?.();
    try {
      // tiny silent WAV to “nudge” media route on some iOS builds
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      );
      a.playsInline = true;
      await a.play();
      a.pause();
    } catch {}
    setReady(engine.getCtx()?.state === "running");
  };

  return (
    <button
      onPointerDown={unlock}
      className="sound-gate"
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, display: "grid", placeItems: "center",
        background: "rgba(0,0,0,.6)", color: "#fff", border: 0,
        width: "100%", height: "100%", font: "600 16px system-ui", zIndex: 99999
      }}
    >
      🔊 Tap to enable sound
      <div style={{opacity:.8,fontWeight:400, marginTop: 6}}>
        If still silent, turn OFF Silent Mode (ring switch).
      </div>
    </button>
  );
}
