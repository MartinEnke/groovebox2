import { useEffect } from "react";
export default function useNoHorizontalWheel() {
  useEffect(() => {
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();            // block sideways
        // Optionally map horizontal to vertical:
        // window.scrollBy({ top: e.deltaX, behavior: 'auto' });
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);
}