import type { WorldPack } from "../types";

export const STORM_RUN_PACK: WorldPack = {
  id: "world-storm-run",
  name: "Storm Run",
  tagline: "Wind · Thunder · Atmosphere",
  character: "Wind · Pressure · Rain",
  packGain: 0.5,
  eventCooldownSec: 8,
  layers: [
    { id: "wind", label: "Wind", kind: "noise", level: 0.55, tone: 800 },
    { id: "thunder", label: "Distant thunder", kind: "impact", level: 0.28, tone: 60 },
    { id: "airPressure", label: "Air pressure", kind: "drone", level: 0.4, tone: 45 },
    { id: "rain", label: "Rain movement", kind: "noise", level: 0.35, tone: 2200 },
    { id: "cinematicTone", label: "Cinematic tone", kind: "drone", level: 0.45, tone: 100 },
  ],
  stateRules: [
    { state: "idle", gains: { airPressure: 0.3, cinematicTone: 0.25, rain: 0.15 } },
    { state: "stop", gains: { airPressure: 0.35, cinematicTone: 0.3, rain: 0.2 } },
    {
      state: "motion",
      gains: { wind: 0.45, airPressure: 0.35, rain: 0.3, cinematicTone: 0.35 },
    },
    {
      state: "build",
      gains: {
        wind: 0.6,
        airPressure: 0.45,
        rain: 0.4,
        cinematicTone: 0.45,
        thunder: 0.12,
      },
    },
    {
      state: "high_energy",
      gains: {
        wind: 0.75,
        airPressure: 0.55,
        rain: 0.5,
        cinematicTone: 0.5,
        thunder: 0.18,
      },
    },
    {
      state: "coast",
      gains: { wind: 0.4, airPressure: 0.4, rain: 0.35, cinematicTone: 0.4 },
    },
    {
      state: "regen",
      gains: { wind: 0.3, airPressure: 0.45, rain: 0.4, cinematicTone: 0.35 },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Thunder is soft, rate-limited, and limited - never startling spikes.",
    version: "0.1.0-dev",
  },
};
