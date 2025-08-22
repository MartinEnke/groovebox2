export async function fetchAndDecode(ctx, url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }
  
  export function createClickBuffer(ctx, freq = 2000, dur = 0.003) {
    const length = Math.max(1, Math.floor(dur * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * 50);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
    }
    return buffer;
  }
  
  export function makeImpulseResponse(ctx, duration = 2.5, decay = 2.5) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(duration * rate));
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        data[i] = (Math.random() * 2 - 1) * env;
        if (i > 200 && i < 1200) data[i] += 0.003 * (Math.random() * 2 - 1);
      }
    }
    return impulse;
  }
  