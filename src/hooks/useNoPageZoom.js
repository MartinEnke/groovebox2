// src/hooks/useNoPageZoom.js
import { useEffect } from "react";

export default function useNoPageZoom() {
  useEffect(() => {
    // Block iOS pinch zoom (“gesture*” events are iOS-only)
    const preventGesture = (e) => { e.preventDefault(); };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    // Block multi-touch pinch on other UAs
    const preventMultiTouch = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchstart", preventMultiTouch, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });

    // Block double-tap to zoom on iOS
    let lastTouchEnd = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });

    // Block ctrl+wheel zoom (desktop trackpads)
    const onWheel = (e) => {
      if (e.ctrlKey) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchstart", preventMultiTouch);
      document.removeEventListener("touchmove", preventMultiTouch);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);
}
