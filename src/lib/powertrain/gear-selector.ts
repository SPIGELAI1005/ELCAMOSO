import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";
import { downshiftRpmForGear, upshiftRpmForLoad } from "@/lib/powertrain/gear-selector-math";
import {
  downshiftSpeedForDemand,
  resolveShiftMap,
  upshiftSpeedForDemand,
  type ShiftMap,
} from "@/lib/powertrain/shift-map";

export { upshiftRpmForLoad, downshiftRpmForGear } from "@/lib/powertrain/gear-selector-math";

export type ShiftReason =
  "hold" | "upshift-schedule" | "downshift-schedule" | "kickdown" | "redline" | "none";

export interface GearSelectorContext {
  currentGear: number;
  rpm: number;
  /** Driver demand (accelerator intention). */
  throttle: number;
  /** Engine load (power needed). */
  load: number;
  /** Fast road speed (display / RPM). */
  speedKmh: number;
  /** Slow-filtered speed for schedule decisions — falls back to speedKmh. */
  shiftDecisionSpeedKmh?: number;
  braking: number;
  lastShiftCompletedAt: number;
  now: number;
  lastShiftWasUp: boolean;
  blockDownshiftUntil: number;
  shifting: boolean;
  lastKickdownAt?: number;
  previousDemand?: number;
}

