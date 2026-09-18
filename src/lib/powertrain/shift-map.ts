import type { PowertrainProfile } from "@/lib/powertrain/types-config";
import { profileIdleRpm } from "@/lib/powertrain/types-config";
import { downshiftRpmForGear } from "@/lib/powertrain/gear-selector-math";
import { rpmFromSpeedAndGear, speedKmhFromRpmAndGear } from "@/lib/powertrain/rpm-model";

/** Demand samples for schedule generation and calibration tables. */
export const DEMAND_BREAKPOINTS = [0, 0.15, 0.35, 0.6, 0.8, 1] as const;

/** Per-gear up/down road-speed schedule sampled at demand breakpoints. */
export interface ShiftMap {
  demandBreakpoints: readonly number[];
  /** upshiftSpeedKmh[fromGear - 1][breakpointIndex] */
  upshiftSpeedKmh: number[][];
  /** downshiftSpeedKmh[fromGear - 1][breakpointIndex] - leave `fromGear` when below */
  downshiftSpeedKmh: number[][];
  /** Extra km/h deadband around schedule boundaries. */
  speedHysteresisKmh: number;
  allowSkipShifts: boolean;
  minDemandDeltaForKickdown: number;
  kickdownCooldownMs: number;
}

export interface ShiftMapOverrides {
  speedHysteresisKmh?: number;
  allowSkipShifts?: boolean;
  minDemandDeltaForKickdown?: number;
  kickdownCooldownMs?: number;
  upshiftSpeedKmh?: number[][];
  downshiftSpeedKmh?: number[][];
  /** Override light-demand RPM factor (0..1 of lowLoad span from idle). */
  lightDemandRpmFactor?: number;
}

/**
 * How early light-throttle upshifts occur relative to each personality's
 * published lowLoad RPM (sound-character anchor, not a gentle-driving map).
 *
 * Road Feel V3: mainstream combustion personalities shift much earlier under
 * light/normal demand so 1→2 is ~25–32 km/h, not ~45–50 km/h. High-RPM
 * personalities (motorcycle, ag) stay intentionally tall.
 */
