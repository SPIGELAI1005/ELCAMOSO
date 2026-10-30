import type { FusionPreset } from "./types";

/**
 * Built-in Fusion presets - Engine + Symphony blends.
 * No OEM names. Neon Run uses procedural Symphony pack.
 */
export const FUSION_PRESETS: readonly FusionPreset[] = [
  {
    id: "fusion-road-anthem",
    name: "Road Anthem",
    tagline: "American V8 · Rock Anthem",
    description: "Thunderous V8 rumble inside a rock anthem - speed adds the layers.",
    machineProfileId: "american-muscle-v8",
    symphonyProfileId: "symphony-cinematic-rock",
    defaultMix: 0.6,
    harmonicResonance: 0.25,
    softPump: false,
    adaptiveMusic: true,
  },
  {
    id: "fusion-mechanical-symphony",
    name: "Mechanical Symphony",
    tagline: "Flat-Six · Motion Orchestra",
    description: "Precision engine character woven through orchestral motion.",
    machineProfileId: "flat-six-sport",
    symphonyProfileId: "symphony-motion-orchestra",
    defaultMix: 0.58,
    harmonicResonance: 0.35,
    softPump: false,
  },
  {
    id: "fusion-midnight-boost",
    name: "Midnight Boost",
    tagline: "Turbo I6 · Dark Rave",
    description: "Night-drive boost inside a dark rock-house rave - speed adds the layers.",
    machineProfileId: "turbo-inline-6",
    symphonyProfileId: "symphony-neon-run",
    defaultMix: 0.62,
    harmonicResonance: 0.2,
    softPump: false,
    adaptiveMusic: true,
  },
  {
    id: "fusion-future-pulse",
    name: "Future Pulse",
    tagline: "Electric Hyperdrive · Neon Run",
    description: "Electric hyperdrive and neon arrangement as one future voice.",
    machineProfileId: "electric-hypercar",
    symphonyProfileId: "symphony-neon-run",
    defaultMix: 0.65,
    harmonicResonance: 0.3,
    softPump: false,
  },
] as const;

let runtimePresets: FusionPreset[] = [];
let studioPreview: FusionPreset | null = null;

/** Garage-saved Fusion blends registered at runtime. */
export function setRuntimeFusionPresets(presets: FusionPreset[]) {
  runtimePresets = presets.filter((p) => p.id !== studioPreview?.id);
}

/** Temporary Studio Fusion audition - does not wipe Garage runtime presets. */
export function setFusionStudioPreview(preset: FusionPreset | null) {
  studioPreview = preset;
}

export function getFusionPreset(id: string): FusionPreset | null {
  if (studioPreview?.id === id) return studioPreview;
  return FUSION_PRESETS.find((p) => p.id === id) ?? runtimePresets.find((p) => p.id === id) ?? null;
}

export function isFusionProfileId(id: string): boolean {
  return Boolean(getFusionPreset(id));
}

export function listFusionPresets(): FusionPreset[] {
  const base = [...FUSION_PRESETS, ...runtimePresets];
  if (studioPreview && !base.some((p) => p.id === studioPreview!.id)) {
    return [...base, studioPreview];
  }
  return base;
}
