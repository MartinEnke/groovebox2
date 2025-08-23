// Small helpers for building per-instrument maps consistently
import { INSTRUMENTS } from "../constants/instruments";
import { STEPS_PER_BAR } from "../constants/sequencer";

export const buildMap = (val) =>
  Object.fromEntries(INSTRUMENTS.map((i) => [i.id, val]));

export const buildRowActiveMap = (a = true, b = false) =>
  Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A: a, B: b }]));

export const buildRowExpandedMap = (A = false, B = false) =>
  Object.fromEntries(INSTRUMENTS.map((i) => [i.id, { A, B }]));

export const buildUiLatchedRowMap = (row = "A") =>
  Object.fromEntries(INSTRUMENTS.map((i) => [i.id, row]));

// { instId: { A:[..16], B:[..16] } }
export const buildPatternMap = (steps = STEPS_PER_BAR) =>
  Object.fromEntries(
    INSTRUMENTS.map((i) => [
      i.id,
      { A: new Array(steps).fill(0), B: new Array(steps).fill(0) },
    ])
  );

// Safely clone/rewrite a single instrument’s pattern row
export function withStep(patterns, instId, row, stepIdx, value) {
  const next = { ...patterns };
  const p = next[instId] || { A: [], B: [] };
  next[instId] = { A: [...p.A], B: [...p.B] };
  next[instId][row][stepIdx] = value;
  return next;
}
