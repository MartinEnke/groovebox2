// src/engine/unlockAudio.js
let getCtxRef = null;
let armed = false;

export function bindGlobalAudioUnlock(getCtx) {
  getCtxRef = getCtx;
  if (armed) return;             // don't double-bind in StrictMode/dev
  armed = true;

  const opts = { capture: true, passive: false };

  const onGesture = async () => {
    const did = await ensureAudioNow();
    if (did) {
      primeSilentTick();         // fully warms outputs on iOS
      teardown();
    }
  };

  const onVis = () => {
    if (document.visibilityState === "visible") onGesture();
  };

  function teardown() {
    window.removeEventListener("pointerdown", onGesture, opts);
    window.removeEventListener("touchstart", onGesture, opts);
    window.removeEventListener("mousedown", onGesture, opts);
    window.removeEventListener("click", onGesture, opts);
    window.removeEventListener("keydown", onGesture, opts);
    document.removeEventListener("visibilitychange", onVis, opts);
    armed = false;
  }

  window.addEventListener("pointerdown", onGesture, opts);
  window.addEventListener("touchstart", onGesture, opts);
  window.addEventListener("mousedown", onGesture, opts);
  window.addEventListener("click", onGesture, opts);
  window.addEventListener("keydown", onGesture, opts);
  document.addEventListener("visibilitychange", onVis, opts);
}

/** Ensures the WebAudio context is running. Returns true if we resumed now. */
export async function ensureAudioNow() {
  try {
    if (!getCtxRef) return false;

    // Tone.js path (if you use it internally)
    if (typeof window !== "undefined" && window.Tone && window.Tone.context) {
      if (window.Tone.context.state !== "running") {
        await window.Tone.start();        // must be in user gesture
        return true;
      }
      return false;
    }

    // Raw AudioContext path
    const ctx = getCtxRef();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      await ctx.resume();                 // call happens during the gesture
      return true;
    }
  } catch (_) {}
  return false;
}

/** Plays a 0-sample silent buffer to “open” the output path on iOS. */
function primeSilentTick() {
  try {
    const ctx = getCtxRef();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(ctx.destination);
    src.start(0);
    src.stop(0);
  } catch {}
}
