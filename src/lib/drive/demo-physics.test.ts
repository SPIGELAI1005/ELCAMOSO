import { describe, expect, it } from "vitest";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { powertrainProfileForSound } from "@/lib/powertrain/adapters/profile-map";
import { vehicleMotionFromDrive } from "@/lib/powertrain/adapters/vehicle-motion";
import {
  applyDemoDriveOverrides,
  tickDemoSpeed,
  type DemoControls,
} from "@/lib/drive/demo-physics";
import { computeDriveState, IDLE_STATE } from "@/lib/drive/model";
import { getProfile } from "@/lib/sound/profiles";

const demo: DemoControls = { throttle: 0.5, accel: 0.5, regen: 0, selector: "D" };

describe("demo physics", () => {
  it("accelerates under throttle in D", () => {
    const first = tickDemoSpeed(0, 0.1, demo);
    expect(first.speedMs).toBeGreaterThan(0);
    expect(first.accelerationMs2).toBeGreaterThan(0);
  });

  it("bleeds speed in P without throttle", () => {
    const moving = tickDemoSpeed(5, 0.1, { ...demo, throttle: 0, selector: "P" });
    expect(moving.speedMs).toBeLessThan(5);
  });

  it("applies legacy PRND overrides to drive state", () => {
    const profile = getProfile("flat-six-sport");
    const next = computeDriveState({
      speed: 8,
      acceleration: 0,
      previous: IDLE_STATE,
      profile,
      dt: 1 / 60,
    });
    applyDemoDriveOverrides(next, {
      demo: { ...demo, selector: "N", throttle: 0.8 },
      speedMs: 8,
      profile,
      dynamicDriveActive: false,
    });
    expect(next.gear).toBe(0);
    expect(next.rpm).toBeGreaterThan(profile.transmission!.idleRpm);
  });

  it("demo hold reaches multiple gears through powertrain simulation", () => {
    const profile = getProfile("gt-v8");
    const sim = new PowertrainSimulator({ profile: powertrainProfileForSound(profile) });
    const hold: DemoControls = { throttle: 0.92, accel: 0.85, regen: 0, selector: "D" };
    let speed = 0;
    const gears: number[] = [];

    for (let i = 0; i < 720; i++) {
      const dt = 1 / 60;
      const tick = tickDemoSpeed(speed, dt, hold);
      speed = tick.speedMs;
      const motion = vehicleMotionFromDrive({
        speedMps: speed,
        accelerationMps2: tick.accelerationMs2,
        timestamp: i,
        throttle: hold.throttle,
        regen: 0,
        source: "simulator",
      });
      const pt = sim.tick(motion, dt, { directThrottle: hold.throttle, braking: 0 });
      gears.push(pt.gear);
    }

    expect(Math.max(...gears)).toBeGreaterThanOrEqual(2);
    expect(gears.some((gear, i) => i > 0 && gear > gears[i - 1]!)).toBe(true);
  });

  it("does not flatten drive RPM with legacy demo overrides", () => {
    const profile = getProfile("gt-v8");
    const hold: DemoControls = { throttle: 0.92, accel: 0.85, regen: 0, selector: "D" };
    const base = computeDriveState({
      speed: 22,
      acceleration: 1.8,
      previous: { ...IDLE_STATE, gear: 2, rpm: 3200 },
      profile,
      dt: 1 / 60,
    });
    const overridden = { ...base };
    applyDemoDriveOverrides(overridden, {
      demo: hold,
      speedMs: 22,
      profile,
      dynamicDriveActive: false,
    });
    expect(overridden.rpm).toBe(base.rpm);
  });
});
