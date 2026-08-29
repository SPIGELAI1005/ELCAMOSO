import type { VehicleMotionState } from "@/lib/motion/types";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Build fused motion input for the powertrain simulator from drive session telemetry. */
export function vehicleMotionFromDrive(input: {
  speedMps: number;
  accelerationMps2: number;
  timestamp: number;
  throttle?: number;
  regen?: number;
  source?: VehicleMotionState["primarySource"];
}): VehicleMotionState {
  const speedKmh = Math.max(0, input.speedMps * 3.6);
  const accel = Number.isFinite(input.accelerationMps2) ? input.accelerationMps2 : 0;
  const decel = Math.max(0, -accel);
  const pedal = input.throttle ?? clamp01(accel / 3.5 + speedKmh / 180);
  const inferredFromPedal = clamp01(pedal * (1 - (input.regen ?? 0) * 0.85));
  const inferredFromAccel = clamp01(accel / 3.5);

  return {
    ...IDLE_VEHICLE_MOTION,
    timestamp: input.timestamp,
    speedKmh,
    accelerationMs2: accel,
    accelerationFiltered: accel,
    decelerationMs2: decel,
    inferredThrottle: clamp01(inferredFromPedal * 0.65 + inferredFromAccel * 0.35),
    motionConfidence: 1,
    primarySource: input.source ?? "phone",
    sourceHealth: {
      phone: input.source !== "simulator",
      browser: input.source === "tesla-browser",
      vehicleTelemetry: input.source === "vehicle-telemetry",
    },
    fallbackTier:
      input.source === "vehicle-telemetry"
        ? "vehicle-telemetry"
        : input.source === "phone"
          ? "phone"
          : input.source === "tesla-browser"
            ? "browser"
            : "decay",
    transitioning: false,
  };
}
