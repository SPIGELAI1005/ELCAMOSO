import type { WorldPack } from "../types";

export const SPACE_DRIVE_PACK: WorldPack = {
  id: "world-space-drive",
  name: "Space Drive",
  tagline: "Reactor · Energy · Warp",
  character: "Cabin · Void · Thrust",
  packGain: 0.55,
  eventCooldownSec: 4,
  layers: [
    { id: "reactor", label: "Reactor", kind: "drone", level: 0.55, tone: 55 },
    { id: "energyField", label: "Energy field", kind: "shimmer", level: 0.4, tone: 420 },
    { id: "cabin", label: "Cabin", kind: "drone", level: 0.35, tone: 120 },
    { id: "thruster", label: "Thruster", kind: "noise", level: 0.45, tone: 280 },
    { id: "windEnergy", label: "Wind energy", kind: "noise", level: 0.3, tone: 900 },
    { id: "warp", label: "Warp", kind: "shimmer", level: 0.5, tone: 180 },
    { id: "regenTone", label: "Recovery", kind: "drone", level: 0.4, tone: 90 },
  ],
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
