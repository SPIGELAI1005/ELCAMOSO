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
import type { ShiftMap } from "@/lib/powertrain/shift-map";
import {
  applyShiftPresetToProfile,
  defaultShiftMapPreset,
  resolveShiftMapForPreset,
  type ShiftMapPresetId,
} from "@/lib/powertrain/shift-presets";
import { speedFreshnessFromMotion } from "@/lib/powertrain/gearless-state";
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
import type {
  DrivetrainShiftEvent,
  OperatingRegime,
  VirtualPowertrainState,
} from "@/lib/powertrain/types";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import { resolveDrivingMode } from "@/lib/powertrain/domain/driving-mode";
import {
  createBoostModelState,
  updateBoostModel,
  type BoostModelState,
} from "@/lib/powertrain/boost";

export interface PowertrainSimulatorOptions {
  profileId?: string;
  profile?: PowertrainProfile;
  /** Artistic shift-map preset; defaults via City flag or legacy. */
  shiftMapPreset?: ShiftMapPresetId;
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
  /** Lightly filtered - RPM / driveline. */
  mechanicalSpeedKmh: number;
  /** Heavier filter - gear schedule / hysteresis only. */
  shiftDecisionSpeedKmh: number;
  clockMs: number;
  lastFallbackTier: VehicleMotionState["fallbackTier"];
  lastPrimarySource: VehicleMotionState["primarySource"];
  reconnectBlendUntil: number;
  shiftMap: ShiftMap | null;
  boostState: BoostModelState;
  lastDisplaySpeedKmh: number;
  accelerationFilteredMs2: number;
  accelerationSpeedKmh: number;
  shiftSequenceId: number;
  lastShiftEvent: DrivetrainShiftEvent | null;
  recoveringUntilMs: number;
  operatingRegime: OperatingRegime;
  sourceChangedThisTick: boolean;
}

/** ~140 ms effective smoothing for mechanical RPM under healthy 50–60 Hz ticks. */
const MECHANICAL_SPEED_TAU = 0.16;
/** ~550 ms effective smoothing for gear decisions. */
const SHIFT_DECISION_SPEED_TAU = 0.55;

function lowPassToward(current: number, target: number, dt: number, tau: number): number {
  const a = 1 - Math.exp(-Math.max(0.001, dt) / Math.max(0.05, tau));
  return current + (target - current) * a;
}

/** Standalone powertrain tick - no audio, no GPS. */
export class PowertrainSimulator {
  private baseProfile: PowertrainProfile;
  private profile: PowertrainProfile;
  private shiftMapPreset: ShiftMapPresetId;
  private internal: PowertrainSimulatorInternals;

  constructor(options: PowertrainSimulatorOptions = {}) {
    this.baseProfile =
      options.profile ?? getPowertrainProfile(options.profileId ?? "flat-six-sport");
    this.shiftMapPreset = options.shiftMapPreset ?? defaultShiftMapPreset();
    this.profile = applyShiftPresetToProfile(this.baseProfile, this.shiftMapPreset);
    this.internal = createPowertrainInternals();
    this.internal.shiftMap = resolveShiftMapForPreset(this.profile, this.shiftMapPreset);
  }

  getProfile(): PowertrainProfile {
    return this.profile;
  }

  getShiftMapPreset(): ShiftMapPresetId {
    return this.shiftMapPreset;
  }

  setProfile(profile: PowertrainProfile | string) {
    this.baseProfile = typeof profile === "string" ? getPowertrainProfile(profile) : profile;
    this.profile = applyShiftPresetToProfile(this.baseProfile, this.shiftMapPreset);
    this.internal.shiftMap = resolveShiftMapForPreset(this.profile, this.shiftMapPreset);
  }

  setShiftMapPreset(preset: ShiftMapPresetId) {
    if (preset === this.shiftMapPreset) return;
    this.shiftMapPreset = preset;
    this.profile = applyShiftPresetToProfile(this.baseProfile, preset);
    this.internal.shiftMap = resolveShiftMapForPreset(this.profile, preset);
  }

