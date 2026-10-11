import type { VehicleMotionState } from "@/lib/motion/types";
import type { SpeedFreshness, VirtualPowertrainState } from "@/lib/powertrain/types";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";

export function speedFreshnessFromMotion(motion: VehicleMotionState): SpeedFreshness {
  if (motion.fallbackTier === "hold") return "hold";
  if (motion.fallbackTier === "decay") return "decay";
  if (motion.transitioning) return "uncertain";
  if (motion.motionConfidence < 0.35) return "stale";
  if (
    motion.fallbackTier === "vehicle-telemetry" ||
    motion.fallbackTier === "phone" ||
    motion.fallbackTier === "browser"
  ) {
    return "live";
  }
  return motion.primarySource === "simulator" ? "live" : "uncertain";
}

/**
 * Authoritative drivetrain frame for continuous / gearless Sound Profiles.
 * Never invents gears, combustion shift accents, or synthetic RPM.
 */
export function gearlessDrivetrainState(
  motion: VehicleMotionState,
  opts?: { estimatedLoad?: number; driverDemand?: number },
): VirtualPowertrainState {
  const freshness = speedFreshnessFromMotion(motion);
  const demand = opts?.driverDemand ?? motion.inferredThrottle ?? 0;
  const load = opts?.estimatedLoad ?? Math.min(1, Math.max(0, demand * 0.7 + Math.max(0, motion.accelerationFiltered) / 4));
  return {
    ...IDLE_POWERTRAIN,
    timestamp: motion.timestamp || 0,
    engineRunning: false,
    speedKmh: Math.max(0, motion.speedKmh),
    speedSource: motion.primarySource,
    speedFreshness: freshness,
    rpm: 0,
    mechanicalRpm: 0,
    normalizedRpm: 0,
    gear: 0,
    targetGear: 0,
    queuedTargetGear: 0,
    driverDemand: demand,
    engineLoad: load,
    estimatedLoad: load,
    throttle: demand,
    load,
    shifting: false,
    shiftPhase: "idle",
    operatingRegime: "steady",
    lastShiftEvent: null,
    shiftEvent: null,
    drivingMode: motion.speedKmh < 1.5 ? "idle" : "cruise",
    diagnostics: {
      powertrainBackend: "gearless",
      displaySpeedKmh: Math.max(0, motion.speedKmh),
      mechanicalSpeedKmh: Math.max(0, motion.speedKmh),
      rawSpeedKmh: Math.max(0, motion.speedKmh),
      shiftDecisionSpeedKmh: Math.max(0, motion.speedKmh),
      braking: Math.max(0, motion.decelerationMs2 / 4),
      motionSource: motion.primarySource,
      fallbackTier: motion.fallbackTier,
      speedFreshness: freshness,
      sourceChanged: false,
      shiftMapPreset: "none",
      accelerationFilteredMs2: motion.accelerationFiltered,
      effectiveDtMs: 16,
    },
  };
}
