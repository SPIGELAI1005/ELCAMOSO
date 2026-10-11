import type { PowertrainProfile } from "@/lib/powertrain/types-config";
import {
  DEMAND_BREAKPOINTS,
  generateShiftMap,
  resolveShiftMap,
  validateShiftMap,
  type ShiftMap,
} from "@/lib/powertrain/shift-map";
import { speedKmhFromRpmAndGear } from "@/lib/powertrain/rpm-model";
import { isCityShiftPresetDefaultEnabled } from "@/lib/powertrain/shift-preset-flag";

/**
 * Artistic virtual-transmission shift-map presets (Prompt 03).
 * Thresholds are design defaults — not measured vehicle or competitor data.
 */
export type ShiftMapPresetId = "legacy" | "city" | "touring" | "sport";

export const SHIFT_MAP_PRESET_IDS: readonly ShiftMapPresetId[] = [
  "legacy",
  "city",
  "touring",
  "sport",
] as const;

/** City gentle-demand upshifts (km/h) for gears 1→2 … 5→6 on a six-speed. */
export const CITY_UPSHIFT_KMH = [15, 28, 43, 58, 75] as const;
/** City companion downshifts (km/h) for leaving gears 2…6. */
export const CITY_DOWNSHIFT_KMH = [10, 21, 35, 49, 65] as const;

const PRESET_SCALE: Record<Exclude<ShiftMapPresetId, "legacy">, number> = {
  city: 1,
  touring: 1.18,
  sport: 1.38,
};

const PRESET_MIN_GEAR_HOLD_MS: Record<Exclude<ShiftMapPresetId, "legacy">, number> = {
  city: 900,
  touring: 1050,
  sport: 1200,
};

const PRESET_UPSHIFT_MS: Record<Exclude<ShiftMapPresetId, "legacy">, number> = {
  city: 200,
  touring: 240,
  sport: 180,
};

export function isShiftMapPresetId(value: unknown): value is ShiftMapPresetId {
  return typeof value === "string" && (SHIFT_MAP_PRESET_IDS as readonly string[]).includes(value);
}

/** Default preset: City only when the opt-in flag is enabled; otherwise legacy maps. */
export function defaultShiftMapPreset(): ShiftMapPresetId {
  return isCityShiftPresetDefaultEnabled() ? "city" : "legacy";
}

/**
 * Adapt a 6-speed (5-transition) ladder to another gearbox.
 * Compresses by sampling the curve; expands by extrapolating the last step.
 */
