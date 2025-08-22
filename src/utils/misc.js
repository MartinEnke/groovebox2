// ===== Utility helpers =====
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
export const dbToGain = (db) => Math.pow(10, db / 20);

// Ensure arrays are length 16
export const coerce16 = (arr) => {
  const a = Array.isArray(arr) ? arr.slice(0, 16) : [];
  while (a.length < 16) a.push(0);
  return a;
};

// Deep copy util to avoid mutating state inputs
export const deepClone = (x) => JSON.parse(JSON.stringify(x));

