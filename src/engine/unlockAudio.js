let unlocked = false;

/**
 * Bind global listeners that resume the AudioContext on the first user gesture.
 * Pass either the context or a getter that returns it.
 */
export function bindGlobalAudioUnlock(getCtxOrCtx) {
  if (unlocked) return;

  const getCtx = () =>
    typeof getCtxOrCtx === "function" ? getCtxOrCtx() : getCtxOrCtx;

  const tryResume = async () => {
    const ctx = getCtx();
    if (!ctx) return;

    // If you use Tone.js, replace the next two lines with: await Tone.start();
    if (ctx.state !== "running") await ctx.resume?.();

    if (ctx.state === "running") {
      unlocked = true;
      // cleanup
      events.forEach((ev) =>
        document.removeEventListener(ev, tryResume, listenerOpts)
      );
    }
  };

  const events = ["pointerdown", "touchstart", "mousedown", "keydown"];
  const listenerOpts = { capture: true, passive: true };
  events.forEach((ev) => document.addEventListener(ev, tryResume, listenerOpts));

  // expose a manual nudge you can call inside handlers
  window.gbEnsureAudio = tryResume;
}

/** Call this inside any UI handler to ensure the ctx is running. */
export function ensureAudioNow() {
  if (typeof window !== "undefined" && window.gbEnsureAudio) {
    window.gbEnsureAudio();
  }
}
