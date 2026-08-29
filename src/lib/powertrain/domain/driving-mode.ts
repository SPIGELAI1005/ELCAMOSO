import type { DrivingMode } from "@/lib/powertrain/types";

/** Classify high-level driving context from powertrain + motion inputs. */
export function resolveDrivingMode(input: {
  speedKmh: number;
  throttle: number;
  accel: number;
  shifting: boolean;
  overrun: boolean;
  gear: number;
}): DrivingMode {
  if (input.shifting) return "shift";
  if (input.overrun) return "overrun";
  if (input.gear === 0 && input.speedKmh < 2 && input.throttle < 0.08) return "idle";
  if (input.accel > 2.4 && input.throttle > 0.65) return "hard-acceleration";
  if (input.accel > 0.45 && input.throttle > 0.2) return "acceleration";
  if (input.accel < -0.35 || (input.throttle < 0.12 && input.speedKmh > 10)) return "deceleration";
  return "cruise";
}
