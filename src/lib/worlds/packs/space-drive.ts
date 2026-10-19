import { SPACE_DRIVE_LIFTOFF_THUNDER } from "@/lib/sound/dsp/liftoff-thunder";
import type { WorldPack } from "../types";

export const SPACE_DRIVE_PACK: WorldPack = {
  id: "world-space-drive",
  name: "Space Drive",
  tagline: "Reactor · Energy · Warp",
  character: "Cabin · Void · Thrust",
  packGain: 0.28,
  eventCooldownSec: 4,
  liftOffThunder: SPACE_DRIVE_LIFTOFF_THUNDER,
  // Rocket Car thrust bass under the drive; whistle only swells briefly on build/launch.
  thrust: { level: 0.55, subHz: 44, roar: 0.4, cruise: 0.18 },
  debris: { level: 0.53, metal: 0.5, pitch: 1 },
  whistle: { floor: 0.3, duck: 0.6, layers: ["windEnergy"] },
  layers: [
    { id: "reactor", label: "Reactor", kind: "drone", level: 0.52, tone: 82, subHz: 50, subLevel: 0.85 },
    { id: "energyField", label: "Energy field", kind: "shimmer", level: 0.15, tone: 420, rampTau: 0.7 },
    { id: "cabin", label: "Cabin", kind: "drone", level: 0.35, tone: 130 },
    { id: "thruster", label: "Thruster", kind: "noise", level: 0.52, tone: 280, rampTau: 0.5, loopSec: 11 },
    { id: "windEnergy", label: "Wind energy", kind: "noise", level: 0.13, tone: 900, rampTau: 0.7, loopSec: 13 },
    { id: "warp", label: "Warp", kind: "shimmer", level: 0.24, tone: 175, rampTau: 0.7 },
    { id: "regenTone", label: "Recovery", kind: "drone", level: 0.38, tone: 105, subHz: 52, subLevel: 0.4 },
  ],
  // Round 4: shimmer/whistle layers tamed (~-6 to -8 dB), thrust up; idle (reactor+cabin) unchanged.
  // Round 5: whistle layers (energyField, warp, windEnergy) another ~-7 dB and eased in slowly;
  // the felt bass comes from the bass enhancer swell instead. Idle unchanged.
  stateRules: [
    { state: "idle", gains: { reactor: 0.45, cabin: 0.25 } },
    { state: "stop", gains: { reactor: 0.4, cabin: 0.3 } },
    {
      state: "motion",
      gains: { reactor: 0.55, energyField: 0.16, cabin: 0.3, thruster: 0.35 },
    },
    {
      state: "build",
      gains: {
        reactor: 0.6,
        energyField: 0.23,
        cabin: 0.25,
        thruster: 0.55,
        windEnergy: 0.16,
        warp: 0.16,
      },
    },
    {
      state: "high_energy",
      gains: {
        reactor: 0.55,
        energyField: 0.29,
        thruster: 0.7,
        windEnergy: 0.2,
        warp: 0.32,
        cabin: 0.2,
      },
    },
    {
      state: "coast",
      gains: { reactor: 0.5, energyField: 0.18, cabin: 0.35, windEnergy: 0.11 },
    },
    {
      state: "regen",
      gains: { reactor: 0.4, cabin: 0.35, regenTone: 0.55, energyField: 0.11 },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Original procedural space fiction - no franchise references.",
    version: "0.1.0-dev",
  },
};
