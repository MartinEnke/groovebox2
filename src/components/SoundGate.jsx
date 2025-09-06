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

  // Try to auto-resume once (optional)
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

  // If we only want this on iOS and it’s not iOS, bail
  if (onlyOnIOS && !isIOS) return null;

  // With requireAcknowledge=true, we ignore `ready` and show until user clicks Continue
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

    // user intent: try to resume and then mark as ready/ack
    try { await engine.ensureRunning?.(); } catch {}
    await nudgeMedia();

    // mark both: audio ready (if possible) and user acknowledged
    setReady(engine.getCtx?.()?.state === "running");
    setAck(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-title"
      // NOTE: do NOT attach unlock handlers to the backdrop; button only.
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

        <div style={{ margin: 0, lineHeight: 1.4, fontSize: 14, opacity: 0.95 }}>
          Turn <b>OFF Silent Mode</b> (ringer switch) and raise the volume.
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.9 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>
            This is a learning project to explore React.<br/>
            It’s a drum-machine style rhythm maker with:
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.35 }}>
            <li>16/32-step grid (place hits)</li>
            <li>Pitch (tune each sound)</li>
            <li>Sidechain (auto-duck other sounds)</li>
            <li>Delay / Reverb (space & echoes)</li>
            <li>Saturation (add grit)</li>
            <li>Swing (groove / shuffle)</li>
            <li>Drum-bus compression (glue the kit)</li>
          </ul>
          <p style={{ margin: "8px 0 0 0" }}>Have fun! :)</p>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.8 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Disclaimer</div>
          <p style={{ margin: 0 }}>
            Data lives locally in your browser — consider exporting a backup.<br/>
            Occasional bugs or data loss are possible; no warranties.
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
              background: "linear-gradient(180deg, rgba(31,224,179,.22), rgba(31,224,179,.12))",
              color: "#eafff6",
              cursor: "pointer",
              touchAction: "manipulation",
              fontWeight: 700,
              boxShadow: "0 0 14px rgba(6,214,160,.28), inset 0 1px 0 rgba(255,255,255,.12)",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
