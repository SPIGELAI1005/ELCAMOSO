import { lowPassToward } from "@/lib/motion/filters";
import {
  extrapolateSpeedMs,
  alignReceivedAt,
  SPEED_CHANNEL_PRIORITY,
  sourceForChannel,
  sampleHasGpsSpeed,
  type FusionInputChannel,
} from "@/lib/motion/sensor-fusion-channels";
import {
  beginTierTransition,
  createMotionFallbackState,
  isReconnectBlending,
  noteSourceActivity,
  notifyPhoneRelayLost,
  notifyPhoneRelayRestored,
  RECONNECT_BLEND_MS,
  resolveFallbackAccel,
  resolveFallbackConfidence,
  resolveFallbackSpeed,
  resolveFallbackTier,
  snapshotHoldValues,
  tickTierBlend,
  withFallbackFields,
  type MotionFallbackState,
  type SourceFreshness,
} from "@/lib/motion/motion-fallback";
import {
  fuseAccelLayers,
  fuseSpeedLayers,
  speedConflictGapMs,
  SPEED_CONFLICT_MS,
} from "@/lib/motion/sensor-fusion-correction";
import {
  IDLE_VEHICLE_MOTION,
  type MotionSample,
  type SensorSource,
  type VehicleMotionState,
} from "@/lib/motion/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Source priority for speed baseline (lower index = higher priority). */
export const SPEED_SOURCE_PRIORITY: SensorSource[] = [
  "vehicle-telemetry",
  "phone",
  "tesla-browser",
  "simulator",
];

const GPS_FRESH_MS = 1800;
const GPS_STALE_MS = 5000;
const PHONE_STALE_MS = 2800;
const IMU_STALE_MS = 450;
const TELEMETRY_STALE_MS = 1200;

const MAX_GPS_ACCURACY_M = 80;
const WEAK_GPS_ACCURACY_M = 35;

/** Low-pass time constants (seconds). */
const SPEED_BASELINE_TAU = 0.38;
const ACCEL_THROTTLE_TAU = 0.32;
const MAX_ACCEL_SPIKE = 14;

export interface SensorFusionOptions {
  sensitivity?: number;
  noiseFloor?: number;
}

interface StoredSample {
  sample: MotionSample;
  /** performance.now() when ingested (display-side clock). */
  receivedAt: number;
  /** Sample wall timestamp from the provider. */
  sampleTimestamp: number;
  speedMs: number | null;
  previousSpeedMs: number | null;
  previousReceivedAt: number | null;
  speedRejected: boolean;
}

export interface SensorFusionState {
  options: Required<SensorFusionOptions>;
  bySource: Partial<Record<SensorSource, StoredSample>>;
  speedHistory: { t: number; v: number }[];
  /** Slow authoritative speed anchor (telemetry → phone GPS → browser GPS). */
  speedAnchorMs: number;
  speedFilteredMs: number;
  /** Slow telemetry/longitudinal anchor for accel correction. */
  accelAnchorMs2: number;
  accelTransientMs2: number;
  accelFilteredMs2: number;
  inferredThrottle: number;
  primarySource: SensorSource;
  motionConfidence: number;
  sourceHealth: VehicleMotionState["sourceHealth"];
  initialized: boolean;
  fallback: MotionFallbackState;
}

export function createSensorFusion(options: SensorFusionOptions = {}): SensorFusionState {
  return {
    options: {
      sensitivity: options.sensitivity ?? 1,
      noiseFloor: options.noiseFloor ?? 0,
    },
    bySource: {},
    speedHistory: [],
    speedAnchorMs: 0,
    speedFilteredMs: 0,
    accelAnchorMs2: 0,
    accelTransientMs2: 0,
    accelFilteredMs2: 0,
    inferredThrottle: 0,
    primarySource: "simulator",
    motionConfidence: 0,
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    initialized: false,
    fallback: createMotionFallbackState(),
  };
}

export function resetSensorFusion(state: SensorFusionState): void {
  const opts = state.options;
  Object.assign(state, createSensorFusion(opts));
}

