import type { VehicleMotionState } from "@/lib/motion/types";
import { resolveGearEngagement, type ShiftReason } from "@/lib/powertrain/gear-selector";
import { reconcileKickdownQueue } from "@/lib/powertrain/kickdown-queue";
import { updateOverrun, createOverrunState, type OverrunState } from "@/lib/powertrain/overrun";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  applyRedlineProtection,
  normalizeRpm,
  rateLimitRpm,
  rpmFromSpeedAndGear,
  rpmTrackTargetEx,
  smoothRpm,
} from "@/lib/powertrain/rpm-model";
import { resolveShiftMap, type ShiftMap } from "@/lib/powertrain/shift-map";
import {
  beginShift,
  createShiftControllerState,
  tickShift,
  type ShiftControllerState,
  type ShiftDirection,
} from "@/lib/powertrain/shift-controller";
import {
  createThrottleModelState,
  updateThrottleModel,
  type ThrottleModelState,
} from "@/lib/powertrain/throttle-model";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import { resolveDrivingMode } from "@/lib/powertrain/domain/driving-mode";

export interface PowertrainSimulatorOptions {
  profileId?: string;
  profile?: PowertrainProfile;
}

export interface PowertrainSimulatorInternals {
  gear: number;
  rpm: number;
  throttleState: ThrottleModelState;
  shiftState: ShiftControllerState;
  overrunState: OverrunState;
  previousThrottle: number;
  lastShiftCompletedAt: number;
  lastShiftWasUp: boolean;
  blockDownshiftUntil: number;
  lastNeutralAt: number;
  lastKickdownAt: number;
  queuedTargetGear: number;
  kickdownPlanActive: boolean;
  lastShiftReason: ShiftReason;
  /** Lightly filtered — RPM / driveline. */
  mechanicalSpeedKmh: number;
  /** Heavier filter — gear schedule / hysteresis only. */
  shiftDecisionSpeedKmh: number;
  clockMs: number;
  lastFallbackTier: VehicleMotionState["fallbackTier"];
  lastPrimarySource: VehicleMotionState["primarySource"];
  reconnectBlendUntil: number;
  shiftMap: ShiftMap | null;
}

/** ~140 ms effective smoothing for mechanical RPM under healthy 50–60 Hz ticks. */
const MECHANICAL_SPEED_TAU = 0.16;
/** ~550 ms effective smoothing for gear decisions. */
const SHIFT_DECISION_SPEED_TAU = 0.55;

function lowPassToward(current: number, target: number, dt: number, tau: number): number {
  const a = 1 - Math.exp(-Math.max(0.001, dt) / Math.max(0.05, tau));
  return current + (target - current) * a;
}

/** Standalone powertrain tick — no audio, no GPS. */
export class PowertrainSimulator {
  private profile: PowertrainProfile;
  private internal: PowertrainSimulatorInternals;

  constructor(options: PowertrainSimulatorOptions = {}) {
    this.profile = options.profile ?? getPowertrainProfile(options.profileId ?? "flat-six-sport");
    this.internal = createPowertrainInternals();
    this.internal.shiftMap = resolveShiftMap(this.profile);
  }

  getProfile(): PowertrainProfile {
    return this.profile;
  }

  setProfile(profile: PowertrainProfile | string) {
    this.profile = typeof profile === "string" ? getPowertrainProfile(profile) : profile;
    this.internal.shiftMap = resolveShiftMap(this.profile);
  }

  reset() {
    this.internal = createPowertrainInternals();
    this.internal.shiftMap = resolveShiftMap(this.profile);
  }

  getInternals(): Readonly<PowertrainSimulatorInternals> {
    return this.internal;
  }

