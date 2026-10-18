import { describe, expect, it } from "vitest";
import { IDLE_STATE } from "@/lib/drive/model";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { ESTIMATED_ACCEL_PROFILE_IDS } from "@/lib/sound/realism/motion";
import { worldDriveState } from "@/lib/worlds/world-synth";

describe("GPS acceleration estimate gating", () => {
  it("is never used by gear-based profiles", () => {
    for (const p of SOUND_PROFILES) {
      if (p.drivetrainMode === "virtual-transmission") expect(ESTIMATED_ACCEL_PROFILE_IDS.has(p.id)).toBe(false);
    }
  });
  it("feeds worlds the estimate (and decel as regen) only when nothing is measured", () => {
    const est = worldDriveState({ ...IDLE_STATE, speed: 20, accelerationEstimated: -2.1 });
    expect(est.acceleration).toBe(-2.1);
    expect(est.regen).toBeCloseTo(0.5, 5);
    const measured = { ...IDLE_STATE, speed: 20, acceleration: 1.2, accelerationEstimated: -2 };
    expect(worldDriveState(measured)).toBe(measured);
    const legacy = { ...IDLE_STATE, speed: 20 };
    expect(worldDriveState(legacy)).toBe(legacy);
  });
});
