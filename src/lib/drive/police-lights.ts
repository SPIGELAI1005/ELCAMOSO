/**
 * Police Patrol light show: soft red/blue glow on the Drive page that pulses with speed.
 * Rate = 0.8 + 1.7 * sqrt(min(kmh, 130) / 130) cycles per second (max 2.5/s), smooth
 * cosine fades, never white. Brightness 60% by default, 85% max. Off under reduced motion.
 */
export const POLICE_LIGHT_PROFILE_ID = "police-patrol";
export const POLICE_LIGHT_MIN_RATE = 0.8;
export const POLICE_LIGHT_MAX_RATE = 2.5;
export const POLICE_LIGHT_TOP_KMH = 130;

export type PoliceLightLevel = "off" | "60" | "85";
export const POLICE_LIGHT_LEVELS: readonly PoliceLightLevel[] = ["60", "85", "off"];
const KEY = "elcamoso.police.lights";

/** Flash cycles per second for a speed in km/h. */
export function policeFlashRate(kmh: number): number {
  const v = Math.min(POLICE_LIGHT_TOP_KMH, Math.max(0, Number.isFinite(kmh) ? kmh : 0));
  return Math.min(POLICE_LIGHT_MAX_RATE, POLICE_LIGHT_MIN_RATE + 1.7 * Math.sqrt(v / POLICE_LIGHT_TOP_KMH));
}

/** Peak opacity for a level (0 when off). Never above 0.85. */
export function policeLightOpacity(level: PoliceLightLevel): number {
  return level === "85" ? 0.85 : level === "60" ? 0.6 : 0;
}

/** Red and blue intensity (0..1) at a phase in cycles: cosine fades, half a cycle apart. */
export function policeLightPair(phase: number): { red: number; blue: number } {
  const red = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
  return { red, blue: 1 - red };
}

export function nextPoliceLightLevel(level: PoliceLightLevel): PoliceLightLevel {
  const i = POLICE_LIGHT_LEVELS.indexOf(level);
  return POLICE_LIGHT_LEVELS[(i + 1) % POLICE_LIGHT_LEVELS.length]!;
}

export function getPoliceLightLevel(storage: Storage | undefined = globalThis.localStorage): PoliceLightLevel {
  try {
    const v = storage?.getItem(KEY);
    return v === "off" || v === "85" || v === "60" ? v : "60";
  } catch {
    return "60";
  }
}

export function setPoliceLightLevel(level: PoliceLightLevel, storage: Storage | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, level);
  } catch {
    /* private mode */
  }
}
