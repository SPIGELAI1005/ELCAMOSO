/** Where a motion sample originated. */
export type SensorSource = "tesla-browser" | "phone" | "vehicle-telemetry" | "simulator";

/** Raw or normalized sensor reading (future fusion ingress). */
export interface MotionSample {
  timestamp: number;
  source: SensorSource;

  speedKmh?: number;
  accelerationLongitudinal?: number;
  accelerationLateral?: number;

  latitude?: number;
  longitude?: number;

  heading?: number;
  accuracy?: number;

  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;

  /** Normalized accelerator demand 0..1 when provided by vehicle telemetry. */
  pedalPosition?: number;
  /** Drive-unit axle speed in RPM when provided by vehicle telemetry. */
  motorAxleSpeedRpm?: number;
  /** Operating gear / shift state from vehicle telemetry (e.g. D, P, R, N). */
  vehicleOperatingState?: string;
}

/** Fused vehicle motion - input to the virtual powertrain. */
export interface VehicleMotionState {
  timestamp: number;

  speedKmh: number;
  /** m/s², positive = accelerating forward */
  accelerationMs2: number;
  accelerationFiltered: number;

  decelerationMs2: number;

  /** 0..1 inferred driver demand */
  inferredThrottle: number;

  /** 0..1 trust in current motion estimate */
  motionConfidence: number;

  primarySource: SensorSource;

  sourceHealth: {
    phone: boolean;
    browser: boolean;
    vehicleTelemetry: boolean;
  };

  /** Active fallback tier after fusion resilience pass. */
  fallbackTier: MotionFallbackTier;

  /** True while crossfading tiers or RPM reconnect blend is active. */
  transitioning: boolean;
}

/** Preferred motion input tier (telemetry → phone → browser → hold → decay). */
export type MotionFallbackTier = "vehicle-telemetry" | "phone" | "browser" | "hold" | "decay";

export const IDLE_VEHICLE_MOTION: VehicleMotionState = {
  timestamp: 0,
  speedKmh: 0,
  accelerationMs2: 0,
  accelerationFiltered: 0,
  decelerationMs2: 0,
  inferredThrottle: 0,
  motionConfidence: 1,
  primarySource: "simulator",
  sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
  fallbackTier: "decay",
  transitioning: false,
};
