// src/hooks/useDisablePullToRefresh.js
import { useEffect } from "react";

/**
 * Attach to your scroll container. Allows normal vertical scroll,
 * but prevents the iOS pull-to-refresh gesture when the user
 * drags down starting at scrollTop === 0.
 */
export default function useDisablePullToRefresh(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startY = 0;

    const onTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        startY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const curY = e.touches[0].clientY;
      const dy = curY - startY;

      // If we're at the very top and the user is pulling down, block it
      if (el.scrollTop <= 0 && dy > 0) {
        // must be non-passive to preventDefault
        e.preventDefault();
      }
    };

    // Non-passive so preventDefault actually works on iOS
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart, { passive: false });
      el.removeEventListener("touchmove", onTouchMove, { passive: false });
    };
  }, [ref]);
}
