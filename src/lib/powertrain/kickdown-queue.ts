import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";
import type { ShiftReason } from "@/lib/powertrain/gear-selector";
import { selectTargetGearDetailed } from "@/lib/powertrain/gear-selector";
import type { ShiftMap } from "@/lib/powertrain/shift-map";

export interface KickdownQueueContext {
  currentGear: number;
  queuedTargetGear: number;
  driverDemand: number;
  braking: number;
  rpm: number;
  shiftDecisionSpeedKmh: number;
  speedKmh: number;
  lastShiftCompletedAt: number;
  now: number;
  lastShiftWasUp: boolean;
  blockDownshiftUntil: number;
  lastKickdownAt: number;
  previousDemand: number;
  /** True while an acceleration kickdown plan is in flight. */
  kickdownPlanActive: boolean;
}

/**
 * Reconcile a multi-step kickdown queue each tick.
 * Queued targets are not unconditional — release, brake, or unsafe speed clears them.
 */
export function reconcileKickdownQueue(
  ctx: KickdownQueueContext,
  profile: PowertrainProfile,
  map: ShiftMap,
): { queuedTargetGear: number; reason: ShiftReason; kickdownPlanActive: boolean } {
  const tx = profile.transmission;
  const gear = ctx.currentGear;
  if (gear < 1) {
    return { queuedTargetGear: gear, reason: "none", kickdownPlanActive: false };
  }

  // Braking cancels an acceleration kickdown plan.
  if (ctx.braking >= 0.35) {
    const schedule = selectTargetGearDetailed(
      {
        currentGear: gear,
        rpm: ctx.rpm,
        throttle: ctx.driverDemand,
        load: ctx.driverDemand,
        speedKmh: ctx.speedKmh,
        shiftDecisionSpeedKmh: ctx.shiftDecisionSpeedKmh,
        braking: ctx.braking,
        lastShiftCompletedAt: ctx.lastShiftCompletedAt,
        now: ctx.now,
        lastShiftWasUp: ctx.lastShiftWasUp,
        blockDownshiftUntil: ctx.blockDownshiftUntil,
        shifting: false,
        lastKickdownAt: ctx.lastKickdownAt,
        previousDemand: ctx.previousDemand,
      },
      profile,
      map,
    );
    return {
      queuedTargetGear: schedule.desiredGear,
      reason: schedule.reason,
      kickdownPlanActive: false,
    };
  }

  // Throttle release cancels remaining kickdown steps unless schedule still wants lower.
  const releaseCancel =
    ctx.kickdownPlanActive && ctx.driverDemand < tx.kickdown.throttleThreshold * 0.72;

  const selection = selectTargetGearDetailed(
    {
      currentGear: gear,
      rpm: ctx.rpm,
      throttle: ctx.driverDemand,
      load: ctx.driverDemand,
      speedKmh: ctx.speedKmh,
      shiftDecisionSpeedKmh: ctx.shiftDecisionSpeedKmh,
      braking: ctx.braking,
      lastShiftCompletedAt: ctx.lastShiftCompletedAt,
      now: ctx.now,
      lastShiftWasUp: ctx.lastShiftWasUp,
      blockDownshiftUntil: ctx.blockDownshiftUntil,
      shifting: false,
      lastKickdownAt: ctx.lastKickdownAt,
      previousDemand: ctx.previousDemand,
    },
    profile,
    map,
  );

  if (releaseCancel && selection.reason !== "kickdown") {
    return {
      queuedTargetGear: selection.desiredGear,
      reason: selection.reason,
      kickdownPlanActive: false,
    };
  }

  let queued = selection.desiredGear;

  // If a kickdown plan is active and selection still wants lower (or equal plan),
  // keep the more aggressive safe target — but never below redline-safe gears.
  if (ctx.kickdownPlanActive && ctx.queuedTargetGear < gear && selection.reason === "kickdown") {
    queued = Math.min(ctx.queuedTargetGear, selection.desiredGear);
  }

  // Drop any queued gear that would exceed redline protection at current speed.
  while (queued < gear) {
    const rpmAt = rpmFromSpeedAndGear(ctx.shiftDecisionSpeedKmh, queued, profile);
    const limit = profile.engine.redlineRpm * tx.redline.maxDownshiftFraction;
    if (rpmAt <= limit) break;
    queued += 1;
  }

  const kickdownPlanActive =
    selection.reason === "kickdown" || (ctx.kickdownPlanActive && queued < gear);

  return {
    queuedTargetGear: queued,
    reason: selection.reason,
    kickdownPlanActive,
  };
}