const LIGHT_DEMAND_FACTOR: Record<string, number> = {
  "gt-v8": 0.48,
  "american-v8": 0.48,
  "flat-six-sport": 0.34,
  "turbo-inline-6": 0.36,
  "motorcycle-inline-4": 0.82,
  "v-twin-cruiser": 0.5,
  "single-cylinder-ag": 0.88,
  "synthetic-ev": 0.42,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function sampleSeries(series: number[], breakpoints: readonly number[], demand: number): number {
  const d = Math.min(1, Math.max(0, demand));
  for (let i = 0; i < breakpoints.length - 1; i += 1) {
    const a = breakpoints[i]!;
    const b = breakpoints[i + 1]!;
    if (d <= b) {
      const t = (d - a) / Math.max(0.001, b - a);
      return lerp(series[i]!, series[i + 1]!, t);
    }
  }
  return series[series.length - 1]!;
}

/** Road speed for an engine RPM in a given gear. */
export function roadSpeedForRpmGear(rpm: number, gear: number, profile: PowertrainProfile): number {
  return speedKmhFromRpmAndGear(rpm, gear, profile);
}

/** Engine RPM for road speed in a given gear. */
export function rpmForRoadSpeedGear(
  speedKmh: number,
  gear: number,
  profile: PowertrainProfile,
): number {
  return rpmFromSpeedAndGear(speedKmh, gear, profile);
}

/**
 * Continuous demand → upshift RPM for schedule generation.
 * Remaps personality low/med/high anchors so gentle road driving is not stuck
 * at sound-character "lowLoad" RPMs that were often written for mid/high drama.
 *
 * Demand bands (product intent):
 * 0–15% early economy · 15–35% comfortable · 35–60% progressive pull
 * 60–80% sport hold · 80–100% WOT / soft-redline
 */
export function scheduleUpshiftRpmForDemand(
  demand: number,
  profile: PowertrainProfile,
  lightFactorOverride?: number,
): number {
  const d = Math.min(1, Math.max(0, demand));
  const idle = profileIdleRpm(profile);
  const softRedline = profile.engine.redlineRpm * profile.transmission.redline.softFraction;
  const { lowLoad, mediumLoad, highLoad } = profile.transmission.upshiftRpm;
  const lightFactor = lightFactorOverride ?? LIGHT_DEMAND_FACTOR[profile.id] ?? 0.48;
  const span = Math.max(1, lowLoad - idle);

  // Road-feel anchors stay below sound-character lowLoad until stronger demand.
  const economyRpm = idle + span * lightFactor;
  const veryLightRpm = idle + (economyRpm - idle) * 0.82;
  const comfortRpm = idle + span * Math.min(0.95, lightFactor + 0.15);
  const pullRpm = idle + span * Math.min(1, lightFactor + 0.32);
  // At ~75% demand, approach lowLoad without jumping straight to mediumLoad drama.
  const sportRpm = lerp(pullRpm, lowLoad, 0.72);
  const highAnchor = lerp(sportRpm, mediumLoad, 0.55);

  if (d <= 0.15) return lerp(veryLightRpm, economyRpm, d / 0.15);
  if (d <= 0.35) return lerp(economyRpm, comfortRpm, (d - 0.15) / 0.2);
  if (d <= 0.6) return lerp(comfortRpm, pullRpm, (d - 0.35) / 0.25);
  if (d <= 0.8) return lerp(pullRpm, highAnchor, (d - 0.6) / 0.2);
  return lerp(
    highAnchor,
    Math.min(softRedline, highLoad + (softRedline - highLoad) * 0.35),
    (d - 0.8) / 0.2,
  );
}

/**
 * Build a speed × demand shift map from physical ratios and recalibrated demand RPMs.
 */
export function generateShiftMap(
  profile: PowertrainProfile,
  overrides: ShiftMapOverrides = {},
): ShiftMap {
  const gears = profile.transmission.gears;
  const upshiftSpeedKmh: number[][] = [];
  const downshiftSpeedKmh: number[][] = [];

  for (let fromGear = 1; fromGear < gears; fromGear += 1) {
    const upRow: number[] = [];
    const downRow: number[] = [];
    for (const demand of DEMAND_BREAKPOINTS) {
      const upRpm = scheduleUpshiftRpmForDemand(demand, profile, overrides.lightDemandRpmFactor);
      const upSpeed = speedKmhFromRpmAndGear(upRpm, fromGear, profile);
      // Leave `fromGear` when road speed falls below this line (same index as upshift row).
      const downRpm = downshiftRpmForGear(fromGear, profile);
      let downSpeed = speedKmhFromRpmAndGear(downRpm, fromGear, profile);

      // Same-gear deadband: down must stay below up.
      const minGap = 5 + fromGear * 0.75;
      if (downSpeed > upSpeed - minGap) {
        downSpeed = Math.max(0, upSpeed - minGap);
      }
      // Cross-gear hysteresis: leaving gear N must sit below the prior gear's upshift
      // so steady cruise cannot bounce N-1 ↔ N.
      if (fromGear > 1) {
        const priorUp = upshiftSpeedKmh[fromGear - 2]?.[upRow.length];
        if (priorUp != null && downSpeed > priorUp - minGap) {
          downSpeed = Math.max(0, priorUp - minGap);
        }
      }
      upRow.push(upSpeed);
      downRow.push(downSpeed);
    }
    upshiftSpeedKmh.push(upRow);
    downshiftSpeedKmh.push(downRow);
  }

  // Top gear must have a downshift schedule (there is no upshift row for it).
  {
    const fromGear = gears;
    const downRow: number[] = [];
    for (let i = 0; i < DEMAND_BREAKPOINTS.length; i += 1) {
      const downRpm = downshiftRpmForGear(fromGear, profile);
      let downSpeed = speedKmhFromRpmAndGear(downRpm, fromGear, profile);
      const minGap = 5 + fromGear * 0.75;
      const priorUp = upshiftSpeedKmh[fromGear - 2]?.[i];
      // Top gear exit: never collapse the schedule to 0 (would trap overdrive forever).
      if (priorUp != null) {
        const capped = priorUp - minGap;
        downSpeed = Math.min(downSpeed, capped);
        const floor = Math.max(8, priorUp * 0.55);
        if (!(downSpeed > 0) || downSpeed < floor * 0.5) {
          downSpeed = Math.min(floor, Math.max(8, capped > 0 ? capped : floor));
        }
      } else if (!(downSpeed > 0)) {
        downSpeed = Math.max(8, speedKmhFromRpmAndGear(downRpm, fromGear, profile) || 12);
      }
      downRow.push(downSpeed);
    }
    downshiftSpeedKmh.push(downRow);
  }

  return {
    demandBreakpoints: DEMAND_BREAKPOINTS,
    upshiftSpeedKmh: overrides.upshiftSpeedKmh ?? upshiftSpeedKmh,
    downshiftSpeedKmh: overrides.downshiftSpeedKmh ?? downshiftSpeedKmh,
    speedHysteresisKmh: overrides.speedHysteresisKmh ?? 3.5,
    allowSkipShifts: overrides.allowSkipShifts ?? false,
    minDemandDeltaForKickdown: overrides.minDemandDeltaForKickdown ?? 0.12,
    kickdownCooldownMs: overrides.kickdownCooldownMs ?? 420,
  };
}

export function upshiftSpeedForDemand(map: ShiftMap, fromGear: number, demand: number): number {
  const row = map.upshiftSpeedKmh[fromGear - 1];
  if (!row) return Number.POSITIVE_INFINITY;
  return sampleSeries(row, map.demandBreakpoints, demand);
}

export function downshiftSpeedForDemand(map: ShiftMap, fromGear: number, demand: number): number {
  const row = map.downshiftSpeedKmh[fromGear - 1];
  if (!row) return 0;
  return sampleSeries(row, map.demandBreakpoints, demand);
}

export interface ShiftMapValidation {
  ok: boolean;
  issues: string[];
}

export function validateShiftMap(map: ShiftMap, profile: PowertrainProfile): ShiftMapValidation {
  const issues: string[] = [];
  const gears = profile.transmission.gears;
  for (let g = 1; g < gears; g += 1) {
    for (let i = 0; i < map.demandBreakpoints.length; i += 1) {
      const up = map.upshiftSpeedKmh[g - 1]?.[i];
      const down = map.downshiftSpeedKmh[g - 1]?.[i];
      if (up == null || down == null || !Number.isFinite(up) || !Number.isFinite(down)) {
        issues.push(`Gear ${g}: non-finite schedule at demand index ${i}`);
        continue;
      }
      if (down >= up) {
        issues.push(`Gear ${g}: downshift ${down.toFixed(1)} >= upshift ${up.toFixed(1)}`);
      }
      if (up < 0 || down < 0) issues.push(`Gear ${g}: negative schedule speeds`);
    }
    const gentle = map.upshiftSpeedKmh[g - 1]?.[0] ?? 0;
    const wot = map.upshiftSpeedKmh[g - 1]?.[map.demandBreakpoints.length - 1] ?? 0;
    if (wot + 0.05 < gentle) {
      issues.push(
        `Gear ${g}: WOT upshift ${wot.toFixed(1)} earlier than gentle ${gentle.toFixed(1)}`,
      );
    }
  }
  // Top gear downshift row is required so braking/coast can leave overdrive.
  for (let i = 0; i < map.demandBreakpoints.length; i += 1) {
    const topDown = map.downshiftSpeedKmh[gears - 1]?.[i];
    if (topDown == null || !Number.isFinite(topDown) || topDown <= 0) {
      issues.push(`Top gear ${gears}: missing/invalid downshift at demand index ${i}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function resolveShiftMap(profile: PowertrainProfile): ShiftMap {
  if (profile.transmission.shiftMap) return profile.transmission.shiftMap;
  return generateShiftMap(profile, profile.transmission.shiftMapOverrides);
}

/** Calibration helper: upshift road speeds at fixed demand samples. */
export function calibrationUpshiftTable(
  profile: PowertrainProfile,
  demands = [0.1, 0.25, 0.5, 0.75, 1] as const,
): { demand: number; speeds: number[] }[] {
  const map = resolveShiftMap(profile);
  return demands.map((demand) => ({
    demand,
    speeds: Array.from({ length: profile.transmission.gears - 1 }, (_, i) =>
      upshiftSpeedForDemand(map, i + 1, demand),
    ),
  }));
}
