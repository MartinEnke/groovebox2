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
        // inner panel
        style={{
          background: "linear-gradient(180deg, rgba(18,20,28,.96), rgba(14,16,22,.94))",
          border: "1px solid rgba(31,224,179,.35)",
          borderRadius: 12,
          padding: "16px 18px",
          color: "#f3fff9",
          maxWidth: 420,
          width: "calc(100% - 32px)",
          textAlign: "left",
          boxShadow:
            "0 12px 30px rgba(0,0,0,.45), 0 0 22px rgba(31,224,179,.18), inset 0 1px 0 rgba(255,255,255,.06)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <h2
          id="sg-title"
          style={{
            fontSize: 14,
            fontWeight: 800,
            margin: 0,
            marginBottom: 8,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#1fe0b3",              // neon mint
            textShadow: "0 0 10px rgba(31,224,179,.35)",
          }}
        >
          Hi there!
        </h2>
  
        <div
          style={{
            margin: 0,
            lineHeight: 1.4,
            fontSize: 14,
            opacity: 0.95,
            color: "#c4ffd8",
          }}
        >
          Switch <b style={{ color: "#ffb84d" }}>Silent Mode off</b> <br/>
          and nudge the <b style={{ color: "#1fe0b3" }}>volume</b> up 🔊
        </div>
  
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.95 }}>
          <p style={{ margin: 0, marginBottom: 8, color: "#eafff5" }}>
          This is a learning project exploring React. <br/>
          It’s a mobile-first, drum-machine-style rhythm maker featuring:
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.35 }}>
            <li>
              <span style={{ color: "#1fe0b3", fontWeight: 700 }}>16/32-step</span> grid
              (place hits)
            </li>
            <li>
              <span style={{ color: "#8be9fd", fontWeight: 700 }}>Pitch</span> (tune each
              sound)
            </li>
            <li>
              <span style={{ color: "#ff79c6", fontWeight: 700 }}>Sidechain</span> (auto-duck
              other sounds)
            </li>
            <li>
              <span style={{ color: "#50fa7b", fontWeight: 700 }}>Delay</span>/<span style={{ color: "#7dcfff", fontWeight: 700 }}>Reverb</span> (space & echoes)
            </li>
            <li>
              <span style={{ color: "#fdb470", fontWeight: 700 }}>Saturation</span> (add grit)
            </li>
            <li>
              <span style={{ color: "#f1fa8c", fontWeight: 700 }}>Swing</span> (groove/shuffle)
            </li>
            <li>
              <span style={{ color: "#a29bfe", fontWeight: 700 }}>Drum-bus compression</span> (glue the kit)
            </li>
          </ul>
          <p style={{ margin: "8px 0 0 0", color: "#c4ffd8" }}>Have fun! :)</p>
        </div>
  
        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.9 }}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 4,
              color: "#ffb84d",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Disclaimer
          </div>
          <p style={{ margin: 0, color: "#e8fff4" }}>
            Your data lives locally in your browser — consider exporting a backup. <br/>
            Occasional bugs or data loss are possible. No warranties. 💚
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
              border: "1px solid rgba(31,224,179,.55)",
              background: "linear-gradient(180deg, #1fe0b3, #0fa67f)",
              color: "#071a12",
              cursor: "pointer",
              touchAction: "manipulation",
              fontWeight: 800,
              letterSpacing: 0.5,
              boxShadow:
                "0 0 14px rgba(6,214,160,.35), inset 0 1px 0 rgba(255,255,255,.35), 0 3px 0 rgba(0,0,0,.45)",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}  