  reset() {
    this.internal = createPowertrainInternals();
    this.internal.shiftMap = resolveShiftMapForPreset(this.profile, this.shiftMapPreset);
  }

  /**
   * Seed gear/RPM for the current road speed on a new Sound Profile.
   * Maps into legal ratios for this personality - does not replay start/shift events.
   */
  warmStartAtSpeed(speedKmh: number, driverDemand = 0.28) {
    const speed = Math.max(0, speedKmh);
    const demand = Math.min(1, Math.max(0, driverDemand));
    this.internal.mechanicalSpeedKmh = speed;
    this.internal.shiftDecisionSpeedKmh = speed;
    this.internal.lastDisplaySpeedKmh = speed;
    this.internal.accelerationSpeedKmh = speed;
    this.internal.accelerationFilteredMs2 = 0;
    this.internal.shiftState = createShiftControllerState();
    this.internal.lastShiftEvent = null;
    this.internal.shiftSequenceId = 0;
    this.internal.queuedTargetGear = 0;
    this.internal.kickdownPlanActive = false;
    this.internal.lastShiftReason = "none";
    this.internal.operatingRegime = "steady";
    this.internal.recoveringUntilMs = 0;
    this.internal.lastShiftCompletedAt = -60_000;

    if (speed < 1.2) {
      this.internal.gear = 0;
      this.internal.rpm = this.profile.engine.idleRpm;
      return;
    }

    const ratios = this.profile.transmission.gearRatios;
    const gearCount = ratios.length;
    let bestGear = 1;
    let bestScore = Number.POSITIVE_INFINITY;
    const targetRpm =
      this.profile.engine.idleRpm +
      (this.profile.engine.redlineRpm - this.profile.engine.idleRpm) * (0.35 + demand * 0.2);

    for (let g = 1; g <= gearCount; g += 1) {
      const rpm = rpmFromSpeedAndGear(speed, g, this.profile);
      const ceiling = this.profile.engine.redlineRpm * 0.92;
      const floor = this.profile.engine.idleRpm * 1.05;
      if (rpm > ceiling || rpm < floor) continue;
      const score = Math.abs(rpm - targetRpm);
      if (score < bestScore) {
        bestScore = score;
        bestGear = g;
      }
    }

    // Fallback: highest gear that stays under redline, else 1.
    if (!Number.isFinite(bestScore) || bestScore === Number.POSITIVE_INFINITY) {
      bestGear = 1;
      for (let g = gearCount; g >= 1; g -= 1) {
        if (rpmFromSpeedAndGear(speed, g, this.profile) <= this.profile.engine.redlineRpm * 0.95) {
          bestGear = g;
          break;
        }
      }
    }

    this.internal.gear = bestGear;
    this.internal.rpm = rpmFromSpeedAndGear(speed, bestGear, this.profile);
  }

  getInternals(): Readonly<PowertrainSimulatorInternals> {
    return this.internal;
  }

