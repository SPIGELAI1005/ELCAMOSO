import { describe, expect, it } from "vitest";
import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { withPersonalityTransmission } from "@/lib/drive/drivetrain-resolve";
import {
  getDrivetrainPersonality,
  personalityLegacyTransmission,
  rpmPerKmhForGear,
} from "@/lib/drive/drivetrain-personalities";
import { getProfile } from "@/lib/sound/profiles";

/** Drive a legacy (non-Dynamic Drive) session at a fixed acceleration and log gear vs speed. */
function simulateLegacy(profileId: string, accelMs2: number, seconds: number) {
  const profile = withPersonalityTransmission(getProfile(profileId));
  const dt = 1 / 30;
  let state: DriveState = IDLE_STATE;
  let speed = 0;
  const upshifts: Array<{ kmh: number; from: number; to: number }> = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    speed += accelMs2 * dt;
    const next = computeDriveState({ speed, acceleration: accelMs2, previous: state, profile, dt });
    if (state.gear >= 1 && next.gear > state.gear) {
      upshifts.push({ kmh: speed * 3.6, from: state.gear, to: next.gear });
    }
    state = next;
  }
  return { upshifts, final: state };
}

describe("legacy fallback gearbox", () => {
  it("derives physical rpm-per-km/h slopes from the real gear set", () => {
    const gt = getDrivetrainPersonality("gt-v8");
    const legacy = personalityLegacyTransmission(gt);
    // 1st gear: 3.4 × 3.55 × 60 / (3.6 × 2.06) ≈ 97.7 rpm per km/h
    expect(legacy.gearRatios[0]).toBeGreaterThan(90);
    expect(legacy.gearRatios[0]).toBeLessThan(135);
    expect(rpmPerKmhForGear(3.4, 3.55, 2.06)).toBeCloseTo(97.7, 0);
    // Slopes strictly decrease with gear number.
    for (let i = 1; i < legacy.gearRatios.length; i++) {
      expect(legacy.gearRatios[i]).toBeLessThan(legacy.gearRatios[i - 1]!);
    }
  });

  it.each(["gt-v8", "american-muscle-v8", "flat-six-sport", "turbo-inline-6", "racing-v10"])(
    "%s upshifts out of 1st below 45 km/h under relaxed acceleration",
    (profileId) => {
      const { upshifts } = simulateLegacy(profileId, 1.2, 40);
      const first = upshifts.find((u) => u.from === 1);
      expect(first).toBeDefined();
      expect(first!.kmh).toBeGreaterThan(12);
      expect(first!.kmh).toBeLessThan(45);
      // At least three upshifts before 130 km/h.
      expect(upshifts.filter((u) => u.kmh < 130).length).toBeGreaterThanOrEqual(3);
    },
  );

  it("holds gears longer under hard acceleration than under light acceleration", () => {
    const light = simulateLegacy("gt-v8", 0.9, 40).upshifts.find((u) => u.from === 1)!;
    const hard = simulateLegacy("gt-v8", 3.2, 20).upshifts.find((u) => u.from === 1)!;
    expect(hard.kmh).toBeGreaterThan(light.kmh + 8);
  });

  it("does not hunt between gears at steady cruise", () => {
    const profile = withPersonalityTransmission(getProfile("gt-v8"));
    const dt = 1 / 30;
    let state: DriveState = IDLE_STATE;
    // Reach 60 km/h, then cruise for 20 s.
    for (let i = 0; i < 300; i++) {
      state = computeDriveState({
        speed: Math.min(60 / 3.6, (i / 300) * (60 / 3.6)),
        acceleration: 1.0,
        previous: state,
        profile,
        dt,
      });
    }
    const gears = new Set<number>();
    for (let i = 0; i < 600; i++) {
      state = computeDriveState({ speed: 60 / 3.6, acceleration: 0, previous: state, profile, dt });
      gears.add(state.gear);
    }
    expect(gears.size).toBeLessThanOrEqual(2);
    expect(state.rpm).toBeGreaterThan(profile.transmission!.idleRpm);
    expect(state.rpm).toBeLessThan(profile.transmission!.redlineRpm * 0.6);
  });

  it("marks the frame of a gear change as shifting", () => {
    const { upshifts } = simulateLegacy("gt-v8", 1.5, 30);
    expect(upshifts.length).toBeGreaterThan(0);
  });
});
