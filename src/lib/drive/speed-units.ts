/**
 * Speed display units. Metric (km/h) / Imperial (mph) follow Settings → Units;
 * boat, ship and aircraft profiles show knots and space profiles show a fraction of light
 * speed (c) by default (Settings → "Themed speed units for boats, planes and space").
 */
import type { Units } from "@/lib/i18n";

export const KMH_PER_KNOT = 1.852;
export const MPS_TO_KMH = 3.6;
export const MPS_TO_MPH = 2.236936;
export const MPS_TO_KNOTS = MPS_TO_KMH / KMH_PER_KNOT;

/** Boats, ships and aircraft show knots. Rocket Car and land vehicles/trains excluded. */
export const KNOTS_PROFILE_IDS: ReadonlySet<string> = new Set([
  "speed-boat",
  "cruise-ship",
  "jet-ski",
  "submarine",
  "turbine-jet",
  "helicopter",
  "private-jet",
]);

/** Space travel shows a playful fraction of light speed (c). Rocket Car excluded. */
export const LIGHT_SPEED_PROFILE_IDS: ReadonlySet<string> = new Set([
  "space-ship",
  "ufo",
  "world-space-drive",
]);

export const SPEED_OF_LIGHT_MPS = 299_792_458;

export type SpeedUnitId = "kmh" | "mph" | "kn" | "c";

export function profileUsesKnots(profileId: string | null | undefined): boolean {
  return !!profileId && KNOTS_PROFILE_IDS.has(profileId);
}

export function profileUsesLightSpeed(profileId: string | null | undefined): boolean {
  return !!profileId && LIGHT_SPEED_PROFILE_IDS.has(profileId);
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** 25 m/s → "8.3 × 10⁻⁸"; 0 → "0". Fraction of light speed, scientific notation. */
export function formatLightFraction(mps: number): string {
  const f = Math.max(0, mps) / SPEED_OF_LIGHT_MPS;
  if (f < 1e-12) return "0";
  let exp = Math.floor(Math.log10(f));
  let mant = Math.round((f / 10 ** exp) * 10) / 10;
  if (mant >= 10) {
    mant = 1;
    exp += 1;
  }
  const sup = String(exp)
    .split("")
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join("");
  return `${mant.toFixed(1)} × 10${sup}`;
}

/** Display text for a speed in the resolved unit (no unit label). */
export function formatSpeedText(mps: number, unit: SpeedUnitId): string {
  if (unit === "c") return formatLightFraction(mps);
  return String(Math.max(0, Math.round(convertSpeedMps(mps, unit))));
}

export function resolveSpeedUnit(
  units: Units,
  profileId: string | null | undefined,
  themedUnits: boolean,
): SpeedUnitId {
  if (themedUnits && profileUsesLightSpeed(profileId)) return "c";
  if (themedUnits && profileUsesKnots(profileId)) return "kn";
  return units === "imperial" ? "mph" : "kmh";
}

export function speedUnitLabel(unit: SpeedUnitId): string {
  return unit === "c" ? "c" : unit === "kn" ? "kn" : unit === "mph" ? "mph" : "km/h";
}

export function convertSpeedMps(mps: number, unit: SpeedUnitId): number {
  if (unit === "c") return mps / SPEED_OF_LIGHT_MPS;
  return mps * (unit === "kn" ? MPS_TO_KNOTS : unit === "mph" ? MPS_TO_MPH : MPS_TO_KMH);
}

export function convertSpeedKmh(kmh: number, unit: SpeedUnitId): number {
  return convertSpeedMps(kmh / MPS_TO_KMH, unit);
}

/** en-US / en-GB (and US/GB/Liberia/Myanmar regions) default to mph; everything else km/h. */
export function defaultUnitsForLocale(locale: string | null | undefined): Units {
  if (!locale) return "metric";
  const l = locale.toLowerCase();
  if (l === "en-us" || l === "en-gb" || /-(us|gb|lr|mm)$/.test(l)) return "imperial";
  return "metric";
}

export function browserDefaultUnits(): Units {
  if (typeof navigator === "undefined") return "metric";
  return defaultUnitsForLocale(navigator.languages?.[0] ?? navigator.language);
}