  tick(
    motion: VehicleMotionState,
    dt: number,
    opts?: { directThrottle?: number; braking?: number; pedalPosition?: number },
  ): VirtualPowertrainState {
    const suppliedDt = Math.min(0.1, Math.max(0.001, dt));
    const sampleTimestamp = motion.timestamp || 0;
    const hadPriorClock = this.internal.clockMs > 0;
    const timestampDt =
      this.internal.clockMs > 0 && sampleTimestamp > this.internal.clockMs
        ? (sampleTimestamp - this.internal.clockMs) / 1000
        : suppliedDt;
    const dtSafe = Math.min(0.1, Math.max(0.001, timestampDt));
    const now =
      sampleTimestamp > this.internal.clockMs
        ? sampleTimestamp
        : this.internal.clockMs + dtSafe * 1000;
    this.internal.clockMs = now;

    let sourceChanged = false;
    if (
      motion.fallbackTier !== this.internal.lastFallbackTier ||
      motion.primarySource !== this.internal.lastPrimarySource
    ) {
      sourceChanged = hadPriorClock;
      this.internal.lastFallbackTier = motion.fallbackTier;
      this.internal.lastPrimarySource = motion.primarySource;
      // Short, mild blend - do not disconnect RPM from road speed for seconds.
      this.internal.reconnectBlendUntil = now + 900;
    }
    this.internal.sourceChangedThisTick = sourceChanged;
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
    // Negative / reverse inputs are rejected (policy: road speed ≥ 0). Missing
    // telemetry must be handled by fusion hold/decay — never invent 0 here from null.
    const displaySpeedKmh = Number.isFinite(motion.speedKmh)
      ? Math.max(0, motion.speedKmh)
      : this.internal.lastDisplaySpeedKmh;
    const gpsOnly =
      motion.accelerationProvenance === "estimated-speed" ||
      (motion.accelerationProvenance == null &&
        !motion.sourceHealth.vehicleTelemetry &&
        motion.primarySource === "tesla-browser");
    const priorAccelerationSpeedKmh = this.internal.accelerationSpeedKmh || displaySpeedKmh;
    this.internal.accelerationSpeedKmh = lowPassToward(
      priorAccelerationSpeedKmh,
      displaySpeedKmh,
      dtSafe,
      0.7,
    );
    const derivedAcceleration = hadPriorClock
      ? ((this.internal.accelerationSpeedKmh - priorAccelerationSpeedKmh) / 3.6) / dtSafe
      : 0;
    const accelerationTarget = holdShifts
      ? 0
      : gpsOnly
        ? Math.max(-5, Math.min(4, derivedAcceleration))
        : motion.accelerationFiltered;
    const accelTau = gpsOnly ? 0.42 : 0.18;
    this.internal.accelerationFilteredMs2 = lowPassToward(
      this.internal.accelerationFilteredMs2,
      accelerationTarget,
      dtSafe,
      accelTau,
    );
    this.internal.lastDisplaySpeedKmh = displaySpeedKmh;
    const effectiveMotion: VehicleMotionState = {
      ...motion,
      accelerationMs2: gpsOnly ? this.internal.accelerationFilteredMs2 : motion.accelerationMs2,
      accelerationFiltered: this.internal.accelerationFilteredMs2,
      decelerationMs2: Math.max(0, -this.internal.accelerationFilteredMs2),
    };
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
    const map =
      this.internal.shiftMap ?? resolveShiftMapForPreset(this.profile, this.shiftMapPreset);
    let { gear, rpm, shiftState } = this.internal;
    const previousDemand = this.internal.previousThrottle;
    let loadMultiplier = 1;
    let shiftCompletedThisTick = false;
    let shiftEventThisTick: DrivetrainShiftEvent | null = null;

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
        const recoveryMs = Math.max(
          150,
          this.profile.transmission.shift.downshiftDurationMs * 0.55,
        );
        this.internal.recoveringUntilMs = now + recoveryMs;
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
      // Idle: use the configured idle RPM (was erroneously 0.45x which caused 308-544 vs 680-1200)
      const idleTarget = this.profile.engine.idleRpm * (1.0 + (pedal ?? 0) * 0.08);
      rpm = smoothRpm(rpm, idleTarget, dtSafe, 0.14);
    }

    const rpmNorm = normalizeRpm(rpm, this.profile);
    const throttleResult = updateThrottleModel({
      motion: effectiveMotion,
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
            this.internal.shiftSequenceId += 1;
            shiftEventThisTick = {
              sequenceId: this.internal.shiftSequenceId,
              atMs: now,
              fromGear: gear,
              toGear: nextGear,
              direction,
              reason: this.internal.lastShiftReason,
            };
            this.internal.lastShiftEvent = shiftEventThisTick;
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
      accelerationFiltered: effectiveMotion.accelerationFiltered,
      speedKmh: displaySpeedKmh,
      now,
      profile: this.profile,
      state: this.internal.overrunState,
      ...(pedal !== undefined ? { pedalRequest: pedal } : {}),
    });

