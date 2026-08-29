import { describe, expect, it } from "vitest";
import { IDLE_STATE } from "@/lib/drive/model";
import { driveStateFromPowertrain } from "@/lib/powertrain/adapters/drive-state";
import { vehicleMotionFromDrive } from "@/lib/powertrain/adapters/vehicle-motion";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";

describe("driveStateFromPowertrain", () => {
  it("maps rpm, gear, load and attaches powertrain overlay", () => {
    const motion = vehicleMotionFromDrive({
      speedMps: 22,
      accelerationMps2: 1.8,
      timestamp: 1000,
      throttle: 0.7,
    });
    const pt = {
      ...IDLE_POWERTRAIN,
      timestamp: 1000,
      rpm: 5200,
      normalizedRpm: 0.65,
      gear: 4,
      load: 0.72,
      throttle: 0.68,
      shifting: true,
      shiftDirection: "up" as const,
      shiftProgress: 0.4,
    };
    const state = driveStateFromPowertrain(pt, motion, IDLE_STATE);
    expect(state.rpm).toBe(5200);
    expect(state.gear).toBe(4);
    expect(state.isShifting).toBe(true);
    expect(state.powertrain).toBe(pt);
    expect(state.load).toBeLessThan(0.72);
  });
});