export interface GearSelectorResult {
  targetGear: number;
  reason: ShiftReason;
  /** Ultimate desired gear (may differ from next step when multi-step kickdown). */
  desiredGear: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function canDownshiftTo(toGear: number, speedKmh: number, profile: PowertrainProfile): boolean {
  if (toGear < 1) return false;
  const targetRpm = rpmFromSpeedAndGear(speedKmh, toGear, profile);
  const limit = profile.engine.redlineRpm * profile.transmission.redline.maxDownshiftFraction;
  return targetRpm <= limit;
}

function deepestSafeDownshift(
  fromGear: number,
  steps: number,
  speedKmh: number,
  profile: PowertrainProfile,
): number {
  let gear = fromGear;
  for (let s = 0; s < steps; s += 1) {
    if (gear <= 1) break;
    if (!canDownshiftTo(gear - 1, speedKmh, profile)) break;
    gear -= 1;
  }
  return gear;
}

function minGearHoldMs(profile: PowertrainProfile): number {
  const tx = profile.transmission;
  const hold = tx.shift.minGearHoldMs / Math.max(0.5, profile.behavior.shiftAggression);
  const lockout = tx.shift.shiftLockoutMs ?? 90;
  return Math.max(hold, lockout);
}

function scheduleDemand(throttle: number, load: number): number {
  // Schedule follows driver intention primarily; load only lifts WOT slightly.
  return clamp01(throttle * 0.85 + load * 0.15);
}

/**
 * Target gear from a speed × demand shift map, with kickdown, hysteresis,
 * redline protection, and multi-step desired gear (simulator queues steps).
 */
export function selectTargetGear(
  ctx: GearSelectorContext,
  profile: PowertrainProfile,
  map?: ShiftMap,
): number {
  return selectTargetGearDetailed(ctx, profile, map).targetGear;
}

export function selectTargetGearDetailed(
  ctx: GearSelectorContext,
  profile: PowertrainProfile,
  map = resolveShiftMap(profile),
): GearSelectorResult {
  if (ctx.shifting) {
    return { targetGear: ctx.currentGear, reason: "hold", desiredGear: ctx.currentGear };
  }

  const tx = profile.transmission;
  const gear = Math.max(0, Math.min(tx.gears, ctx.currentGear));
  if (gear < 1) {
    return { targetGear: gear, reason: "none", desiredGear: gear };
  }

  if (ctx.now - ctx.lastShiftCompletedAt < minGearHoldMs(profile)) {
    return { targetGear: gear, reason: "hold", desiredGear: gear };
  }

  const decisionSpeed = ctx.shiftDecisionSpeedKmh ?? ctx.speedKmh;
  const demand = scheduleDemand(ctx.throttle, ctx.load);
  const hyst = map.speedHysteresisKmh + (ctx.lastShiftWasUp ? map.speedHysteresisKmh * 0.35 : 0);
  const kickdownMinSpeed = tx.kickdown.minSpeedKmh ?? 18;
  const coastMax = tx.downshift.coastMaxThrottle ?? 0.28;
  const redlineSoft = profile.engine.redlineRpm * tx.redline.softFraction;

  // Kickdown — may request multiple gears; redline-checked.
  const demandDelta = Math.max(0, ctx.throttle - (ctx.previousDemand ?? ctx.throttle));
  const kickdownReady =
    tx.kickdown.enabled &&
    ctx.braking < 0.35 &&
    decisionSpeed >= kickdownMinSpeed &&
    ctx.throttle >= tx.kickdown.throttleThreshold &&
    gear > 1 &&
    ctx.now >= ctx.blockDownshiftUntil &&
    ctx.now - (ctx.lastKickdownAt ?? 0) >= map.kickdownCooldownMs &&
    demandDelta >= map.minDemandDeltaForKickdown * 0.25;

  if (kickdownReady) {
    const upshiftAt = upshiftRpmForLoad(ctx.load, ctx.throttle, profile);
    if (ctx.rpm < upshiftAt * tx.kickdown.rpmFractionOfUpshift) {
      const desired = deepestSafeDownshift(gear, tx.kickdown.maxSteps, decisionSpeed, profile);
      if (desired < gear) {
        return { targetGear: desired, reason: "kickdown", desiredGear: desired };
      }
    }
  }

  // Redline force upshift.
  if (gear < tx.gears && ctx.rpm >= redlineSoft) {
    return { targetGear: gear + 1, reason: "redline", desiredGear: gear + 1 };
  }

  // Schedule upshift — never while braking (prevents climbing gears into a stop).
  if (gear < tx.gears && ctx.braking < 0.35) {
    const upLine = upshiftSpeedForDemand(map, gear, demand) + hyst;
    if (decisionSpeed >= upLine) {
      return { targetGear: gear + 1, reason: "upshift-schedule", desiredGear: gear + 1 };
    }
  }

  // Schedule downshift with coast / part-throttle gates.
  if (gear > 1 && ctx.now >= ctx.blockDownshiftUntil) {
    const brakeRelief = ctx.braking >= 0.35 ? map.speedHysteresisKmh * (0.85 + ctx.braking) : 0;
    const downHyst = ctx.braking >= 0.35 ? hyst * 0.35 : hyst;
    const downLine = downshiftSpeedForDemand(map, gear, demand) - downHyst + brakeRelief;
    const coasting = ctx.throttle <= coastMax;
    const partThrottle = ctx.throttle > coastMax && ctx.throttle < tx.kickdown.throttleThreshold;
    const downAllowed =
      coasting ||
      ctx.braking >= 0.35 ||
      (partThrottle && decisionSpeed <= downLine - map.speedHysteresisKmh * 0.5);

    if (
      downAllowed &&
      decisionSpeed <= downLine &&
      canDownshiftTo(gear - 1, decisionSpeed, profile)
    ) {
      return { targetGear: gear - 1, reason: "downshift-schedule", desiredGear: gear - 1 };
    }
  }

  return { targetGear: gear, reason: "none", desiredGear: gear };
}

export interface GearEngagementContext {
  now: number;
  lastNeutralAt: number;
}

/** Neutral / 1st engagement from idle and stop behavior. */
export function resolveGearEngagement(
  gear: number,
  speedKmh: number,
  throttle: number,
  profile: PowertrainProfile,
  engagement?: GearEngagementContext,
): number {
  const idle = profile.transmission.idle;
  const reengageHold = idle.reengageHoldMs ?? 450;

  if (gear === 0) {
    if (
      engagement &&
      engagement.lastNeutralAt > 0 &&
      engagement.now - engagement.lastNeutralAt < reengageHold
    ) {
      return 0;
    }
    if (speedKmh >= idle.engageSpeedKmh || throttle >= idle.engageThrottle) return 1;
    return 0;
  }

  if (speedKmh <= idle.disengageSpeedKmh && throttle <= idle.disengageThrottle) {
    return 0;
  }

  return gear;
}

/** @deprecated use resolveGearEngagement */
export function engageGear(speedKmh: number, throttle: number, profile: PowertrainProfile): number {
  return resolveGearEngagement(0, speedKmh, throttle, profile) || 0;
}
