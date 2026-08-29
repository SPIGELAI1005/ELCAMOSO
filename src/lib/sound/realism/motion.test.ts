import { describe, expect, it } from "vitest";
import type { DriveState } from "@/lib/drive/model";
import { getProfile } from "@/lib/sound/profiles";
import {
  computeSyntheticLoad,
  createMotionTracker,
  motionFromDrive,
} from "@/lib/sound/realism/motion";

function driveState(overrides: Partial<DriveState> = {}): DriveState {
  return {
    speed: 22.2,
    acceleration: 0,
    throttle: 0.12,
    regen: 0,
    rpm: 0,
    gear: 0,
    load: 0.18,
    timestamp: 0,
    jerk: 0,
    isShifting: false,
    speedNormalized: 0.5,
    accelerationNormalized: 0,
    ...overrides,
  };
}

describe("computeSyntheticLoad", () => {
  it("rises with throttle and acceleration at the same speed", () => {
    const tracker = createMotionTracker();
    tracker.speed.slow = 0.5;
    tracker.speed.fast = 0.5;
    tracker.throttle.fast = 0.15;
    tracker.throttle.slow = 0.15;
    tracker.accel.fast = 0.05;
    tracker.accel.slow = 0.05;

    const cruise = computeSyntheticLoad(driveState(), tracker, 0);

    tracker.throttle.fast = 0.85;
    tracker.throttle.slow = 0.85;
    tracker.accel.fast = 0.72;
    tracker.accel.slow = 0.72;

    const wot = computeSyntheticLoad(
      driveState({ acceleration: 2.8, throttle: 0.9, load: 0.82 }),
      tracker,
      0.35,
    );

    expect(wot).toBeGreaterThan(cruise);
  });
});

describe("motionFromDrive", () => {
  it("uses syntheticLoad for continuous profiles so cruise and WOT differ at same speed", () => {
    const profile = getProfile("cyber-pulse");
    const tracker = createMotionTracker();
    let time = 0;

    for (let i = 0; i < 40; i++) {
      motionFromDrive(driveState(), profile, tracker, time);
      time += 1 / 60;
    }

    const cruise = motionFromDrive(driveState(), profile, tracker, time);
    time += 1 / 60;

    for (let i = 0; i < 20; i++) {
      motionFromDrive(
        driveState({ acceleration: 3.1, throttle: 0.92, load: 0.88 }),
        profile,
        tracker,
        time,
      );
      time += 1 / 60;
    }

    const wot = motionFromDrive(
      driveState({ acceleration: 3.1, throttle: 0.92, load: 0.88 }),
      profile,
      tracker,
      time,
    );

    expect(wot.syntheticLoad).toBeGreaterThan(cruise.syntheticLoad);
    expect(wot.bodyLevel).toBeGreaterThan(cruise.bodyLevel);
    expect(wot.rpmNorm).toBeGreaterThan(cruise.rpmNorm);
  });
});
