/**
 * Fusion → powertrain scenarios with realistic multi-source sensor feeds.
 * Validates VehicleMotionState before it reaches the virtual drivetrain.
 */
import {
  browserGpsMotionSample,
  browserImuMotionSample,
  createSensorFusion,
  phoneRelayMotionSample,
  pushMotionSample,
  tickSensorFusion,
} from "@/lib/motion/sensor-fusion";
import type { MotionFallbackTier } from "@/lib/motion/types";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";

const DT = 0.016;

export interface FusionDriveSample {
  tMs: number;
  speedKmh: number;
  accelMs2: number;
  rpm: number;
  gear: number;
  fallbackTier: MotionFallbackTier;
  motionConfidence: number;
}

export interface FusionDriveResult {
  id: string;
  label: string;
  samples: FusionDriveSample[];
  maxSpeedJumpKmh: number;
  maxRpmJump: number;
  maxAccelMs2: number;
}

function maxDelta(values: number[]): number {
  let max = 0;
  for (let i = 1; i < values.length; i += 1) {
    max = Math.max(max, Math.abs(values[i]! - values[i - 1]!));
  }
  return max;
}

function runFusionDrive(
  id: string,
  label: string,
  frames: number,
  step: (frame: number, now: number, fusion: ReturnType<typeof createSensorFusion>) => void,
  profileId = "flat-six-sport",
): FusionDriveResult {
  const fusion = createSensorFusion({ sensitivity: 1, noiseFloor: 0.05 });
  const sim = new PowertrainSimulator({ profileId });
  const samples: FusionDriveSample[] = [];
  const speeds: number[] = [];
  const rpms: number[] = [];
  const accels: number[] = [];

  for (let i = 0; i < frames; i += 1) {
    const now = (i + 1) * DT * 1000;
    step(i, now, fusion);
    const motion = tickSensorFusion(fusion, { now, dt: DT });
    const pt = sim.tick(motion, DT);
    samples.push({
      tMs: now,
      speedKmh: motion.speedKmh,
      accelMs2: motion.accelerationMs2,
      rpm: pt.rpm,
      gear: pt.gear,
      fallbackTier: motion.fallbackTier,
      motionConfidence: motion.motionConfidence,
    });
    speeds.push(motion.speedKmh);
    rpms.push(pt.rpm);
    accels.push(Math.abs(motion.accelerationMs2));
  }

  return {
    id,
    label,
    samples,
    maxSpeedJumpKmh: maxDelta(speeds),
    maxRpmJump: maxDelta(rpms),
    maxAccelMs2: Math.max(...accels, 0),
  };
}

/** Scenario H: phone IMU leads; GPS speed ramps ~1 s later (hard tip-in). */
export function runImuLeadHardTipInScenario(profileId = "flat-six-sport"): FusionDriveResult {
  return runFusionDrive(
    "fusion-h",
    "IMU leads hard tip-in before GPS catches up",
    400,
    (i, now, fusion) => {
      const tipStart = 80;
      const gpsLagFrames = 60;
      const imuAccel = i >= tipStart && i < tipStart + 45 ? 3.2 : 0.15;
      const gpsSpeedMs =
        i < tipStart ? 12 : Math.min(22, 12 + Math.max(0, i - tipStart - gpsLagFrames) * 0.06);

      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: gpsSpeedMs * 3.6,
          accelerationLongitudinal: imuAccel,
          accuracy: 10,
        }),
        now,
      );
    },
    profileId,
  );
}

/** Scenario I: city stop-go - GPS baseline + IMU transients, no RPM snap from spikes. */
export function runCityStopGoFusionScenario(profileId = "american-v8"): FusionDriveResult {
  return runFusionDrive(
    "fusion-i",
    "City stop-go with phone GPS + IMU",
    520,
    (i, now, fusion) => {
      const cycle = i % 160;
      const accelerating = cycle < 70;
      const cruising = cycle >= 70 && cycle < 110;
      const braking = cycle >= 110;

      let speedMs = 4;
      let accel = 0.1;
      if (accelerating) {
        speedMs = 4 + cycle * 0.11;
        accel = 2.1;
      } else if (cruising) {
        speedMs = 12;
        accel = 0.05;
      } else {
        speedMs = Math.max(0, 12 - (cycle - 110) * 0.14);
        accel = speedMs > 0.5 ? -1.8 : 0;
      }

      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: speedMs * 3.6,
          accelerationLongitudinal: accel,
          accuracy: cycle % 40 === 0 ? 28 : 9,
        }),
        now,
      );
    },
    profileId,
  );
}

/** Scenario J: Tesla browser only - GPS speed + browser IMU, no phone relay. */
export function runTeslaBrowserOnlyScenario(profileId = "gt-v8"): FusionDriveResult {
  return runFusionDrive(
    "fusion-j",
    "Tesla browser GPS + DeviceMotion only",
    360,
    (i, now, fusion) => {
      const speedMs = Math.min(28, 8 + i * 0.05);
      pushMotionSample(
        fusion,
        browserGpsMotionSample({ speedMs, accuracyM: 14, timestamp: Date.now() }),
        now,
      );
      pushMotionSample(
        fusion,
        browserImuMotionSample({ accelMs2: i < 220 ? 2.2 : 0.15, timestamp: Date.now() }),
        now,
      );
    },
    profileId,
  );
}

/** Scenario K: conflicting phone vs browser GPS - telemetry-free, phone wins. */
export function runPhoneOverBrowserGpsScenario(): FusionDriveResult {
  return runFusionDrive(
    "fusion-k",
    "Phone GPS preferred over Tesla browser GPS",
    200,
    (i, now, fusion) => {
      pushMotionSample(
        fusion,
        browserGpsMotionSample({ speedMs: 8, accuracyM: 10, timestamp: Date.now() }),
        now,
      );
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 72,
          accelerationLongitudinal: 0.4,
          accuracy: 8,
        }),
        now,
      );
    },
  );
}
