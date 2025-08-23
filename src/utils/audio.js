// src/utils/audio.js
// Small audio helpers used across the app

export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain) {
  return 20 * Math.log10(Math.max(gain, 1e-8));
}

export async function fetchAndDecode(ctx, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();

  // Promise form (newer Safari/Chromium) vs callback form (older)
  if (ctx.decodeAudioData.length === 1) {
    return await ctx.decodeAudioData(ab);
  }
  return await new Promise((resolve, reject) =>
    ctx.decodeAudioData(ab, resolve, reject)
  );
}

export function createClickBuffer(ctx, freq = 2000, dur = 0.002) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * dur));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const twoPiF = 2 * Math.PI * freq;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 80); // very fast decay for a tight click
    data[i] = Math.sin(twoPiF * t) * env * 0.9;
  }
  return buf;
}

export function makeImpulseResponse(ctx, duration = 1.0, decay = 2.0) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * duration));
  const buf = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // noise with exponential decay tail
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, decay);
    }
  }
  return buf;
}