export function markPhoneRelayLost(state: SensorFusionState, now = performance.now()): void {
  notifyPhoneRelayLost(state.fallback, now, {
    speedMs: state.speedFilteredMs,
    accelMs2: state.accelTransientMs2,
    throttle: state.inferredThrottle,
  });
  delete state.bySource.phone;
}

export function markTelemetryRelayLost(state: SensorFusionState, now = performance.now()): void {
  delete state.bySource["vehicle-telemetry"];
  state.fallback.reconnectBlendUntil = now + RECONNECT_BLEND_MS;
  snapshotHoldValues(state.fallback, {
    speedMs: state.speedFilteredMs,
    accelMs2: state.accelTransientMs2,
    throttle: state.inferredThrottle,
  });
}

export function markPhoneRelayRestored(state: SensorFusionState, now = performance.now()): void {
  notifyPhoneRelayRestored(state.fallback, now);
}

/** Ingest a normalized motion sample from any provider channel. */
export function pushMotionSample(
  state: SensorFusionState,
  sample: MotionSample,
  receivedAt: number,
): void {
  if (!Number.isFinite(sample.timestamp)) return;
  const prev = state.bySource[sample.source];
  const merged: MotionSample = prev ? mergeMotionSample(prev.sample, sample) : sample;

  const speedMs = speedFromSample(merged);
  let speedRejected = false;

  if (speedMs !== null && prev?.speedMs != null && prev.previousReceivedAt != null) {
    const dt = Math.max(0.001, (receivedAt - prev.receivedAt) / 1000);
    const maxDelta = 6.5 * dt + 2.5;
    if (Math.abs(speedMs - prev.speedMs) > maxDelta) {
      speedRejected = true;
    }
  }

  state.bySource[sample.source] = {
    sample: merged,
    receivedAt: alignReceivedAt(merged.timestamp, receivedAt),
    sampleTimestamp: merged.timestamp,
    speedMs: speedRejected ? (prev?.speedMs ?? speedMs) : speedMs,
    previousSpeedMs: prev?.speedMs ?? null,
    previousReceivedAt: prev?.receivedAt ?? null,
    speedRejected,
  };
}

function mergeOptionalField<T>(next: T | undefined, prev: T | undefined): T | undefined {
  return next !== undefined ? next : prev;
}

function mergeMotionSample(prev: MotionSample, incoming: MotionSample): MotionSample {
  const merged: MotionSample = {
    ...prev,
    timestamp: incoming.timestamp,
    source: incoming.source,
  };
  const speedKmh = mergeOptionalField(incoming.speedKmh, prev.speedKmh);
  if (speedKmh !== undefined) merged.speedKmh = speedKmh;
  const accelerationLongitudinal = mergeOptionalField(
    incoming.accelerationLongitudinal,
    prev.accelerationLongitudinal,
  );
  if (accelerationLongitudinal !== undefined)
    merged.accelerationLongitudinal = accelerationLongitudinal;
  const accelerationLateral = mergeOptionalField(
    incoming.accelerationLateral,
    prev.accelerationLateral,
  );
  if (accelerationLateral !== undefined) merged.accelerationLateral = accelerationLateral;
  const heading = mergeOptionalField(incoming.heading, prev.heading);
  if (heading !== undefined) merged.heading = heading;
  const accuracy = mergeOptionalField(incoming.accuracy, prev.accuracy);
  if (accuracy !== undefined) merged.accuracy = accuracy;
  const pedalPosition = mergeOptionalField(incoming.pedalPosition, prev.pedalPosition);
  if (pedalPosition !== undefined) merged.pedalPosition = pedalPosition;
  const motorAxleSpeedRpm = mergeOptionalField(incoming.motorAxleSpeedRpm, prev.motorAxleSpeedRpm);
  if (motorAxleSpeedRpm !== undefined) merged.motorAxleSpeedRpm = motorAxleSpeedRpm;
  const vehicleOperatingState = mergeOptionalField(
    incoming.vehicleOperatingState,
    prev.vehicleOperatingState,
  );
  if (vehicleOperatingState !== undefined) merged.vehicleOperatingState = vehicleOperatingState;
  return merged;
}