  tick(
    motion: VehicleMotionState,
    dt: number,
    opts?: { directThrottle?: number; braking?: number; pedalPosition?: number },
  ): VirtualPowertrainState {
    const dtSafe = Math.min(0.1, Math.max(0.001, dt));
    const now = motion.timestamp || this.internal.clockMs + dtSafe * 1000;
    this.internal.clockMs = now;

    if (
      motion.fallbackTier !== this.internal.lastFallbackTier ||
      motion.primarySource !== this.internal.lastPrimarySource
    ) {
      this.internal.lastFallbackTier = motion.fallbackTier;
      this.internal.lastPrimarySource = motion.primarySource;
      // Short, mild blend — do not disconnect RPM from road speed for seconds.
      this.internal.reconnectBlendUntil = now + 900;
    }
    const resilienceBlend = motion.transitioning || now < this.internal.reconnectBlendUntil;
    const rpmTrackTau = this.profile.transmission.rpm.trackTau * (resilienceBlend ? 1.6 : 1);
    const rpmMaxRate = this.profile.transmission.rpm.maxRateRpmPerSec * (resilienceBlend ? 0.4 : 1);
    const holdShifts =
      motion.fallbackTier === "hold" ||
      now < this.internal.reconnectBlendUntil ||
      (motion.transitioning && motion.primarySource !== "simulator") ||
      (motion.fallbackTier === "decay" &&
        motion.primarySource !== "simulator" &&
        motion.motionConfidence < 0.55);

    // Three speed signals:
    // - displaySpeedKmh: responsive fused vehicle speed (UI; no extra lag)
    // - mechanicalSpeedKmh: light filter for RPM / driveline
    // - shiftDecisionSpeedKmh: heavier filter for gear selection only
    const displaySpeedKmh = Math.max(0, motion.speedKmh);
    const mechTau = resilienceBlend ? MECHANICAL_SPEED_TAU * 1.25 : MECHANICAL_SPEED_TAU;
    const decisionTau = resilienceBlend
      ? SHIFT_DECISION_SPEED_TAU * 1.15
      : SHIFT_DECISION_SPEED_TAU;
    this.internal.mechanicalSpeedKmh = lowPassToward(
      this.internal.mechanicalSpeedKmh || displaySpeedKmh,
      displaySpeedKmh,
      dtSafe,
      mechTau,
    );
    this.internal.shiftDecisionSpeedKmh = lowPassToward(
      this.internal.shiftDecisionSpeedKmh || displaySpeedKmh,
      displaySpeedKmh,
      dtSafe,
      decisionTau,
    );
    const mechanicalSpeedKmh = this.internal.mechanicalSpeedKmh;
    const shiftDecisionSpeedKmh = this.internal.shiftDecisionSpeedKmh;

    const pedal = opts?.directThrottle;
    const braking = opts?.braking ?? 0;
    const map = this.internal.shiftMap ?? resolveShiftMap(this.profile);
    let { gear, rpm, shiftState } = this.internal;
    let loadMultiplier = 1;
    let shiftCompletedThisTick = false;

    const prevGear = gear;
    const engageThrottle = pedal ?? motion.inferredThrottle;
    gear = resolveGearEngagement(gear, shiftDecisionSpeedKmh, engageThrottle, this.profile, {
      now,
      lastNeutralAt: this.internal.lastNeutralAt,
    });

    if (gear === 0 && prevGear > 0) {
      this.internal.lastNeutralAt = now;
    }

    if (shiftState.active) {
      const shift = tickShift(shiftState, dtSafe, this.profile, {
        load: this.internal.throttleState.engineLoad,
        speedKmh: mechanicalSpeedKmh,
      });
      shiftState = shift.state;
      rpm = applyRedlineProtection(shift.rpm, this.profile);
      loadMultiplier = shift.loadMultiplier;

      if (shift.complete && shift.completedGear != null) {
        gear = shift.completedGear;
        rpm = applyRedlineProtection(shift.rpm, this.profile);
        this.internal.lastShiftCompletedAt = now;
        this.internal.lastShiftWasUp = shift.completedDirection === "up";
        shiftCompletedThisTick = true;
        if (shift.completedDirection === "up") {
          this.internal.blockDownshiftUntil =
            now + this.profile.transmission.downshift.postUpshiftBlockMs;
        }
        if (this.internal.queuedTargetGear === gear) {
          this.internal.queuedTargetGear = gear;
          this.internal.kickdownPlanActive = false;
        }
      }
    } else if (gear > 0) {
      const demandHint = pedal ?? motion.inferredThrottle;
      const target = rpmTrackTargetEx(
        {
          speedKmh: mechanicalSpeedKmh,
          gear,
          driverDemand: demandHint,
          shifting: false,
        },
        this.profile,
      );
      const tracked = smoothRpm(rpm || target, target, dtSafe, rpmTrackTau);
      rpm = rateLimitRpm(rpm || tracked, tracked, dtSafe, rpmMaxRate);
      rpm = applyRedlineProtection(rpm, this.profile);
    } else {
      const idleTarget = this.profile.engine.idleRpm * (0.45 + (pedal ?? 0) * 0.12);
      rpm = smoothRpm(rpm, idleTarget, dtSafe, 0.14);
    }

    const rpmNorm = normalizeRpm(rpm, this.profile);
    const throttleResult = updateThrottleModel({
      motion,
      profile: this.profile,
      rpmNormalized: rpmNorm,
      dt: dtSafe,
      state: this.internal.throttleState,
      ...(opts?.pedalPosition !== undefined ? { pedalPosition: opts.pedalPosition } : {}),
      ...(pedal !== undefined ? { directThrottle: pedal } : {}),
      ...(opts?.braking !== undefined ? { braking: opts.braking } : {}),
    });

    let load = throttleResult.engineLoad * loadMultiplier;
    let targetGear = gear;
    let desiredGear = this.internal.queuedTargetGear || gear;

    if (!shiftState.active && gear > 0 && !shiftCompletedThisTick && !holdShifts) {
      const reconciled = reconcileKickdownQueue(
        {
          currentGear: gear,
          queuedTargetGear: this.internal.queuedTargetGear || gear,
          driverDemand: throttleResult.driverDemand,
          braking,
          rpm,
          shiftDecisionSpeedKmh,
          speedKmh: displaySpeedKmh,
          lastShiftCompletedAt: this.internal.lastShiftCompletedAt,
          now,
          lastShiftWasUp: this.internal.lastShiftWasUp,
          blockDownshiftUntil: this.internal.blockDownshiftUntil,
          lastKickdownAt: this.internal.lastKickdownAt,
          previousDemand: this.internal.previousThrottle,
          kickdownPlanActive: this.internal.kickdownPlanActive,
        },
        this.profile,
        map,
      );

      desiredGear = reconciled.queuedTargetGear;
      this.internal.queuedTargetGear = desiredGear;
      this.internal.kickdownPlanActive = reconciled.kickdownPlanActive;
      this.internal.lastShiftReason = reconciled.reason;
      if (reconciled.reason === "kickdown") {
        this.internal.lastKickdownAt = now;
        this.internal.kickdownPlanActive = true;
      }

      targetGear = desiredGear;
      if (desiredGear !== gear) {
        const nextGear = gear + Math.sign(desiredGear - gear);
        if (nextGear !== gear && Math.abs(nextGear - gear) === 1) {
          const direction: ShiftDirection = nextGear > gear ? "up" : "down";
          shiftState = beginShift(
            shiftState,
            direction,
            gear,
            nextGear,
            mechanicalSpeedKmh,
            rpm,
            this.profile,
          );
          if (shiftState.active) {
            targetGear = nextGear;
            const first = tickShift(shiftState, dtSafe, this.profile, {
              load: throttleResult.engineLoad,
              speedKmh: mechanicalSpeedKmh,
            });
            shiftState = first.state;
            rpm = applyRedlineProtection(first.rpm, this.profile);
            load = throttleResult.engineLoad * first.loadMultiplier;
          }
        }
      }
    } else if (shiftState.active) {
      // Reconcile queue mid-shift so release / brake / unsafe speed can cancel remaining steps.
      const mid = reconcileKickdownQueue(
        {
          currentGear: gear,
          queuedTargetGear: this.internal.queuedTargetGear || shiftState.toGear,
          driverDemand: throttleResult.driverDemand,
          braking,
          rpm,
          shiftDecisionSpeedKmh,
          speedKmh: displaySpeedKmh,
          lastShiftCompletedAt: this.internal.lastShiftCompletedAt,
          now,
          lastShiftWasUp: this.internal.lastShiftWasUp,
          blockDownshiftUntil: this.internal.blockDownshiftUntil,
          lastKickdownAt: this.internal.lastKickdownAt,
          previousDemand: this.internal.previousThrottle,
          kickdownPlanActive: this.internal.kickdownPlanActive,
        },
        this.profile,
        map,
      );
      this.internal.queuedTargetGear = mid.queuedTargetGear;
      this.internal.kickdownPlanActive = mid.kickdownPlanActive;
      if (mid.reason !== "none") this.internal.lastShiftReason = mid.reason;
      targetGear = shiftState.toGear;
      desiredGear = this.internal.queuedTargetGear || targetGear;
    }

    if (!shiftState.active && gear > 0 && this.internal.queuedTargetGear !== gear) {
      desiredGear = this.internal.queuedTargetGear;
      targetGear = gear + Math.sign(this.internal.queuedTargetGear - gear);
    }

    const overrunResult = updateOverrun({
      throttle: throttleResult.driverDemand,
      previousThrottle: this.internal.previousThrottle,
      accelerationFiltered: motion.accelerationFiltered,
      speedKmh: displaySpeedKmh,
      now,
      profile: this.profile,
      state: this.internal.overrunState,
      ...(pedal !== undefined ? { pedalRequest: pedal } : {}),
    });

    const drivingMode = resolveDrivingMode({
      speedKmh: displaySpeedKmh,
      throttle: throttleResult.driverDemand,
      accel: motion.accelerationFiltered,
      shifting: shiftState.active,
      overrun: overrunResult.overrun,
      gear,
    });

    this.internal = {
      ...this.internal,
      gear,
      rpm,
      throttleState: throttleResult.state,
      shiftState,
      overrunState: overrunResult.state,
      previousThrottle: throttleResult.driverDemand,
      queuedTargetGear: desiredGear,
    };

    const engineRunning =
      gear > 0 ||
      throttleResult.driverDemand > this.profile.transmission.idle.disengageThrottle ||
      displaySpeedKmh > this.profile.transmission.idle.disengageSpeedKmh;

    const mechanicalRpm =
      gear > 0
        ? rpmFromSpeedAndGear(mechanicalSpeedKmh, gear, this.profile)
        : this.profile.engine.idleRpm * 0.45;

    const out: VirtualPowertrainState = {
      timestamp: now,
      engineRunning,
      rpm,
      mechanicalRpm,
      normalizedRpm: normalizeRpm(rpm, this.profile),
      gear,
      targetGear,
      queuedTargetGear: desiredGear,
      driverDemand: throttleResult.driverDemand,
      engineLoad: load,
      throttle: throttleResult.driverDemand,
      load,
      shifting: shiftState.active,
      shiftPhase: shiftState.active ? shiftState.phase : "idle",
      lastShiftReason: this.internal.lastShiftReason,
      revMatchActive: shiftState.revMatchActive,
      revMatchProgress: shiftState.revMatchProgress,
      overrun: overrunResult.overrun,
      drivingMode,
      diagnostics: {
        powertrainBackend: "dynamic",
        displaySpeedKmh,
        mechanicalSpeedKmh,
        rawSpeedKmh: displaySpeedKmh,
        shiftDecisionSpeedKmh,
        braking,
        motionSource: motion.primarySource,
        fallbackTier: motion.fallbackTier,
      },
    };

    if (shiftState.active) {
      out.shiftDirection = shiftState.direction;
      out.shiftProgress = shiftState.progress;
    }

    return out;
  }
}

function createPowertrainInternals(): PowertrainSimulatorInternals {
  return {
    gear: 0,
    rpm: 0,
    throttleState: createThrottleModelState(),
    shiftState: createShiftControllerState(),
    overrunState: createOverrunState(),
    previousThrottle: 0,
    lastShiftCompletedAt: -60_000,
    lastShiftWasUp: false,
    blockDownshiftUntil: 0,
    lastNeutralAt: 0,
    lastKickdownAt: -60_000,
    queuedTargetGear: 0,
    kickdownPlanActive: false,
    lastShiftReason: "none",
    mechanicalSpeedKmh: 0,
    shiftDecisionSpeedKmh: 0,
    clockMs: 0,
    lastFallbackTier: "decay",
    lastPrimarySource: "simulator",
    reconnectBlendUntil: 0,
    shiftMap: null,
  };
}

export function idlePowertrainState(): VirtualPowertrainState {
  return { ...IDLE_POWERTRAIN, timestamp: Date.now() };
}