export function adaptSpeedLadder(base: readonly number[], transitionCount: number): number[] {
  if (transitionCount <= 0) return [];
  if (transitionCount === base.length) return base.map((v) => v);

  if (transitionCount < base.length) {
    const out: number[] = [];
    for (let i = 0; i < transitionCount; i += 1) {
      const t = transitionCount === 1 ? 0 : i / (transitionCount - 1);
      const src = t * (base.length - 1);
      const lo = Math.floor(src);
      const hi = Math.min(base.length - 1, lo + 1);
      const frac = src - lo;
      out.push(base[lo]! * (1 - frac) + base[hi]! * frac);
    }
    return out;
  }

  const out = base.map((v) => v);
  let delta = base[base.length - 1]! - base[base.length - 2]!;
  while (out.length < transitionCount) {
    delta = Math.max(6, delta * 0.92);
    out.push(out[out.length - 1]! + delta);
  }
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function enforceGap(up: number, down: number, gear: number): number {
  const minGap = 4 + gear * 0.6;
  return Math.min(down, up - minGap);
}

/**
 * Build a demand×speed ShiftMap from City/Touring/Sport gentle anchors.
 * WOT column approaches soft-redline road speed so Sport can still hold under demand.
 */
export function buildPresetShiftMap(
  profile: PowertrainProfile,
  preset: Exclude<ShiftMapPresetId, "legacy">,
): ShiftMap {
  const gears = profile.transmission.gears;
  const nUp = Math.max(0, gears - 1);
  const scale = PRESET_SCALE[preset];
  const upGentle = adaptSpeedLadder(CITY_UPSHIFT_KMH, nUp).map((s) => s * scale);
  const downGentle = adaptSpeedLadder(CITY_DOWNSHIFT_KMH, nUp).map((s) => s * scale);

  const softRedline =
    profile.engine.redlineRpm * profile.transmission.redline.softFraction;

  const upshiftSpeedKmh: number[][] = [];
  const downshiftSpeedKmh: number[][] = [];

  for (let fromGear = 1; fromGear < gears; fromGear += 1) {
    const gentleUp = upGentle[fromGear - 1] ?? 20;
    const gentleDown = enforceGap(
      gentleUp,
      downGentle[fromGear - 1] ?? gentleUp * 0.7,
      fromGear,
    );
    const wotUp = Math.max(
      gentleUp,
      Math.min(
        speedKmhFromRpmAndGear(softRedline, fromGear, profile) * 0.92,
        gentleUp * (preset === "sport" ? 1.85 : 1.55),
      ),
    );
    const wotDown = enforceGap(wotUp, gentleDown * (preset === "sport" ? 1.15 : 1.05), fromGear);

    const upRow: number[] = [];
    const downRow: number[] = [];
    for (const demand of DEMAND_BREAKPOINTS) {
      // Sport holds longer as demand rises (curve biased toward WOT earlier).
      const t =
        preset === "sport"
          ? Math.pow(demand, 0.75)
          : preset === "touring"
            ? Math.pow(demand, 0.9)
            : demand;
      const up = gentleUp + (wotUp - gentleUp) * t;
      let down = gentleDown + (wotDown - gentleDown) * t;
      down = enforceGap(up, down, fromGear);
      upRow.push(round1(up));
      downRow.push(round1(Math.max(0, down)));
    }
    upshiftSpeedKmh.push(upRow);
    downshiftSpeedKmh.push(downRow);
  }

  // Top-gear downshift row.
  {
    const fromGear = gears;
    const priorGentle = upGentle[nUp - 1] ?? 40;
    const gentleDown = Math.max(8, priorGentle * 0.72 * (preset === "sport" ? 1.08 : 1));
    const downRow: number[] = [];
    for (const demand of DEMAND_BREAKPOINTS) {
      const t = preset === "sport" ? Math.pow(demand, 0.75) : demand;
      const priorUp = upshiftSpeedKmh[nUp - 1]?.[Math.round(t * (DEMAND_BREAKPOINTS.length - 1))] ??
        priorGentle;
      let down = gentleDown * (1 + t * 0.08);
      const minGap = 5 + fromGear * 0.75;
      if (priorUp != null) down = Math.min(down, priorUp - minGap);
      downRow.push(round1(Math.max(8, down)));
    }
    downshiftSpeedKmh.push(downRow);
  }

  return {
    demandBreakpoints: DEMAND_BREAKPOINTS,
    upshiftSpeedKmh,
    downshiftSpeedKmh,
    speedHysteresisKmh: preset === "sport" ? 4.5 : preset === "touring" ? 4 : 3.5,
    allowSkipShifts: false,
    minDemandDeltaForKickdown: preset === "sport" ? 0.1 : 0.12,
    kickdownCooldownMs: preset === "sport" ? 360 : 420,
  };
}

/** Overlay dwell / envelope tuning for artistic presets without mutating catalog personalities. */
export function applyShiftPresetToProfile(
  profile: PowertrainProfile,
  preset: ShiftMapPresetId,
): PowertrainProfile {
  if (preset === "legacy") return profile;
  const hold = PRESET_MIN_GEAR_HOLD_MS[preset];
  const upMs = Math.min(
    300,
    Math.max(150, PRESET_UPSHIFT_MS[preset]),
  );
  const downMs = Math.min(400, Math.max(180, upMs + 40));
  const { shiftMap: _map, shiftMapOverrides: _overrides, ...txRest } = profile.transmission;
  return {
    ...profile,
    transmission: {
      ...txRest,
      shift: {
        ...profile.transmission.shift,
        minGearHoldMs: hold,
        upshiftDurationMs: upMs,
        downshiftDurationMs: downMs,
      },
    },
  };
}

export function resolveShiftMapForPreset(
  profile: PowertrainProfile,
  preset: ShiftMapPresetId,
): ShiftMap {
  if (preset === "legacy") return resolveShiftMap(profile);
  const map = buildPresetShiftMap(profile, preset);
  const check = validateShiftMap(map, profile);
  if (check.ok) return map;
  // Safe fallback: regenerate legacy schedule rather than ship an invalid map.
  return generateShiftMap(profile);
}

export interface ShiftPresetSummary {
  preset: ShiftMapPresetId;
  gearCount: number;
  gentleUpshiftKmh: number[];
  gentleDownshiftKmh: number[];
  minGearHoldMs: number;
  upshiftDurationMs: number;
  valid: boolean;
  issues: string[];
}

export function summarizeShiftPreset(
  profile: PowertrainProfile,
  preset: ShiftMapPresetId,
): ShiftPresetSummary {
  const applied = applyShiftPresetToProfile(profile, preset);
  const map = resolveShiftMapForPreset(applied, preset);
  const check = validateShiftMap(map, applied);
  return {
    preset,
    gearCount: applied.transmission.gears,
    gentleUpshiftKmh: map.upshiftSpeedKmh.map((row) => row[0] ?? 0),
    gentleDownshiftKmh: map.downshiftSpeedKmh.slice(0, -1).map((row) => row[0] ?? 0),
    minGearHoldMs: applied.transmission.shift.minGearHoldMs,
    upshiftDurationMs: applied.transmission.shift.upshiftDurationMs,
    valid: check.ok,
    issues: check.issues,
  };
}
