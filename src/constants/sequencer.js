// src/constants/sequencer.js

// Pad velocities (2x2)
export const VELS = [
  [1.0, 0.6],
  [0.75, 0.45],
];

// Click-step cycle order for step buttons
export const STEP_CYCLE_ORDER = [0.45, 0.6, 0.75, 1.0, 0];

// Sequencer timing
export const PPQ = 4;                // steps per beat (16 steps/bar)
export const STEPS_PER_BAR = 16;
export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_TIME = 0.1;

// Sidechain cap
export const MAX_SC_LINKS = 4;

// Choke groups: when a source plays, these targets get choked
export const CHOKE_GROUPS = {
  hihat: ["openhihat"], // closed HH cuts open HH
  // add more if needed, e.g. rim: ["clap"]
};