function sourcePriority(source: SensorSource): number {
  const idx = SPEED_SOURCE_PRIORITY.indexOf(source);
  return idx >= 0 ? idx : SPEED_SOURCE_PRIORITY.length;
}

function sampleAgeMs(stored: StoredSample | undefined, now: number): number {
  if (!stored) return Infinity;
  return now - stored.receivedAt;
}

function isGpsAccuracyOk(accuracy: number | undefined): boolean {
  if (accuracy === undefined || !Number.isFinite(accuracy)) return true;
  return accuracy <= MAX_GPS_ACCURACY_M;
}

function gpsConfidenceFromAccuracy(accuracy: number | undefined): number {
  if (accuracy === undefined || !Number.isFinite(accuracy)) return 0.72;
  if (accuracy > MAX_GPS_ACCURACY_M) return 0;
  if (accuracy <= 12) return 1;
  if (accuracy <= WEAK_GPS_ACCURACY_M) return 0.82;
  return clamp01(1 - (accuracy - WEAK_GPS_ACCURACY_M) / (MAX_GPS_ACCURACY_M - WEAK_GPS_ACCURACY_M));
}

function staleLimitFor(source: SensorSource): number {
  switch (source) {
    case "vehicle-telemetry":
      return TELEMETRY_STALE_MS;
    case "phone":
      return PHONE_STALE_MS;
    case "tesla-browser":
      return GPS_STALE_MS;
    default:
      return GPS_STALE_MS;
  }
}

function speedFromSample(sample: MotionSample): number | null {
  if (sample.speedKmh === undefined || !Number.isFinite(sample.speedKmh)) return null;
  return Math.max(0, sample.speedKmh / 3.6);
}

function longitudinalAccelFromSample(
  sample: MotionSample,
  sensitivity: number,
  noiseFloor: number,
): number | null {
  const raw = sample.accelerationLongitudinal;
  if (raw === undefined || !Number.isFinite(raw)) return null;
  const scaled = raw * sensitivity;
  return Math.abs(scaled) < noiseFloor * 0.35 ? 0 : scaled;
}

function interpolateSpeedAt(
  stored: StoredSample,
  now: number,
  imuAccelMs2: number | null,
): number | null {
  const speedMs = stored.speedMs ?? speedFromSample(stored.sample);
  if (speedMs === null) return null;
  const age = now - stored.receivedAt;
  if (age <= 0) return speedMs;
  return extrapolateSpeedMs(
    speedMs,
    imuAccelMs2 ?? stored.sample.accelerationLongitudinal ?? null,
    age,
  );
}

function channelToSource(channel: FusionInputChannel): SensorSource {
  return sourceForChannel(channel);
}

function pickSpeedBaseline(
  state: SensorFusionState,
  now: number,
): { speedMs: number | null; source: SensorSource | null; confidence: number } {
  const candidates: {
    source: SensorSource;
    speedMs: number;
    confidence: number;
    priority: number;
  }[] = [];

  const imuHint = pickPhoneImuAccel(state, now);

  for (const channel of SPEED_CHANNEL_PRIORITY) {
    const source = channelToSource(channel);
    const stored = state.bySource[source];
    if (!stored) continue;
    if (
      (channel === "phone-gps" || channel === "tesla-browser-gps") &&
      !sampleHasGpsSpeed(stored.sample)
    ) {
      continue;
    }

    const age = sampleAgeMs(stored, now);
    if (age > staleLimitFor(source)) continue;

    const speedMs =
      interpolateSpeedAt(stored, now, imuHint) ?? stored.speedMs ?? speedFromSample(stored.sample);
    if (speedMs === null) continue;
    if (!isGpsAccuracyOk(stored.sample.accuracy)) continue;

    const freshBoost =
      age < GPS_FRESH_MS
        ? 1
        : clamp01(1 - (age - GPS_FRESH_MS) / (staleLimitFor(source) - GPS_FRESH_MS));
    let confidence: number;
    if (source === "vehicle-telemetry") {
      confidence = clamp01(0.9 + freshBoost * 0.1);
    } else {
      const accuracyConf = gpsConfidenceFromAccuracy(stored.sample.accuracy);
      confidence = clamp01(accuracyConf * (0.55 + freshBoost * 0.45));
    }

    candidates.push({
      source,
      speedMs,
      confidence,
      priority: sourcePriority(source),
    });
  }

  if (!candidates.length) return { speedMs: null, source: null, confidence: 0 };

  candidates.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
  const best = candidates[0]!;
  return { speedMs: best.speedMs, source: best.source, confidence: best.confidence };
}

