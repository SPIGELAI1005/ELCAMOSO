import type { StudioTweaks } from "@/lib/drive/settings";
import { DEFAULT_LAYER_MIX, LAYER_KEYS, type LayerMix } from "@/lib/sound/environments";

/** Human-language Studio Basic axes, each 0..1. */
export interface StudioBasicFeel {
  /** Smooth → Raw (grit + character) */
  character: number;
  /** Light → Heavy (brightness, inverted) */
  weight: number;
  /** Relaxed → Instant (rhythm) */
  response: number;
  /** Deep → High (pitch) */
  pitch: number;
  /** Clean → Mechanical (texture) */
  texture: number;
  /** Intimate → Wide (layer space / wet) */
  space: number;
}

export type StudioBasicKey = keyof StudioBasicFeel;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function unlerp(a: number, b: number, v: number): number {
  if (b === a) return 0;
  return clamp01((v - a) / (b - a));
}

function roundStep(v: number, step = 0.05): number {
  return Math.round(v / step) * step;
}

/** Read Basic feel from existing tweaks + mix (no new DSP). */
export function basicFeelFromTuning(
  tweaks: StudioTweaks,
  mix: LayerMix = DEFAULT_LAYER_MIX,
): StudioBasicFeel {
  const wetAvg = LAYER_KEYS.reduce((sum, key) => sum + mix[key].wet, 0) / LAYER_KEYS.length;
  return {
    character: (unlerp(0, 2, tweaks.grit) + unlerp(0, 2, tweaks.character)) / 2,
    weight: 1 - unlerp(0.4, 2, tweaks.brightness),
    response: unlerp(0, 2, tweaks.rhythm),
    pitch: unlerp(0.5, 2, tweaks.pitch),
    texture: unlerp(0, 2, tweaks.texture),
    space: unlerp(0.05, 0.85, wetAvg),
  };
}

/** Apply one Basic axis onto existing tweaks / mix. */
export function applyBasicFeel(
  key: StudioBasicKey,
  value: number,
  tweaks: StudioTweaks,
  mix: LayerMix,
): { tweaks: StudioTweaks; mix: LayerMix } {
  const t = clamp01(value);
  switch (key) {
    case "character": {
      const mapped = roundStep(lerp(0, 2, t));
      return {
        tweaks: { ...tweaks, grit: mapped, character: mapped },
        mix,
      };
    }
    case "weight":
      return {
        tweaks: { ...tweaks, brightness: roundStep(lerp(2, 0.4, t)) },
        mix,
      };
    case "response":
      return {
        tweaks: { ...tweaks, rhythm: roundStep(lerp(0, 2, t)) },
        mix,
      };
    case "pitch":
      return {
        tweaks: { ...tweaks, pitch: roundStep(lerp(0.5, 2, t), 0.05) },
        mix,
      };
    case "texture":
      return {
        tweaks: { ...tweaks, texture: roundStep(lerp(0, 2, t)) },
        mix,
      };
    case "space": {
      const wet = roundStep(lerp(0.05, 0.85, t), 0.01);
      return {
        tweaks,
        mix: {
          body: { ...mix.body, wet },
          beds: { ...mix.beds, wet },
          accents: { ...mix.accents, wet },
        },
      };
    }
  }
}

export const BASIC_FEEL_SLIDERS: {
  key: StudioBasicKey;
  label: string;
  left: string;
  right: string;
}[] = [
  { key: "character", label: "Character", left: "Smooth", right: "Raw" },
  { key: "weight", label: "Weight", left: "Light", right: "Heavy" },
  { key: "response", label: "Response", left: "Relaxed", right: "Instant" },
  { key: "pitch", label: "Pitch", left: "Deep", right: "High" },
  { key: "texture", label: "Texture", left: "Clean", right: "Mechanical" },
  { key: "space", label: "Space", left: "Intimate", right: "Wide" },
];
