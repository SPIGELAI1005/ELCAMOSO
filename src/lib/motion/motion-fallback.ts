import type { MotionFallbackTier, SensorSource, VehicleMotionState } from "@/lib/motion/types";
import { PACKET_LOSS_HOLD_MS } from "@/lib/motion/motion-relay-resilience";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type { MotionFallbackTier };

export const FALLBACK_TIER_PRIORITY: MotionFallbackTier[] = [
  "vehicle-telemetry",
  "phone",
  "browser",
  "hold",
  "decay",
];

/** Brief gap tolerance before falling to decay (packet loss, lock screen). */
export const SIGNAL_HOLD_MS = PACKET_LOSS_HOLD_MS;
/** Phone IMU considered live for tier resolution (ms). */
export const PHONE_IMU_FRESH_MS = 450;
/** RPM blend window after source reconnect or tier upgrade. */
export const RECONNECT_BLEND_MS = 1500;
/** Speed crossfade when switching active tier. */
export const TIER_BLEND_TAU_S = 0.42;
/** Safe coast-down rate (fraction per second). */
export const DECAY_RATE_PER_S = 0.16;
/** Throttle/accel hold decay when IMU drops (per second). */
export const OUTPUT_HOLD_DECAY_PER_S = 0.22;

export interface SourceFreshness {
  telemetryAgeMs: number | null;
  phoneAgeMs: number | null;
  browserAgeMs: number | null;
  phoneImuAgeMs: number | null;
  browserImuAgeMs: number | null;
}

export interface MotionFallbackState {
  activeTier: MotionFallbackTier;
  previousTier: MotionFallbackTier;
  tierSince: number;
  tierBlend: number;
  holdSpeedMs: number;
  holdAccelMs2: number;
  holdThrottle: number;
  lastAnySourceAt: number;
  phoneSuspended: boolean;
  reconnectBlendUntil: number;
}

export function createMotionFallbackState(): MotionFallbackState {
  return {
    activeTier: "decay",
    previousTier: "decay",
    tierSince: 0,
    tierBlend: 1,
    holdSpeedMs: 0,
    holdAccelMs2: 0,
    holdThrottle: 0,
    lastAnySourceAt: 0,
    phoneSuspended: false,
    reconnectBlendUntil: 0,
  };
}

export function resetMotionFallbackState(state: MotionFallbackState): void {
  Object.assign(state, createMotionFallbackState());
}

function tierFromSource(source: SensorSource | null): MotionFallbackTier {
  if (source === "vehicle-telemetry") return "vehicle-telemetry";
  if (source === "phone") return "phone";
  if (source === "tesla-browser") return "browser";
  return "decay";
}

function tierPriority(tier: MotionFallbackTier): number {
  const idx = FALLBACK_TIER_PRIORITY.indexOf(tier);
  return idx >= 0 ? idx : FALLBACK_TIER_PRIORITY.length;
}

export function resolveFallbackTier(input: {
  freshness: SourceFreshness;
  phoneSuspended: boolean;
  now: number;
  lastAnySourceAt: number;
  telemetryStaleMs: number;
  phoneStaleMs: number;
  browserStaleMs: number;
}): MotionFallbackTier {
  const { freshness, phoneSuspended, now, lastAnySourceAt } = input;

  if (freshness.telemetryAgeMs !== null && freshness.telemetryAgeMs <= input.telemetryStaleMs) {
    return "vehicle-telemetry";
  }

  if (
    !phoneSuspended &&
    freshness.phoneAgeMs !== null &&
    freshness.phoneAgeMs <= input.phoneStaleMs
  ) {
    return "phone";
  }

  /** Phone IMU alone keeps the phone tier when GPS is lagging or absent. */
  if (
    !phoneSuspended &&
    freshness.phoneImuAgeMs !== null &&
    freshness.phoneImuAgeMs <= PHONE_IMU_FRESH_MS
  ) {
    return "phone";
  }

  if (freshness.browserAgeMs !== null && freshness.browserAgeMs <= input.browserStaleMs) {
    return "browser";
  }

  if (lastAnySourceAt > 0 && now - lastAnySourceAt <= SIGNAL_HOLD_MS) {
    return "hold";
  }

  return "decay";
}

export function beginTierTransition(
  state: MotionFallbackState,
  nextTier: MotionFallbackTier,
  now: number,
  snapshot: { speedMs: number; accelMs2: number; throttle: number },
): void {
  if (nextTier === state.activeTier) return;

  const upgraded = tierPriority(nextTier) < tierPriority(state.activeTier);
  const downgraded = tierPriority(nextTier) > tierPriority(state.activeTier);
  state.previousTier = state.activeTier;
  state.activeTier = nextTier;
  state.tierSince = now;
  state.tierBlend = 0;

  state.holdSpeedMs = snapshot.speedMs;
  state.holdAccelMs2 = snapshot.accelMs2;
  state.holdThrottle = snapshot.throttle;

  if (upgraded && nextTier !== "hold" && nextTier !== "decay") {
    state.reconnectBlendUntil = now + RECONNECT_BLEND_MS;
  } else if (downgraded && (nextTier === "hold" || nextTier === "browser")) {
    state.reconnectBlendUntil = now + RECONNECT_BLEND_MS;
  }
}

export function tickTierBlend(state: MotionFallbackState, dt: number): void {
  if (state.tierBlend >= 1) return;
  const alpha = 1 - Math.exp(-Math.max(0.001, dt) / TIER_BLEND_TAU_S);
  state.tierBlend = clamp01(state.tierBlend + alpha);
}