function pickPhoneImuAccel(state: SensorFusionState, now: number): number | null {
  const phone = state.bySource.phone;
  if (!phone || sampleAgeMs(phone, now) > IMU_STALE_MS) return null;
  return longitudinalAccelFromSample(
    phone.sample,
    state.options.sensitivity,
    state.options.noiseFloor,
  );
}

function pickImuTransient(
  state: SensorFusionState,
  now: number,
): { accelMs2: number | null; fromPhone: boolean } {
  const phoneAccel = pickPhoneImuAccel(state, now);
  if (phoneAccel !== null) return { accelMs2: phoneAccel, fromPhone: true };

  const browser = state.bySource["tesla-browser"];
  if (browser && sampleAgeMs(browser, now) <= IMU_STALE_MS) {
    const accel = longitudinalAccelFromSample(
      browser.sample,
      state.options.sensitivity,
      state.options.noiseFloor,
    );
    if (accel !== null) return { accelMs2: accel, fromPhone: false };
  }

  return { accelMs2: null, fromPhone: false };
}

function pickTelemetryBaselineAccel(state: SensorFusionState, now: number): number | null {
  const telemetry = state.bySource["vehicle-telemetry"];
  if (!telemetry || sampleAgeMs(telemetry, now) > TELEMETRY_STALE_MS) return null;
  return longitudinalAccelFromSample(
    telemetry.sample,
    state.options.sensitivity,
    state.options.noiseFloor,
  );
}

function pickPedalPosition(state: SensorFusionState, now: number): number | null {
  const telemetry = state.bySource["vehicle-telemetry"];
  if (!telemetry || sampleAgeMs(telemetry, now) > TELEMETRY_STALE_MS) return null;
  const pedal = telemetry.sample.pedalPosition;
  if (pedal === undefined || !Number.isFinite(pedal)) return null;
  return clamp01(pedal);
}

function inferThrottleFromMotion(
  accelFiltered: number,
  speedKmh: number,
  pedal: number | null,
  transientAccel: number | null = null,
): number {
  const lead =
    transientAccel !== null ? Math.max(accelFiltered, transientAccel * 0.88) : accelFiltered;
  const fromMotion = inferThrottleFromAccel(lead, speedKmh);
  if (pedal === null) return fromMotion;
  return clamp01(pedal * 0.82 + fromMotion * 0.18);
}

function inferThrottleFromAccel(accelFiltered: number, speedKmh: number): number {
  if (accelFiltered <= 0) return 0;
  const fromAccel = clamp01(accelFiltered / 3.4);
  // Tiny road-load only - steady cruise must not look like open throttle.
  const fromSpeed = clamp01(speedKmh / 180) * 0.06;
  return clamp01(fromAccel * 0.9 + fromSpeed);
}

function collectFreshness(state: SensorFusionState, now: number): SourceFreshness {
  const phone = state.bySource.phone;
  const browser = state.bySource["tesla-browser"];
  const telemetry = state.bySource["vehicle-telemetry"];
  return {
    telemetryAgeMs: telemetry ? sampleAgeMs(telemetry, now) : null,
    phoneAgeMs: phone ? sampleAgeMs(phone, now) : null,
    browserAgeMs: browser ? sampleAgeMs(browser, now) : null,
    phoneImuAgeMs:
      phone &&
      longitudinalAccelFromSample(
        phone.sample,
        state.options.sensitivity,
        state.options.noiseFloor,
      ) !== null
        ? sampleAgeMs(phone, now)
        : null,
    browserImuAgeMs:
      browser &&
      longitudinalAccelFromSample(
        browser.sample,
        state.options.sensitivity,
        state.options.noiseFloor,
      ) !== null
        ? sampleAgeMs(browser, now)
        : null,
  };
}

