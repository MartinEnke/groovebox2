// src/hooks/useTapGesture.js
import { useRef, useMemo, useEffect } from "react";

// --- Global double-tap zoom guard (iOS) -------------------------------
let _installed = false;
function installGlobalOnce() {
  if (_installed || typeof window === "undefined") return;
  _installed = true;

  let last = 0;
  window.addEventListener(
    "touchend",
    (e) => {
      // Exempt pads (or anything you mark)
      const t = e.target;
      if (t && (t.closest("[data-tap-exempt]") || t.closest(".pad-btn"))) return;

      const now = e.timeStamp || Date.now();
      if (now - last < 300) {
        // second tap within 300ms → stop double-tap zoom
        e.preventDefault();
      }
      last = now;
    },
    { capture: true, passive: false }
  );
}

// --- Hook --------------------------------------------------------------
export default function useTapGesture(onTap, opts = {}) {
  const {
    slop = 10,
    timeoutMs = 600,
    pan = "y",
    enableGlobalGuards = true, // set false if you ever want to opt out
  } = opts;

  // Pan mapping to CSS touch-action for smoother scrolling
  const touchAction = pan === "y" ? "pan-y" : pan === "x" ? "pan-x" : "manipulation";

  const st = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    canceled: false,
    t: 0,
    id: null,
  });

  useEffect(() => {
    if (enableGlobalGuards) installGlobalOnce();
  }, [enableGlobalGuards]);

  return useMemo(() => {
    const onPointerDown = (e) => {
      // Only primary button for mouse; touch/pen OK
      if (e.pointerType === "mouse" && e.button !== 0) return;

      st.current.active = true;
      st.current.canceled = false;
      st.current.id = e.pointerId ?? null;

      st.current.startX = e.clientX ?? 0;
      st.current.startY = e.clientY ?? 0;

      // snapshot scroll to distinguish scroll vs tap
      st.current.startScrollX =
        window.scrollX ?? window.pageXOffset ?? document.documentElement.scrollLeft ?? 0;
      st.current.startScrollY =
        window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;

      st.current.t = performance.now();
    };

    const onPointerMove = (e) => {
      if (!st.current.active || st.current.canceled) return;
      if (st.current.id != null && e.pointerId !== st.current.id) return;

      const dx = Math.abs((e.clientX ?? 0) - st.current.startX);
      const dy = Math.abs((e.clientY ?? 0) - st.current.startY);
      const moved =
        pan === "y" ? dy > slop : pan === "x" ? dx > slop : Math.hypot(dx, dy) > slop;
      if (moved) st.current.canceled = true; // treat as scroll/drag
    };

    const onPointerCancel = () => {
      st.current.active = false;
      st.current.canceled = true;
      st.current.id = null;
    };

    const onPointerUp = (e) => {
      if (st.current.id != null && e.pointerId !== st.current.id) return;

      const dt = performance.now() - st.current.t;

      const curScrollX =
        window.scrollX ?? window.pageXOffset ?? document.documentElement.scrollLeft ?? 0;
      const curScrollY =
        window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;

      const scx = Math.abs(curScrollX - st.current.startScrollX) || 0;
      const scy = Math.abs(curScrollY - st.current.startScrollY) || 0;

      const scrolled = pan === "y" ? scy > 1 : pan === "x" ? scx > 1 : scx + scy > 1;

      const wasTap =
        st.current.active && !st.current.canceled && !scrolled && dt <= timeoutMs;

      st.current.active = false;
      st.current.id = null;

      if (wasTap) onTap?.(e);
    };

    const onKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onTap?.(e);
      }
    };

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      style: {
        touchAction,
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      },
    };
  }, [onTap, slop, timeoutMs, pan, touchAction]);
}
