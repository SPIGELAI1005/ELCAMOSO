/**
 * Driving environments. Each preset describes the space the sound is heard in
 * (size, damping, wetness, stereo spread) and how it rebalances the layers of
 * a profile while you drive: a gravel road pushes texture forward, an old town
 * throws accents back at you, rain softens the top end.
 */

export type LayerKey = "body" | "beds" | "accents";

/** Per-layer mixer values used by the Studio and the engine. */
export interface LayerSetting {
  /** 0..2 layer volume */
  volume: number;
  /** 0..2 tone tilt: below 1 darker, above 1 brighter */
  tone: number;
  /** 0..1 how much of the layer is sent to the space */
  wet: number;
}

export type LayerMix = Record<LayerKey, LayerSetting>;

export const LAYER_KEYS: LayerKey[] = ["body", "beds", "accents"];

export const LAYER_LABELS: Record<LayerKey, { name: string; hint: string }> = {
  body: { name: "Core voice", hint: "The tonal heart of the profile" },
  beds: { name: "Texture beds", hint: "Water, wind, gravel and rumble" },
  accents: { name: "Accents", hint: "Hooves, bells, chuffs and signatures" },
};

export const DEFAULT_LAYER_MIX: LayerMix = {
  body: { volume: 1, tone: 1, wet: 0.12 },
  beds: { volume: 1, tone: 1, wet: 0.24 },
  accents: { volume: 1, tone: 1, wet: 0.3 },
};

export interface EnvironmentPreset {
  id: string;
  name: string;
  description: string;
  /** reverb tail length in seconds */
  size: number;
  /** 0..1 high-frequency absorption of the space */
  damping: number;
  /** 0..1 base wet amount on top of the per-layer sends */
  wet: number;
  /** 0..1 stereo width of the moving layers */
  spread: number;
  /** static balance applied on top of the profile's own mix */
  balance: Record<LayerKey, number>;
  /**
   * How the space reacts to driving state. Each value is applied per unit of
   * the matching drive signal, so layers keep rebalancing as you move.
   */
  motion: {
    /** wet change from speed load, negative = drier the faster you go */
    wetBySpeed: number;
    /** wet change while regenerating */
    wetByRegen: number;
    /** texture-bed lift with speed */
    bedsBySpeed: number;
    /** accent lift with throttle */
    accentsByThrottle: number;
    /** core voice lift with throttle */
    bodyByThrottle: number;
  };
}

export const ENVIRONMENTS: EnvironmentPreset[] = [
  {
    id: "open",
    name: "Open road",
    description: "No walls. Dry, direct and closest to the raw profile.",
    size: 0.7,
    damping: 0.35,
    wet: 0.1,
    spread: 0.3,
    balance: { body: 1, beds: 1, accents: 1 },
    motion: {
      wetBySpeed: -0.03,
      wetByRegen: 0.04,
      bedsBySpeed: 0.2,
      accentsByThrottle: 0.15,
      bodyByThrottle: 0.1,
    },
  },
  {
    id: "city",
    name: "City street",
    description: "Tight early reflections off facades. Accents snap back at you.",
    size: 1.4,
    damping: 0.3,
    wet: 0.26,
    spread: 0.55,
    balance: { body: 1.05, beds: 0.82, accents: 1.2 },
    motion: {
      wetBySpeed: -0.1,
      wetByRegen: 0.1,
      bedsBySpeed: 0.15,
      accentsByThrottle: 0.3,
      bodyByThrottle: 0.14,
    },
  },
  {
    id: "countryside",
    name: "Countryside gravel",
    description: "Wide open field with loose stones under the wheels.",
    size: 2.6,
    damping: 0.6,
    wet: 0.2,
    spread: 0.85,
    balance: { body: 0.92, beds: 1.35, accents: 1.05 },
    motion: {
      wetBySpeed: 0.05,
      wetByRegen: 0.06,
      bedsBySpeed: 0.55,
      accentsByThrottle: 0.2,
      bodyByThrottle: 0.08,
    },
  },
  {
    id: "rain",
    name: "Rain road",
    description: "Wet tarmac. Soft top end, spray rising with every km/h.",
    size: 1.8,
    damping: 0.78,
    wet: 0.3,
    spread: 0.65,
    balance: { body: 0.9, beds: 1.45, accents: 0.85 },
    motion: {
      wetBySpeed: 0.02,
      wetByRegen: 0.12,
      bedsBySpeed: 0.65,
      accentsByThrottle: 0.12,
      bodyByThrottle: 0.06,
    },
  },
  {
    id: "old-town",
    name: "Old town",
    description: "Stone lanes and archways. Long, warm tails behind each accent.",
    size: 3.4,
    damping: 0.5,
    wet: 0.38,
    spread: 0.7,
    balance: { body: 0.95, beds: 0.9, accents: 1.3 },
    motion: {
      wetBySpeed: -0.06,
      wetByRegen: 0.14,
      bedsBySpeed: 0.2,
      accentsByThrottle: 0.28,
      bodyByThrottle: 0.1,
    },
  },
];

export const DEFAULT_ENVIRONMENT_ID = "open";

export function getEnvironment(id: string | null | undefined): EnvironmentPreset {
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0]!;
}

/** Complete, in-range layer mix from any partial stored value. */
export function normalizeMix(value: unknown): LayerMix {
  const clamp = (v: unknown, fallback: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
  const src = (value ?? {}) as Partial<Record<LayerKey, Partial<LayerSetting>>>;
  const out = {} as LayerMix;
  for (const key of LAYER_KEYS) {
    const d = DEFAULT_LAYER_MIX[key];
    const s = src[key] ?? {};
    out[key] = {
      volume: clamp(s.volume, d.volume, 2),
      tone: clamp(s.tone, d.tone, 2),
      wet: clamp(s.wet, d.wet, 1),
    };
  }
  return out;
}