function updateSourceHealth(state: SensorFusionState, now: number): void {
  const phone = state.bySource.phone;
  const browser = state.bySource["tesla-browser"];
  const telemetry = state.bySource["vehicle-telemetry"];

  state.sourceHealth = {
    phone: Boolean(phone && sampleAgeMs(phone, now) <= PHONE_STALE_MS),
    browser: Boolean(browser && sampleAgeMs(browser, now) <= GPS_STALE_MS),
    vehicleTelemetry: Boolean(telemetry && sampleAgeMs(telemetry, now) <= TELEMETRY_STALE_MS),
  };
}

export interface SensorFusionTickInput {
  /** Monotonic clock (performance.now()). */
  now: number;
  dt: number;
}

/**
 * Fuse multi-source motion into VehicleMotionState.
 *
 * Hierarchy:
 * - Vehicle telemetry: accurate speed/accel baseline
 * - Phone IMU: fast transients
 * - Phone GPS: speed fallback
 * - Tesla browser GPS: final speed fallback
 *
 * Slow anchors gently correct fast layers without abrupt jumps.
 */
export function tickSensorFusion(
  state: SensorFusionState,
  input: SensorFusionTickInput,
): VehicleMotionState {
  const { now, dt } = input;
  const dtSafe = Math.min(0.25, Math.max(0.001, dt));

  updateSourceHealth(state, now);

  const freshness = collectFreshness(state, now);
  const fallbackTier = resolveFallbackTier({
    freshness,
    phoneSuspended: state.fallback.phoneSuspended,
    now,
    lastAnySourceAt: state.fallback.lastAnySourceAt,
    telemetryStaleMs: TELEMETRY_STALE_MS,
    phoneStaleMs: PHONE_STALE_MS,
    browserStaleMs: GPS_STALE_MS,
  });

  beginTierTransition(state.fallback, fallbackTier, now, {
    speedMs: state.speedFilteredMs,
    accelMs2: state.accelTransientMs2,
    throttle: state.inferredThrottle,
  });
  tickTierBlend(state.fallback, dtSafe);

  const baseline = pickSpeedBaseline(state, now);
  const imu = pickImuTransient(state, now);
  const phoneImuAccel = pickPhoneImuAccel(state, now);
  const telemetryAccel = pickTelemetryBaselineAccel(state, now);
  const pedal = pickPedalPosition(state, now);
  const telemetryStored = state.bySource["vehicle-telemetry"];
  const telemetryAgeMs = telemetryStored ? sampleAgeMs(telemetryStored, now) : null;
  const phoneStored = state.bySource.phone;
  const phoneSpeedMs =
    phoneStored &&
    isGpsAccuracyOk(phoneStored.sample.accuracy) &&
    sampleAgeMs(phoneStored, now) <= PHONE_STALE_MS
      ? speedFromSample(phoneStored.sample)
      : null;
  const telemetrySpeedMs =
    telemetryStored && telemetryAgeMs !== null && telemetryAgeMs <= TELEMETRY_STALE_MS
      ? speedFromSample(telemetryStored.sample)
      : null;
  const conflictGapMs = speedConflictGapMs(telemetrySpeedMs, phoneSpeedMs);
  const reconnectBlend = isReconnectBlending(state.fallback, now);

  if (baseline.speedMs !== null && baseline.source) {
    noteSourceActivity(state.fallback, now);
    state.primarySource = baseline.source;
  } else if (imu.accelMs2 !== null) {
    noteSourceActivity(state.fallback, now);
  }

  let speedConfidence = baseline.confidence;
  if (state.fallback.activeTier === "hold") {
    speedConfidence = Math.max(0.25, speedConfidence * 0.75);
  } else if (state.fallback.activeTier === "decay") {
    speedConfidence = Math.max(0.12, speedConfidence * 0.5);
  }

  const useLayeredSpeed =
    baseline.speedMs !== null &&
    baseline.source !== null &&
    state.fallback.activeTier !== "hold" &&
    state.fallback.activeTier !== "decay";

  if (useLayeredSpeed && baseline.speedMs !== null && baseline.source !== null) {
    const baselineSpeedMs = baseline.speedMs;
    const baselineSource = baseline.source;
    const baselineTau =
      baselineSource === "vehicle-telemetry"
        ? conflictGapMs > SPEED_CONFLICT_MS
          ? SPEED_BASELINE_TAU
          : 0.12
        : SPEED_BASELINE_TAU;

    state.speedAnchorMs = lowPassToward(state.speedAnchorMs, baselineSpeedMs, dtSafe, baselineTau);

    const layeredCorrection =
      baselineSource === "vehicle-telemetry" &&
      (conflictGapMs > SPEED_CONFLICT_MS ||
        (imu.fromPhone && phoneImuAccel !== null && Math.abs(phoneImuAccel) > 0.08));

    if (layeredCorrection) {
      const layered = fuseSpeedLayers({
        anchorTargetMs: baselineSpeedMs,
        anchorSource: baselineSource,
        currentAnchorMs: state.speedAnchorMs,
        currentFilteredMs: state.speedFilteredMs,
        phoneImuAccelMs2: imu.fromPhone ? phoneImuAccel : null,
        conflictGapMs,
        telemetryAgeMs: baselineSource === "vehicle-telemetry" ? telemetryAgeMs : null,
        dt: dtSafe,
        reconnectBlend,
        tierBlend: state.fallback.tierBlend,
        holdSpeedMs: state.fallback.holdSpeedMs,
      });
      state.speedAnchorMs = layered.anchorMs;
      state.speedFilteredMs = layered.filteredMs;
    } else {
      state.speedFilteredMs = lowPassToward(
        state.speedFilteredMs,
        state.speedAnchorMs,
        dtSafe,
        baselineTau * 0.9,
      );
    }
  } else {
    const candidateSpeedMs =
      state.fallback.activeTier !== "hold" &&
      state.fallback.activeTier !== "decay" &&
      baseline.speedMs !== null
        ? baseline.speedMs
        : null;

    const targetSpeedMs = resolveFallbackSpeed({
      tier: state.fallback.activeTier,
      candidateSpeedMs,
      currentSpeedMs: state.speedFilteredMs,
      holdSpeedMs: state.fallback.holdSpeedMs,
      imuAccelMs2: imu.accelMs2,
      dt: dtSafe,
      tierBlend: state.fallback.tierBlend,
    });

    const speedTau =
      state.fallback.activeTier === "hold" ? SPEED_BASELINE_TAU * 1.35 : SPEED_BASELINE_TAU;

    state.speedAnchorMs = lowPassToward(state.speedAnchorMs, targetSpeedMs, dtSafe, speedTau);
    state.speedFilteredMs = lowPassToward(
      state.speedFilteredMs,
      state.speedAnchorMs,
      dtSafe,
      speedTau * 0.9,
    );
  }

  state.speedHistory.push({ t: now, v: state.speedFilteredMs });
  if (state.speedHistory.length > 24) state.speedHistory.shift();

  const accelLayers = fuseAccelLayers({
    imuAccelMs2: imu.accelMs2,
    telemetryAccelMs2: telemetryAccel,
    currentTransientMs2: state.accelTransientMs2,
    currentAnchorMs2: state.accelAnchorMs2,
    telemetryAgeMs,
    dt: dtSafe,
    reconnectBlend,
    maxSpike: MAX_ACCEL_SPIKE,
  });

  let targetAccel = accelLayers.transientMs2;
  if (imu.accelMs2 === null && telemetryAccel === null) {
    targetAccel = resolveFallbackAccel({
      tier: state.fallback.activeTier,
      imuAccelMs2: null,
      currentAccelMs2: state.accelTransientMs2,
      holdAccelMs2: state.fallback.holdAccelMs2,
      dt: dtSafe,
    });
  }

  state.accelAnchorMs2 = accelLayers.anchorMs2;
  state.accelTransientMs2 = targetAccel;
  state.accelFilteredMs2 = lowPassToward(
    state.accelFilteredMs2,
    state.accelTransientMs2,
    dtSafe,
    state.fallback.activeTier === "hold" || state.fallback.activeTier === "decay"
      ? ACCEL_THROTTLE_TAU * 1.6
      : imu.fromPhone && imu.accelMs2 !== null
        ? ACCEL_THROTTLE_TAU * 0.55
        : ACCEL_THROTTLE_TAU,
  );

  const speedKmh = state.speedFilteredMs * 3.6;
  const phoneImuLive = imu.fromPhone && imu.accelMs2 !== null;
  const throttleAccel = Math.max(
    state.accelFilteredMs2,
    phoneImuLive ? state.accelTransientMs2 * 0.96 : state.accelTransientMs2,
  );
  state.inferredThrottle = inferThrottleFromMotion(
    throttleAccel,
    speedKmh,
    pedal,
    phoneImuLive ? state.accelTransientMs2 : null,
  );

  snapshotHoldValues(state.fallback, {
    speedMs: state.speedFilteredMs,
    accelMs2: state.accelTransientMs2,
    throttle: state.inferredThrottle,
  });

  const imuFresh = imu.accelMs2 !== null;
  const telemetryFresh = state.sourceHealth.vehicleTelemetry;
  const gpsFresh = baseline.speedMs !== null && baseline.confidence > 0.45;
  const baseConfidence = clamp01(
    speedConfidence * 0.52 +
      (telemetryFresh ? 0.32 : 0) +
      (gpsFresh ? 0.12 : 0) +
      (imuFresh ? (telemetryFresh ? 0.14 : 0.1) : 0),
  );
  state.motionConfidence = resolveFallbackConfidence(state.fallback.activeTier, baseConfidence);

  if (!state.initialized && (gpsFresh || imuFresh)) {
    state.initialized = true;
  }

  const decelerationMs2 = Math.max(0, -state.accelFilteredMs2);

  const motion: VehicleMotionState = {
    timestamp: now,
    speedKmh,
    accelerationMs2: state.accelTransientMs2,
    accelerationFiltered: state.accelFilteredMs2,
    decelerationMs2,
    inferredThrottle: state.inferredThrottle,
    motionConfidence: state.motionConfidence,
    primarySource: state.primarySource,
    sourceHealth: { ...state.sourceHealth },
    fallbackTier: state.fallback.activeTier,
    transitioning: state.fallback.tierBlend < 0.98,
  };

  return withFallbackFields(motion, state.fallback);
}