    const drivingMode = resolveDrivingMode({
      speedKmh: displaySpeedKmh,
      throttle: throttleResult.driverDemand,
      accel: effectiveMotion.accelerationFiltered,
      shifting: shiftState.active,
      overrun: overrunResult.overrun,
      gear,
    });

    const boostResult = updateBoostModel({
      state: this.internal.boostState,
      profile: this.profile,
      rpm,
      engineLoad: load,
      driverDemand: throttleResult.driverDemand,
      dtSec: dtSafe,
      nowMs: now,
      telemetryStable: !holdShifts && !motion.transitioning,
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
      boostState: boostResult.state,
    };

    const engineRunning =
      gear > 0 ||
      throttleResult.driverDemand > this.profile.transmission.idle.disengageThrottle ||
      displaySpeedKmh > this.profile.transmission.idle.disengageSpeedKmh;

    const mechanicalRpm =
      gear > 0
        ? rpmFromSpeedAndGear(mechanicalSpeedKmh, gear, this.profile)
        : this.profile.engine.idleRpm * 0.45;

    const speedFreshness = speedFreshnessFromMotion(motion);
    let operatingRegime: OperatingRegime = "steady";
    if (shiftState.active) {
      operatingRegime = "shifting";
    } else if (now < this.internal.recoveringUntilMs) {
      operatingRegime = "recovering";
    } else if (
      !holdShifts &&
      (braking > 0.12 ||
        throttleResult.driverDemand < previousDemand - 0.08 ||
        effectiveMotion.accelerationFiltered < -0.6)
    ) {
      operatingRegime = "unloading";
    }
    this.internal.operatingRegime = operatingRegime;

    const out: VirtualPowertrainState = {
      timestamp: now,
      engineRunning,
      speedKmh: displaySpeedKmh,
      speedSource: motion.primarySource,
      speedFreshness,
      rpm,
      mechanicalRpm,
      normalizedRpm: normalizeRpm(rpm, this.profile),
      gear,
      targetGear,
      queuedTargetGear: desiredGear,
      driverDemand: throttleResult.driverDemand,
      engineLoad: load,
      estimatedLoad: load,
      boost: boostResult.boost,
      boostRelease: boostResult.releaseTriggered,
      throttle: throttleResult.driverDemand,
      load,
      shifting: shiftState.active,
      shiftPhase: shiftState.active ? shiftState.phase : "idle",
      lastShiftReason: this.internal.lastShiftReason,
      operatingRegime,
      lastShiftEvent: this.internal.lastShiftEvent,
      shiftEvent: shiftEventThisTick,
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
        speedFreshness,
        sourceChanged,
        shiftMapPreset: this.shiftMapPreset,
        accelerationFilteredMs2: effectiveMotion.accelerationFiltered,
        effectiveDtMs: dtSafe * 1000,
      },
    };

    if (shiftState.active) {
      out.shiftDirection = shiftState.direction;
      out.shiftProgress = shiftState.progress;
      out.shiftLoadMultiplier = loadMultiplier;
    } else {
      out.shiftLoadMultiplier = 1;
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
    boostState: createBoostModelState(),
    lastDisplaySpeedKmh: 0,
    accelerationFilteredMs2: 0,
    accelerationSpeedKmh: 0,
    shiftSequenceId: 0,
    lastShiftEvent: null,
    recoveringUntilMs: 0,
    operatingRegime: "steady",
    sourceChangedThisTick: false,
  };
}

export function idlePowertrainState(): VirtualPowertrainState {
  return { ...IDLE_POWERTRAIN, timestamp: Date.now() };
}
