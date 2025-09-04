// src/hooks/useTapGesture.js
import { useRef, useMemo } from "react";

export default function useTapGesture(onTap, opts = {}) {
  const { slop = 10, timeoutMs = 600, pan = "y" } = opts;
  const st = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    canceled: false,
    t: 0,
  });

  const touchAction = pan === "y" ? "pan-y" : pan === "x" ? "pan-x" : "manipulation";

  return useMemo(() => {
    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // only left-click
      st.current.active = true;
      st.current.canceled = false;
      st.current.startX = e.clientX ?? 0;
      st.current.startY = e.clientY ?? 0;
      st.current.startScrollX =
        window.scrollX ?? window.pageXOffset ?? document.documentElement.scrollLeft ?? 0;
      st.current.startScrollY =
        window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;
      st.current.t = performance.now();
    };

    const onPointerMove = (e) => {
      if (!st.current.active || st.current.canceled) return;
      const dx = Math.abs((e.clientX ?? 0) - st.current.startX);
      const dy = Math.abs((e.clientY ?? 0) - st.current.startY);
      const moved =
        pan === "y" ? dy > slop : pan === "x" ? dx > slop : Math.hypot(dx, dy) > slop;
      if (moved) st.current.canceled = true; // treat as scroll/drag
    };

    const onPointerCancel = () => {
      st.current.active = false;
      st.current.canceled = true;
    };

    const onPointerUp = (e) => {
      const dt = performance.now() - st.current.t;
      const scx =
        Math.abs(
          (window.scrollX ?? window.pageXOffset ?? document.documentElement.scrollLeft ?? 0) -
            st.current.startScrollX
        ) || 0;
      const scy =
        Math.abs(
          (window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0) -
            st.current.startScrollY
        ) || 0;

      const scrolled =
        pan === "y" ? scy > 1 : pan === "x" ? scx > 1 : scx + scy > 1;

      const wasTap =
        st.current.active && !st.current.canceled && !scrolled && dt <= timeoutMs;

      st.current.active = false;
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