export function notifyPhoneRelayLost(
  state: MotionFallbackState,
  now: number,
  snapshot?: { speedMs: number; accelMs2: number; throttle: number },
): void {
  state.phoneSuspended = true;
  const snap = snapshot ?? {
    speedMs: state.holdSpeedMs,
    accelMs2: state.holdAccelMs2,
    throttle: state.holdThrottle,
  };
  snapshotHoldValues(state, {
    speedMs: snap.speedMs,
    accelMs2: snap.accelMs2,
    throttle: snap.throttle,
  });
  state.reconnectBlendUntil = now + RECONNECT_BLEND_MS;
}

export function notifyPhoneRelayRestored(state: MotionFallbackState, now: number): void {
  if (!state.phoneSuspended) return;
  state.phoneSuspended = false;
  state.reconnectBlendUntil = now + RECONNECT_BLEND_MS;
}

export function noteSourceActivity(state: MotionFallbackState, now: number): void {
  state.lastAnySourceAt = now;
}

export function isReconnectBlending(state: MotionFallbackState, now: number): boolean {
  return now < state.reconnectBlendUntil;
}

export interface FallbackSpeedInput {
  tier: MotionFallbackTier;
  candidateSpeedMs: number | null;
  currentSpeedMs: number;
  holdSpeedMs: number;
  imuAccelMs2: number | null;
  dt: number;
  tierBlend: number;
}

/** Apply tier-specific speed target with graceful hold/decay. */
export function resolveFallbackSpeed(input: FallbackSpeedInput): number {
  const { tier, candidateSpeedMs, currentSpeedMs, holdSpeedMs, imuAccelMs2, dt, tierBlend } = input;
  const dtSafe = Math.min(0.25, Math.max(0.001, dt));

  if (tier === "decay") {
    const coast = Math.max(0, currentSpeedMs * Math.max(0, 1 - dtSafe * DECAY_RATE_PER_S));
    const imuAssist =
      imuAccelMs2 !== null && imuAccelMs2 > 0
        ? Math.max(0, coast + imuAccelMs2 * dtSafe * 0.25)
        : coast;
    return imuAssist;
  }

  if (tier === "hold") {
    const held = holdSpeedMs > 0 ? holdSpeedMs : currentSpeedMs;
    const gentle = Math.max(0, held * Math.max(0, 1 - dtSafe * OUTPUT_HOLD_DECAY_PER_S * 0.35));
    return gentle;
  }

  if (candidateSpeedMs === null) {
    if (
      imuAccelMs2 !== null &&
      imuAccelMs2 > 0 &&
      (tier === "phone" || tier === "vehicle-telemetry")
    ) {
      return Math.max(0, currentSpeedMs + imuAccelMs2 * dtSafe * 0.42);
    }
    return currentSpeedMs;
  }

  if (tierBlend < 1 && holdSpeedMs > 0) {
    return holdSpeedMs + (candidateSpeedMs - holdSpeedMs) * tierBlend;
  }

  return candidateSpeedMs;
}

export interface FallbackAccelInput {
  tier: MotionFallbackTier;
  imuAccelMs2: number | null;
  currentAccelMs2: number;
  holdAccelMs2: number;
  dt: number;
}

/** Hold then decay longitudinal accel when IMU drops - avoids audio collapse. */
export function resolveFallbackAccel(input: FallbackAccelInput): number {
  const { tier, imuAccelMs2, currentAccelMs2, holdAccelMs2, dt } = input;
  const dtSafe = Math.min(0.25, Math.max(0.001, dt));

  if (imuAccelMs2 !== null) return imuAccelMs2;

  const base = holdAccelMs2 > 0 ? holdAccelMs2 : currentAccelMs2;
  if (tier === "hold" || tier === "decay") {
    const rate = tier === "hold" ? OUTPUT_HOLD_DECAY_PER_S * 0.45 : OUTPUT_HOLD_DECAY_PER_S * 0.65;
    return base * Math.max(0, 1 - dtSafe * rate);
  }

  return base * Math.max(0, 1 - dtSafe * OUTPUT_HOLD_DECAY_PER_S);
}

export function resolveFallbackConfidence(
  tier: MotionFallbackTier,
  baseConfidence: number,
): number {
  switch (tier) {
    case "vehicle-telemetry":
      return clamp01(baseConfidence);
    case "phone":
      return clamp01(baseConfidence * 0.98);
    case "browser":
      return clamp01(baseConfidence * 0.88);
    case "hold":
      return clamp01(Math.max(0.28, baseConfidence * 0.72));
    case "decay":
      return clamp01(Math.max(0.14, baseConfidence * 0.55));
    default:
      return clamp01(baseConfidence);
  }
}

export function snapshotHoldValues(
  state: MotionFallbackState,
  motion: {
    speedMs: number;
    accelMs2: number;
    throttle: number;
  },
): void {
  if (motion.speedMs > 0.05) state.holdSpeedMs = motion.speedMs;
  if (Math.abs(motion.accelMs2) > 0.02) state.holdAccelMs2 = motion.accelMs2;
  if (motion.throttle > 0.03) state.holdThrottle = motion.throttle;
}

export function tierFromBaselineSource(source: SensorSource | null): MotionFallbackTier {
  return tierFromSource(source);
}

export type ResilienceMotion = VehicleMotionState & {
  fallbackTier: MotionFallbackTier;
  transitioning: boolean;
};

export function withFallbackFields(
  motion: VehicleMotionState,
  fallback: MotionFallbackState,
): ResilienceMotion {
  return {
    ...motion,
    fallbackTier: fallback.activeTier,
    transitioning: fallback.tierBlend < 0.98 || isReconnectBlending(fallback, motion.timestamp),
  };
}
