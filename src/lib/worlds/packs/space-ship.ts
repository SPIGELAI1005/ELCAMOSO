import type { WorldPack } from "../types";

/** Space Ship keeps the original Space Drive world (Round 4) unchanged. */
export const SPACE_SHIP_PACK: WorldPack = {
  id: "world-space-drive",
  name: "Space Drive",
  tagline: "Reactor · Energy · Warp",
  character: "Cabin · Void · Thrust",
  packGain: 0.28,
  eventCooldownSec: 4,
  // Rocket Car thrust bass; whistle/shimmer only swell briefly, then stay low under the thrust.
  thrust: { level: 0.8, subHz: 44, roar: 0.45, cruise: 0.22 },
  debris: { level: 0.34, metal: 0.5, pitch: 0.95 },
  whistle: { floor: 0.12, duck: 0.6, layers: ["windEnergy"] },
  layers: [
    { id: "reactor", label: "Reactor", kind: "drone", level: 0.52, tone: 82, subHz: 50, subLevel: 0.85 },
    { id: "energyField", label: "Energy field", kind: "shimmer", level: 0.15, tone: 420 },
    { id: "cabin", label: "Cabin", kind: "drone", level: 0.35, tone: 130 },
    { id: "thruster", label: "Thruster", kind: "noise", level: 0.52, tone: 280 },
    { id: "windEnergy", label: "Wind energy", kind: "noise", level: 0.13, tone: 900 },
    { id: "warp", label: "Warp", kind: "shimmer", level: 0.24, tone: 175 },
    { id: "regenTone", label: "Recovery", kind: "drone", level: 0.38, tone: 105, subHz: 52, subLevel: 0.4 },
  ],
  // Round 4: shimmer/whistle layers tamed (~-6 to -8 dB), thrust up; idle (reactor+cabin) unchanged.
  stateRules: [
    { state: "idle", gains: { reactor: 0.45, cabin: 0.25 } },
    { state: "stop", gains: { reactor: 0.4, cabin: 0.3 } },
    {
      state: "motion",
      gains: { reactor: 0.55, energyField: 0.35, cabin: 0.3, thruster: 0.35 },
    },
    {
      state: "build",
      gains: {
        reactor: 0.6,
        energyField: 0.5,
        cabin: 0.25,
        thruster: 0.55,
        windEnergy: 0.35,
        warp: 0.35,
      },
    },
    {
      state: "high_energy",
      gains: {
        reactor: 0.55,
        energyField: 0.65,
        thruster: 0.7,
        windEnergy: 0.45,
        warp: 0.7,
        cabin: 0.2,
      },
    },
    {
      state: "coast",
      gains: { reactor: 0.5, energyField: 0.4, cabin: 0.35, windEnergy: 0.25 },
    },
    {
      state: "regen",
      gains: { reactor: 0.4, cabin: 0.35, regenTone: 0.55, energyField: 0.25 },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Original procedural space fiction - no franchise references.",
    version: "0.1.0-dev",
  },
};
