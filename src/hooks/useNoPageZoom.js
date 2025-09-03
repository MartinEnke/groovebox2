// src/hooks/useNoPageScroll.js
import { useEffect } from "react";

export default function useNoPageScroll() {
  useEffect(() => {
    const prevent = (e) => e.preventDefault();

    // iOS: Pinch (gesture*) + Multi-Touch
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("gestureend", prevent, { passive: false });

    const blockMultiTouch = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    document.addEventListener("touchstart", blockMultiTouch, { passive: false });
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });

    // Doppeltipp-Zoom auf iOS
    let lastTouchEnd = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });

    // Trackpad/CTRL-Zoom & Scroll-Events komplett unterbinden
    const onWheel = (e) => { if (e.ctrlKey) e.preventDefault(); else e.preventDefault(); };
    window.addEventListener("wheel", onWheel, { passive: false });

    // Falls irgendwas doch versucht zu scrollen: sofort zurücksetzen
    const snapBack = () => { if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0); };
    window.addEventListener("scroll", snapBack, { passive: true });

    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("gestureend", prevent);
      document.removeEventListener("touchstart", blockMultiTouch);
      document.removeEventListener("touchmove", blockMultiTouch);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", snapBack);
    };
  }, []);
}
