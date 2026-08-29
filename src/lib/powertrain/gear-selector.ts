import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";

export interface GearSelectorContext {
  currentGear: number;
  rpm: number;
  throttle: number;
  load: number;
  speedKmh: number;
  braking: number;
  lastShiftCompletedAt: number;
  now: number;
  lastShiftWasUp: boolean;
  blockDownshiftUntil: number;
  shifting: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Interpolated upshift RPM from load/throttle demand. */
export function upshiftRpmForLoad(
  load: number,
  throttle: number,
  profile: PowertrainProfile,
): number {
  const tx = profile.transmission;
  const demand = Math.max(load, throttle);
  const { lowLoad, mediumLoad, highLoad } = tx.upshiftRpm;
  const m = tx.upshiftLoadMedium;
  const h = tx.upshiftLoadHigh;

  if (demand <= m) return lowLoad;
  if (demand >= h) return highLoad;
  if (demand <= (m + h) * 0.5) {
    const t = (demand - m) / Math.max(0.001, (m + h) * 0.5 - m);
    return lowLoad + (mediumLoad - lowLoad) * t;
  }
  const t = (demand - (m + h) * 0.5) / Math.max(0.001, h - (m + h) * 0.5);
  return mediumLoad + (highLoad - mediumLoad) * clamp01(t);
}

/** Per-gear downshift RPM threshold. */
export function downshiftRpmForGear(gear: number, profile: PowertrainProfile): number {
  const d = profile.transmission.downshift;
  const offset = d.perGearOffsetRpm[gear - 1] ?? 0;
  return d.baseRpm + offset;
}

function canDownshiftTo(fromGear: number, speedKmh: number, profile: PowertrainProfile): boolean {
  if (fromGear <= 1) return false;
  const targetRpm = rpmFromSpeedAndGear(speedKmh, fromGear - 1, profile);
  const limit = profile.engine.redlineRpm * profile.transmission.redline.maxDownshiftFraction;
  return targetRpm <= limit;
}

function clampTarget(current: number, target: number, maxSteps: number): number {
  const delta = target - current;
  if (delta === 0) return current;
  const step = Math.sign(delta) * Math.min(Math.abs(delta), maxSteps);
  return current + step;
}

function minGearHoldMs(profile: PowertrainProfile): number {
  const tx = profile.transmission;
  const hold = tx.shift.minGearHoldMs / Math.max(0.5, profile.behavior.shiftAggression);
  const lockout = tx.shift.shiftLockoutMs ?? 90;
  return Math.max(hold, lockout);
}

/**
 * Target gear with load-dependent upshift, kickdown, downshift thresholds,
 * hysteresis, redline protection, and single-gear-step enforcement.
 */
export function selectTargetGear(ctx: GearSelectorContext, profile: PowertrainProfile): number {
  if (ctx.shifting) return ctx.currentGear;

  const tx = profile.transmission;
  const gear = Math.max(0, Math.min(tx.gears, ctx.currentGear));
  if (gear < 1) return gear;

  if (ctx.now - ctx.lastShiftCompletedAt < minGearHoldMs(profile)) return gear;

  const upshiftAt = upshiftRpmForLoad(ctx.load, ctx.throttle, profile);
  const upshiftLine = upshiftAt + (ctx.lastShiftWasUp ? tx.upshiftHysteresisRpm : 0);

  const redlineSoft = profile.engine.redlineRpm * tx.redline.softFraction;
  const kickdownMinSpeed = tx.kickdown.minSpeedKmh ?? 18;
  const coastMax = tx.downshift.coastMaxThrottle ?? 0.28;

  if (
    tx.kickdown.enabled &&
    ctx.braking < 0.35 &&
    ctx.speedKmh >= kickdownMinSpeed &&
    ctx.throttle >= tx.kickdown.throttleThreshold &&
    ctx.rpm < upshiftAt * tx.kickdown.rpmFractionOfUpshift &&
    gear > 1 &&
    ctx.now >= ctx.blockDownshiftUntil &&
    canDownshiftTo(gear, ctx.speedKmh, profile)
  ) {
    return clampTarget(gear, gear - tx.kickdown.maxSteps, tx.kickdown.maxSteps);
  }

  if (gear < tx.gears) {
    const forceUpshift = ctx.rpm >= redlineSoft;
    if (forceUpshift || ctx.rpm >= upshiftLine) {
      return gear + 1;
    }
  }

  if (gear > 1 && ctx.now >= ctx.blockDownshiftUntil) {
    const downThreshold = downshiftRpmForGear(gear, profile);
    const downLine = downThreshold - tx.downshift.hysteresisRpm;
    const coasting = ctx.throttle <= coastMax;
    const partThrottle = ctx.throttle > coastMax && ctx.throttle < tx.kickdown.throttleThreshold;
    const downAllowed =
      coasting || (partThrottle && ctx.rpm <= downLine - tx.downshift.hysteresisRpm * 0.35);

    if (downAllowed && ctx.rpm <= downLine && canDownshiftTo(gear, ctx.speedKmh, profile)) {
      return gear - 1;
    }
  }

  return gear;
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
