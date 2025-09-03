import { useEffect } from "react";

export default function useDisableZoomKeepScroll() {
  useEffect(() => {
    // iOS-specific pinch gestures
    const preventGesture = (e) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    // Block multi-touch pinch but allow single-finger scroll/taps
    const blockMultiTouch = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchstart", blockMultiTouch, { passive: false });
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });

    // Disable double-tap-to-zoom (keeps single taps intact)
    let lastTouchEnd = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });

    // Desktop: block Ctrl/⌘ + wheel zoom (hotkeys like ⌘/+ cannot be blocked)
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchstart", blockMultiTouch);
      document.removeEventListener("touchmove", blockMultiTouch);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);
}
