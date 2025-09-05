// src/engine/unlockAudio.js
let getCtxRef = null;

// Call this once (e.g., in GrooveBox) to provide a way to access your audio context.
export function bindGlobalAudioUnlock(getCtx) {
  getCtxRef = getCtx;
  const resume = () => { ensureAudioNow(); };
  const opts = { passive: true, capture: true };
  window.addEventListener("pointerdown", resume, opts);
  window.addEventListener("keydown", resume, opts);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ensureAudioNow();
  }, opts);
}

/**
 * Ensures the WebAudio context is running.
 * @returns {Promise<boolean>} true if we resumed the context on this call (i.e., it had been suspended)
 */
export async function ensureAudioNow() {
  try {
    if (!getCtxRef) return false;
    const ctx = getCtxRef();
    if (!ctx) return false;

    // If you use Tone.js, you can do:
    // if (window.Tone && Tone.context && Tone.context.state !== 'running') {
    //   await Tone.start();
    //   return true;
    // }

    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      await ctx.resume();         // must happen before starting any sources
      return true;                // we just resumed
    }
  } catch (e) {
    // swallow—some browsers throw if resume not allowed
  }
  return false;                   // already running (or no ctx)
}
