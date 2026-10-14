/**
 * Profile-specific RPM-tracking engine-order bands for HybridCombustionSynth.
 *
 * Units: `supportRatios` are **crank orders** (cycles per crank revolution).
 * Frequency = (rpm / 60) × crankOrder. They are NOT multiples of firing frequency
 * (firing Hz for four-stroke is rpm × cylinders / 120).
 *
 * Default path keeps the legacy three-band construction (½, 1, 2 × firing order).
 * Profile arrays are consumed only when `isProfileOrderBandsEnabled()` is true.
 */

import type { AcousticEngineConfig } from "@/lib/sound/realism/v2/acoustic-engine";
import { halfOrderWeightForArchitectureCode } from "@/lib/sound/realism/v2/architecture-contract";

export interface OrderBandSpec {
  /** Crank order (cycles per crank revolution). */
  order: number;
  weight: number;
  q: number;
}

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[name] != null) {
    return String(process.env[name]).trim().toLowerCase();
  }
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    const value = meta.env?.[name];
    return value != null ? String(value).trim().toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

function readFlag(name: string, defaultOn: boolean): boolean {
  const value = readEnv(name);
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return defaultOn;
}

/** Default ON since spec §P0-4: profile order bands should be active by default. */
const ORDER_BANDS_DEFAULT_ON = true;

/**
 * When true, HybridCombustionSynth builds order bands from supportRatios/supportWeights.
 * Default ON (P0-4): profile-specific order bands provide better firing character.
 */
export function isProfileOrderBandsEnabled(): boolean {
  let viteLiteral: boolean | null = null;
  try {
    const raw = import.meta.env?.["VITE_COMBUSTION_PROFILE_ORDER_BANDS"];
    if (raw != null) {
      const v = String(raw).trim().toLowerCase();
      if (v === "1" || v === "true" || v === "yes") viteLiteral = true;
      else if (v === "0" || v === "false" || v === "no") viteLiteral = false;
    }
  } catch {
    viteLiteral = null;
  }
  if (viteLiteral !== null) return viteLiteral;
  return (
    readFlag("VITE_COMBUSTION_PROFILE_ORDER_BANDS", ORDER_BANDS_DEFAULT_ON) ||
    readFlag("ELCAMOSO_COMBUSTION_PROFILE_ORDER_BANDS", ORDER_BANDS_DEFAULT_ON)
  );
}

/** Legacy V2.2 three-band construction (flag OFF). */
export function buildLegacyOrderBandSpec(cfg: AcousticEngineConfig): OrderBandSpec[] {
  const firingOrder = cfg.cylinders / 2;
  const half = halfOrderWeightForArchitectureCode(cfg.architectureCode);
  return [
    { order: firingOrder / 2, weight: 0.62 * half, q: 7.5 },
    { order: firingOrder, weight: 1, q: 8.5 },
    { order: firingOrder * 2, weight: 0.42, q: 6 },
  ];
}

/**
 * Profile crank-order bands from supportRatios / supportWeights.
 * Bounded, finite, and capped so high-RPM profiles stay below a practical ceiling.
 */
export function buildProfileOrderBandSpec(cfg: AcousticEngineConfig): OrderBandSpec[] {
  const ratios = cfg.supportRatios ?? [];
  const weights = cfg.supportWeights ?? [];
  const bands: OrderBandSpec[] = [];
  const maxBands = 8;
  for (let i = 0; i < ratios.length && bands.length < maxBands; i += 1) {
    const order = ratios[i];
    const weight = weights[i] ?? 0;
    if (order == null || !Number.isFinite(order) || order <= 0) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const q = Math.min(10, Math.max(3, 8.5 - i * 0.35));
    bands.push({
      order: Math.min(24, order),
      weight: Math.min(1, Math.max(0, weight)),
      q,
    });
  }
  if (!bands.length) return buildLegacyOrderBandSpec(cfg);
  return bands;
}

export function buildOrderBandSpec(
  cfg: AcousticEngineConfig,
  useProfileBands = isProfileOrderBandsEnabled(),
): OrderBandSpec[] {
  return useProfileBands ? buildProfileOrderBandSpec(cfg) : buildLegacyOrderBandSpec(cfg);
}
