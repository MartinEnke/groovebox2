// src/components/SoundGate.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

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
  // Prevent duplicate handler runs (e.g., touchstart + click)
  const unlockingRef = useRef(false);

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
        try {
          await engine.ensureRunning?.();
        } catch {}
        if (engine.getCtx?.()?.state === "running") setReady(true);
      })();
    } else {
      setReady(true);
    }

    const onState = () => setReady(engine.getCtx?.()?.state === "running");

    // Prefer event listeners; fall back to property if needed
    if (ctx.addEventListener) {
      ctx.addEventListener("statechange", onState);
    } else {
      const prev = ctx.onstatechange;
      ctx.onstatechange = (...args) => {
        prev?.(...args);
        onState();
      };
    }
    return () => {
      if (ctx.removeEventListener) {
        ctx.removeEventListener("statechange", onState);
      } else if ("onstatechange" in ctx) {
        ctx.onstatechange = null;
      }
    };
  }, [engine, autoResume]);

  // Respect platform filter
  if (onlyOnIOS && !isIOS) return null;

  // Show logic:
  // - If requireAcknowledge: hide once user clicks Continue (ack).
  // - Otherwise: hide when either audio is running OR user clicked Continue.
  const shouldShow = requireAcknowledge ? !ack : !(ready || ack);
  if (!shouldShow) return null;

  // Small media "nudge" for some iOS builds
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
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (unlockingRef.current) return;
    unlockingRef.current = true;

    // Acknowledge immediately so the panel dismisses on mobile even if
    // the AudioContext remains "suspended" for a moment.
    setAck(true);

    // Kick the context; if/when it flips to "running", the listener will sync `ready`.
    try {
      await engine.ensureRunning?.();
    } catch {}
    await nudgeMedia();

    // Extra safety so UI logic downstream treats audio as unlocked for this session.
    setReady(true);

    unlockingRef.current = false;
  };

  const accent = "#1fe0b3";
  const shellFont =
    "'Inter','Avenir Next','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-title"
      // Backdrop is inert (button-only dismissal)
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,.6)",
        paddingTop: 16, // try 12 (or 5) pixels
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          fontFamily: shellFont,
          background: "rgba(20,20,28,.94)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 14,
          maxWidth: 560, // a bit larger on desktop
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
            marginBottom: 20,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#a1ffff",
            textShadow: "0 0 18px rgba(195, 31, 224, 0.12)", // teal glow
          }}
        >
          Hi there!
        </h2>

        <p style={{ margin: 0, fontSize: 15 }}>
          Turn <b style={{ color: accent }}>OFF Silent Mode</b> (ringer switch).<br />
          For safety, <b style={{ color: "#b1113c" }}>double-taps</b> are required on Transport panel.
        </p>

        <div style={{ marginTop: 16, fontSize: 14.5, opacity: 0.95 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>
            This is a learning project to explore <b style={{ color: "#fff999" }}>React</b>.<br />
            It’s a <b style={{ color: "#e777a3" }}>mobile first</b> - <br />
            drum-machine-style rhythm maker with:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <span style={{ color: "#1ad3fc" }}>16/32-step grid</span> (place hits)
            </li>
            <li>
              <span style={{ color: "#93c5fd" }}>Pitch</span> (tune each sound)
            </li>
            <li>
            <span style={{ color: "#f1b1ef" }}>Sidechain</span> (auto-duck other sounds)
            </li>
            <li>
              <span style={{ color: "#a78bfa" }}>Delay</span> /{" "}
              <span style={{ color: "#c4b5fd" }}>Reverb</span> (space & echoes)
            </li>
            <li>
              <span style={{ color: "#f9a74a" }}>Saturation</span> (add grit)
            </li>
            <li>
              <span style={{ color: "#facc15" }}>Swing</span> (groove / shuffle)
            </li>
            <li>
              <span style={{ color: "#34d399" }}>Drum-bus compression</span> (glue the kit)
            </li>
          </ul>
          <p style={{ margin: "10px 0 0 0", color: "#e9fff7" }}>Have fun! :)</p>
        </div>

        <div style={{ marginTop: 14, fontSize: 12.5, opacity: 0.85 }}>
          <div style={{ fontWeight: 750, marginBottom: 4, color: "#f0f3f7" }}>Disclaimer</div>
          <p style={{ margin: 0 }}>
            Session data lives locally in your browser.{" "} <br />
            <span style={{ color: accent }}>Consider exporting backups.</span><br />
            No warranties. 
          </p>
        </div>

        <div style={{ marginTop: 1, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onTouchStart={(e) => unlockNow(e)}
            onPointerDown={(e) => unlockNow(e)}
            onClick={(e) => unlockNow(e)}
            style={{
              fontFamily: shellFont,
              padding: "6px 7px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.18)",
              background: `linear-gradient(180deg, ${accent}33, ${accent}1f)`,
              color: "#eafff6",
              cursor: "pointer",
              fontWeight: 400,
              letterSpacing: 0.3,
              boxShadow:
                "0 0 16px rgba(31,224,179,.26), inset 0 1px 0 rgba(255,255,255,.14), 0 3px 0 rgba(0,0,0,.45)",
              transition: "transform .05s ease, filter .15s ease",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
