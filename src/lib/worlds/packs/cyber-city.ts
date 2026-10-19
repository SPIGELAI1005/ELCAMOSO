import type { WorldPack } from "../types";

export const CYBER_CITY_PACK: WorldPack = {
  id: "world-cyber-city",
  name: "Cyber City",
  tagline: "Pulse · Neon · Digital",
  character: "Pulse · Grid · Night",
  packGain: 0.28,
  eventCooldownSec: 2.5,
  // Thrust bass on acceleration; accel shimmer only swells briefly.
  thrust: { level: 0.85, subHz: 48, roar: 0.3, cruise: 0.2 },
  debris: { level: 1.55, metal: 0.6, pitch: 1 },
  whistle: { floor: 0.25, duck: 0.6 },
  layers: [
    { id: "digitalPulse", label: "Digital pulse", kind: "pulse", level: 0.45, tone: 95 },
    { id: "synthBody", label: "Synth body", kind: "drone", level: 0.48, tone: 85 },
    { id: "cityAmbience", label: "City ambience", kind: "noise", level: 0.35, tone: 600 },
    { id: "accelShimmer", label: "Accel shimmer", kind: "shimmer", level: 0.42, tone: 1400 },
    { id: "regenReversal", label: "Regen reverse", kind: "drone", level: 0.38, tone: 115 },
    { id: "speedAmbience", label: "Speed ambience", kind: "noise", level: 0.38, tone: 1100 },
  ],
  stateRules: [
    { state: "idle", gains: { synthBody: 0.35, cityAmbience: 0.2 } },
    { state: "stop", gains: { synthBody: 0.3, cityAmbience: 0.25, digitalPulse: 0.15 } },
    {
      state: "motion",
      gains: {
        digitalPulse: 0.45,
        synthBody: 0.5,
        cityAmbience: 0.35,
        speedAmbience: 0.3,
      },
    },
    {
      state: "build",
      gains: {
        digitalPulse: 0.6,
        synthBody: 0.6,
        cityAmbience: 0.3,
        accelShimmer: 0.5,
        speedAmbience: 0.45,
      },
    },
    {
      state: "high_energy",
      gains: {
        digitalPulse: 0.75,
        synthBody: 0.65,
        accelShimmer: 0.7,
        speedAmbience: 0.6,
        cityAmbience: 0.25,
      },
    },
    {
      state: "coast",
      gains: { digitalPulse: 0.35, synthBody: 0.45, cityAmbience: 0.4, speedAmbience: 0.25 },
    },
    {
      state: "regen",
      gains: {
        synthBody: 0.4,
        regenReversal: 0.55,
        digitalPulse: 0.25,
        cityAmbience: 0.3,
      },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Original procedural cyber soundscape.",
    version: "0.1.0-dev",
  },
};
