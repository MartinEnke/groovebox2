import { useRef, useMemo } from "react";

/**
 * useTapGesture(onTap, {
 *   slop?: number = 10,            // finger move threshold to treat as a scroll/drag
 *   timeoutMs?: number = 600,      // max tap duration
 *   pan?: 'y'|'x'|'none' = 'y',    // sets touch-action for the element
 *   trigger?: 'down'|'up' = 'up',  // 'up' = swipe-safe, 'down' = ultra-fast
 *   exemptSelector?: string        // elements that should bypass guard (e.g. pads)
 * })
 */
export default function useTapGesture(onTap, opts = {}) {
  const {
    slop = 10,
    timeoutMs = 600,
    pan = "y",
    trigger = "up",
    exemptSelector = "[data-tap-exempt], .pad-btn",
  } = opts;

  const touchAction =
    pan === "y" ? "pan-y" : pan === "x" ? "pan-x" : "manipulation";

  const st = useRef({
    active: false,
    startX: 0,
    startY: 0,
    canceled: false,
    t: 0,
    id: null,
    firedDown: false,
  });

  const isExempt = (target) => !!target?.closest?.(exemptSelector);

  return useMemo(() => {
    const onPointerDown = (e) => {
      if (isExempt(e.target)) return;                 // never guard exempt targets
      if (e.pointerType === "mouse" && e.button !== 0) return;

      st.current.active = true;
      st.current.canceled = false;
      st.current.id = e.pointerId ?? null;
      st.current.startX = e.clientX ?? 0;
      st.current.startY = e.clientY ?? 0;
      st.current.t = performance.now();

      if (trigger === "down") {
        e.preventDefault?.();
        st.current.firedDown = true;
        onTap?.(e);
      }
    };

    const onPointerMove = (e) => {
      if (trigger !== "up") return;
      if (!st.current.active || st.current.canceled) return;
      if (st.current.id != null && e.pointerId !== st.current.id) return;
      if (isExempt(e.target)) return;

      const dx = Math.abs((e.clientX ?? 0) - st.current.startX);
      const dy = Math.abs((e.clientY ?? 0) - st.current.startY);
      const moved =
        pan === "y" ? dy > slop : pan === "x" ? dx > slop : Math.hypot(dx, dy) > slop;

      if (moved) st.current.canceled = true;          // treat as scroll/drag
    };

    const onPointerCancel = () => {
      st.current.active = false;
      st.current.canceled = true;
      st.current.id = null;
      st.current.firedDown = false;
    };

    const onPointerUp = (e) => {
      if (st.current.id != null && e.pointerId !== st.current.id) return;
      if (isExempt(e.target)) return;

      if (trigger === "down") {
        st.current.active = false;
        st.current.id = null;
        return;
      }

      const dt = performance.now() - st.current.t;
      const wasTap = st.current.active && !st.current.canceled && dt <= timeoutMs;

      st.current.active = false;
      st.current.id = null;

      if (wasTap) onTap?.(e);
    };

    // Prevent synthetic click only for trigger:'down'
    const onClick = (e) => {
      if (isExempt(e.target)) return;
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
  }, [onTap, slop, timeoutMs, pan, trigger, exemptSelector, touchAction]);
}
