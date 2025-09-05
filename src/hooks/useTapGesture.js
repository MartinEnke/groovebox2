// src/hooks/useTapGesture.js
import { useRef, useMemo } from "react";

/**
 * useTapGesture(onTap, {
 *   slop?: number = 10,           // px finger can move before it's a pan/scroll (only for trigger:'up')
 *   timeoutMs?: number = 600,     // max tap duration (only for trigger:'up')
 *   pan?: 'y' | 'x' | 'none' = 'y',   // which axis is considered scrolling (only for trigger:'up')
 *   trigger?: 'down' | 'up' = 'down', // fire on pointerdown (fast) or pointerup (swipe-safe)
 * })
 */
export default function useTapGesture(onTap, opts = {}) {
  const {
    slop = 10,
    timeoutMs = 600,
    pan = "y",
    trigger = "down",
  } = opts;

  const touchAction =
    pan === "y" ? "pan-y" : pan === "x" ? "pan-x" : "manipulation";

  const st = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    canceled: false,
    t: 0,
    id: null,
    firedDown: false, // used to suppress synthetic click after pointerdown
  });

  return useMemo(() => {
    const onPointerDown = (e) => {
      // Only primary button for mouse
      if (e.pointerType === "mouse" && e.button !== 0) return;

      st.current.active = true;
      st.current.canceled = false;
      st.current.id = e.pointerId ?? null;

      st.current.startX = e.clientX ?? 0;
      st.current.startY = e.clientY ?? 0;

      st.current.startScrollX =
        window.scrollX ??
        window.pageXOffset ??
        document.documentElement.scrollLeft ??
        0;
      st.current.startScrollY =
        window.scrollY ??
        window.pageYOffset ??
        document.documentElement.scrollTop ??
        0;

      st.current.t = performance.now();

      if (trigger === "down") {
        // Immediate, snappy tap
        e.preventDefault();
        st.current.firedDown = true;
        onTap?.(e);
      }
    };

    const onPointerMove = (e) => {
      if (trigger !== "up") return; // only needed for swipe-safe mode
      if (!st.current.active || st.current.canceled) return;
      if (st.current.id != null && e.pointerId !== st.current.id) return;

      const dx = Math.abs((e.clientX ?? 0) - st.current.startX);
      const dy = Math.abs((e.clientY ?? 0) - st.current.startY);
      const moved =
        pan === "y" ? dy > slop : pan === "x" ? dx > slop : Math.hypot(dx, dy) > slop;
      if (moved) st.current.canceled = true;
    };

    const onPointerCancel = () => {
      st.current.active = false;
      st.current.canceled = true;
      st.current.id = null;
      st.current.firedDown = false;
    };

    const onPointerUp = (e) => {
      if (st.current.id != null && e.pointerId !== st.current.id) return;

      if (trigger === "down") {
        // We already fired on pointerdown; just reset state
        st.current.active = false;
        st.current.id = null;
        return;
      }

      const dt = performance.now() - st.current.t;

      const curScrollX =
        window.scrollX ??
        window.pageXOffset ??
        document.documentElement.scrollLeft ??
        0;
      const curScrollY =
        window.scrollY ??
        window.pageYOffset ??
        document.documentElement.scrollTop ??
        0;

      const scx = Math.abs(curScrollX - st.current.startScrollX) || 0;
      const scy = Math.abs(curScrollY - st.current.startScrollY) || 0;
      const scrolled = pan === "y" ? scy > 1 : pan === "x" ? scx > 1 : scx + scy > 1;

      const wasTap =
        st.current.active && !st.current.canceled && !scrolled && dt <= timeoutMs;

      st.current.active = false;
      st.current.id = null;

      if (wasTap) onTap?.(e);
    };

    // Suppress the synthetic click that may follow pointerdown on some browsers
    const onClick = (e) => {
      if (trigger === "down" && st.current.firedDown) {
        st.current.firedDown = false;
        e.preventDefault?.();
        e.stopPropagation?.();
      }
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
      onClick,
      onKeyDown,
      style: {
        touchAction,
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      },
    };
  }, [onTap, slop, timeoutMs, pan, trigger, touchAction]);
}