/** Convenience: build a browser GPS MotionSample (coordinates stay local). */
export function browserGpsMotionSample(input: {
  speedMs: number;
  accuracyM?: number | null;
  timestamp?: number;
}): MotionSample {
  return {
    timestamp: input.timestamp ?? Date.now(),
    source: "tesla-browser",
    speedKmh: Math.max(0, input.speedMs * 3.6),
    ...(input.accuracyM != null && Number.isFinite(input.accuracyM)
      ? { accuracy: input.accuracyM }
      : {}),
  };
}

/** Convenience: build a browser IMU MotionSample from DeviceMotion Y axis. */
export function browserImuMotionSample(input: {
  accelMs2: number;
  timestamp?: number;
}): MotionSample {
  return {
    timestamp: input.timestamp ?? Date.now(),
    source: "tesla-browser",
    accelerationLongitudinal: input.accelMs2,
  };
}

/** Normalize relay payload as a phone MotionSample. */
export function phoneRelayMotionSample(sample: MotionSample): MotionSample {
  return { ...sample, source: "phone" };
}

/** Force vehicle-telemetry source on an already-mapped sample. */
export function vehicleTelemetryMotionSample(sample: MotionSample): MotionSample {
  return { ...sample, source: "vehicle-telemetry" };
}

export { IDLE_VEHICLE_MOTION };
