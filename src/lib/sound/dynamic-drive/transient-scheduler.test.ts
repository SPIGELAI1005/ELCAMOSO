import { describe, expect, it } from "vitest";
import { getDrivetrainPersonality } from "@/lib/drive/drivetrain-personalities";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { getProfile } from "@/lib/sound/profiles";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import {
  createTransientSchedulerState,
  resolveVariantPools,
  tickTransientScheduler,
} from "@/lib/sound/dynamic-drive/transient-scheduler";

function basePt(overrides: Partial<typeof IDLE_POWERTRAIN> = {}) {
  return {
    ...IDLE_POWERTRAIN,
    timestamp: 1000,
    rpm: 4200,
    normalizedRpm: 0.62,
    load: 0.55,
    gear: 4,
    throttle: 0.4,
    ...overrides,
  };
}

describe("tickTransientScheduler", () => {
  it("exposes per-personality variant pools from configuration", () => {
    expect(
      resolveVariantPools(getDrivetrainPersonality("american-v8").transient).overrun,
    ).toHaveLength(3);
    expect(
      resolveVariantPools(getDrivetrainPersonality("turbo-inline-6").transient).turboFlutter,
    ).toHaveLength(3);
    expect(
      resolveVariantPools(getDrivetrainPersonality("turbo-inline-6").transient).wastegate,
    ).toHaveLength(3);
    expect(
      resolveVariantPools(getDrivetrainPersonality("motorcycle-inline-4").transient).upshift[0]?.id,
    ).toMatch(/^bike-/);
  });

  it("does not schedule turbo flutter on naturally aspirated profiles", () => {
    const drivetrain = resolveDrivetrain(getProfile("gt-v8"));
    expect(drivetrain.transient.aspiration).toBe("na");

    const state = createTransientSchedulerState(0.11);
    const pt = basePt({ load: 0.7, throttle: 0.15, normalizedRpm: 0.7 });
    const prev = basePt({ load: 0.7, throttle: 0.35, normalizedRpm: 0.7 });

    const { output } = tickTransientScheduler({
      pt,
      prevPt: prev,
      drivetrain,
      speedKmh: 80,
      state,
      nowMs: 2000,
    });

    expect(output.layers["dd-turbo-flutter"]).toBeUndefined();
    expect(output.layers["dd-wastegate"]).toBeUndefined();
  });

  it("can schedule turbo flutter on turbo profiles when load and rpm qualify", () => {
    const drivetrain = resolveDrivetrain(getProfile("rally-car"));
    drivetrain.transient.scheduler = {
      turboFlutter: { probability: 1, cooldownMs: 0, minLoad: 0.4, minRpmNorm: 0.4 },
    };
    const state = createTransientSchedulerState(0.02);

    const pt = basePt({ load: 0.72, throttle: 0.22, normalizedRpm: 0.68 });
    const prev = basePt({ load: 0.72, throttle: 0.38, normalizedRpm: 0.68 });

    const tick = tickTransientScheduler({
      pt,
      prevPt: prev,
      drivetrain,
      speedKmh: 90,
      state,
      nowMs: 5000,
    });

    expect(tick.output.layers["dd-turbo-flutter"]).toBeGreaterThan(0);
  });

  it("respects cooldown so exhaust pops do not fire on every lift", () => {
    const drivetrain = resolveDrivetrain(getProfile("american-muscle-v8"));
    const state = createTransientSchedulerState(0.05);
    let popCount = 0;

    for (let lift = 0; lift < 8; lift++) {
      const nowMs = 1000 + lift * 400;
      const prev = basePt({ throttle: 0.55, overrun: false });
      const pt = basePt({ throttle: 0.05, overrun: true });
      const tick = tickTransientScheduler({
        pt,
        prevPt: prev,
        drivetrain,
        speedKmh: 70,
        state,
        nowMs,
      });
      state.lastFiredAt = tick.state.lastFiredAt;
      state.rng = tick.state.rng;
      state.active = tick.state.active;
      if (tick.output.layers["dd-exhaust-pop"]) popCount++;
    }

    expect(popCount).toBeLessThan(8);
  });

  it("blocks aggressive rev-match during tiny speed corrections", () => {
    const drivetrain = resolveDrivetrain(getProfile("flat-six-sport"));
    const state = createTransientSchedulerState(0.01);

    const tick = tickTransientScheduler({
      pt: basePt({
        revMatchActive: true,
        revMatchProgress: 0.35,
        throttle: 0.12,
        load: 0.4,
      }),
      prevPt: basePt({ revMatchActive: true, revMatchProgress: 0.1, throttle: 0.12 }),
      drivetrain,
      speedKmh: 18,
      state,
      nowMs: 3000,
    });

    expect(tick.output.layers["dd-rev-match"]).toBeUndefined();
  });

  it("blocks rev-match when speed delta is tiny without a real downshift", () => {
    const drivetrain = resolveDrivetrain(getProfile("flat-six-sport"));
    drivetrain.transient.scheduler = {
      revMatch: { probability: 1, cooldownMs: 0, minSpeedDeltaKmh: 9 },
    };
    const state = createTransientSchedulerState(0.01);

    const tick = tickTransientScheduler({
      pt: basePt({
        revMatchActive: true,
        revMatchProgress: 0.35,
        throttle: 0.35,
        load: 0.5,
        shifting: false,
        gear: 4,
        targetGear: 4,
      }),
      prevPt: basePt({
        revMatchActive: true,
        revMatchProgress: 0.1,
        throttle: 0.35,
        load: 0.5,
        gear: 4,
        targetGear: 4,
      }),
      drivetrain,
      speedKmh: 52,
      prevSpeedKmh: 51,
      state,
      nowMs: 4000,
    });

    expect(tick.output.layers["dd-rev-match"]).toBeUndefined();
  });

  it("allows rev-match on meaningful downshifts even with small speed delta", () => {
    const drivetrain = resolveDrivetrain(getProfile("flat-six-sport"));
    drivetrain.transient.scheduler = {
      revMatch: { probability: 1, cooldownMs: 0, minSpeedDeltaKmh: 9 },
    };
    const state = createTransientSchedulerState(0.01);

    const tick = tickTransientScheduler({
      pt: basePt({
        revMatchActive: true,
        revMatchProgress: 0.35,
        throttle: 0.35,
        load: 0.5,
        shifting: true,
        shiftDirection: "down",
        gear: 4,
        targetGear: 3,
      }),
      prevPt: basePt({
        revMatchActive: true,
        revMatchProgress: 0.1,
        throttle: 0.35,
        load: 0.5,
        gear: 4,
        targetGear: 4,
      }),
      drivetrain,
      speedKmh: 52,
      prevSpeedKmh: 51,
      state,
      nowMs: 5000,
    });

    expect(tick.output.layers["dd-rev-match"]).toBeGreaterThan(0);
  });

  it("does not schedule exhaust pop at low speed or shallow lift-off", () => {
    const drivetrain = resolveDrivetrain(getProfile("american-muscle-v8"));
    drivetrain.transient.scheduler = {
      exhaustPop: { probability: 1, cooldownMs: 0 },
    };
    const state = createTransientSchedulerState(0.01);

    const lowSpeed = tickTransientScheduler({
      pt: basePt({ throttle: 0.05, overrun: true }),
      prevPt: basePt({ throttle: 0.55, overrun: false }),
      drivetrain,
      speedKmh: 28,
      state: createTransientSchedulerState(0.01),
      nowMs: 6000,
    });
    expect(lowSpeed.output.layers["dd-exhaust-pop"]).toBeUndefined();

    const shallowLift = tickTransientScheduler({
      pt: basePt({ throttle: 0.42, overrun: true }),
      prevPt: basePt({ throttle: 0.48, overrun: false }),
      drivetrain,
      speedKmh: 70,
      state: createTransientSchedulerState(0.02),
      nowMs: 7000,
    });
    expect(shallowLift.output.layers["dd-exhaust-pop"]).toBeUndefined();
  });

  it("varies transient intensity across seeds for repeatability with emotion", () => {
    const drivetrain = resolveDrivetrain(getProfile("gt-v8"));
    drivetrain.transient.scheduler = {
      upshift: { probability: 1, cooldownMs: 0, minLoad: 0.2 },
    };
    const peaks = new Set<number>();

    for (let seed = 0; seed < 10; seed++) {
      const state = createTransientSchedulerState(seed * 0.053);
      const tick = tickTransientScheduler({
        pt: basePt({
          shifting: true,
          shiftDirection: "up",
          shiftProgress: 0.02,
          load: 0.6,
        }),
        prevPt: basePt({ shifting: true, shiftDirection: "up", shiftProgress: 0.6, load: 0.6 }),
        drivetrain,
        speedKmh: 60,
        state,
        nowMs: 8000 + seed * 800,
      });
      const peak = tick.output.layers["dd-upshift"];
      if (peak !== undefined) peaks.add(Math.round(peak * 100));
    }

    expect(peaks.size).toBeGreaterThan(1);
  });

  it("picks among multiple upshift variants", () => {
    const drivetrain = resolveDrivetrain(getProfile("gt-v8"));
    drivetrain.transient.scheduler = {
      upshift: { probability: 1, cooldownMs: 0, minLoad: 0.2 },
    };
    const variants = new Set<string>();

    for (let seed = 0; seed < 12; seed++) {
      const state = createTransientSchedulerState(seed * 0.037);
      const tick = tickTransientScheduler({
        pt: basePt({
          shifting: true,
          shiftDirection: "up",
          shiftProgress: 0.02,
          load: 0.6,
        }),
        prevPt: basePt({ shifting: true, shiftDirection: "up", shiftProgress: 0.6, load: 0.6 }),
        drivetrain,
        speedKmh: 60,
        state,
        nowMs: 4000 + seed * 700,
      });
      const variant = tick.output.variants["dd-upshift"]?.id;
      if (variant) variants.add(variant);
    }

    expect(variants.size).toBeGreaterThan(1);
  });

  it("does not schedule exhaust pop or turbo events on electric profiles", () => {
    const drivetrain = resolveDrivetrain(getProfile("electric-hypercar"));
    const state = createTransientSchedulerState(0.01);

    const tick = tickTransientScheduler({
      pt: basePt({ throttle: 0.02, overrun: true }),
      prevPt: basePt({ throttle: 0.6, overrun: false }),
      drivetrain,
      speedKmh: 50,
      state,
      nowMs: 5000,
    });

    expect(tick.output.layers["dd-exhaust-pop"]).toBeUndefined();
    expect(tick.output.layers["dd-turbo-flutter"]).toBeUndefined();
    expect(tick.output.layers["dd-wastegate"]).toBeUndefined();
  });
});
