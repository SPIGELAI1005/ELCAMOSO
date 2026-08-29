import { describe, expect, it } from "vitest";
import {
  POWERTRAIN_PROFILES,
  PowertrainSimulationSession,
  getPowertrainProfile,
  rpmAfterUpshift,
  rpmFromSpeedAndGear,
} from "@/lib/powertrain/domain";

describe("PowertrainSimulationSession", () => {
  it("ticks all built-in profiles from developer controls", () => {
    for (const profile of POWERTRAIN_PROFILES) {
      const session = new PowertrainSimulationSession(profile);
      const result = session.tick(
        { speedKmh: 55, accelerationMs2: 1.8, throttle: 0.65, braking: 0 },
        0.016,
        false,
      );

      expect(result.powertrain.rpm).toBeGreaterThan(0);
      expect(result.powertrain.gear).toBeGreaterThanOrEqual(0);
      expect(result.motion.primarySource).toBe("simulator");
    }
  });

  it("produces higher load under WOT than cruise at same speed", () => {
    const session = new PowertrainSimulationSession("american-v8");

    for (let i = 0; i < 80; i++) {
      session.tick({ speedKmh: 90, accelerationMs2: 0.1, throttle: 0.2, braking: 0 }, 0.016, false);
    }
    const cruise = session.tick(
      { speedKmh: 90, accelerationMs2: 0.1, throttle: 0.2, braking: 0 },
      0.016,
      false,
    );

    for (let i = 0; i < 40; i++) {
      session.tick({ speedKmh: 90, accelerationMs2: 3, throttle: 0.95, braking: 0 }, 0.016, false);
    }
    const wot = session.tick(
      { speedKmh: 90, accelerationMs2: 3, throttle: 0.95, braking: 0 },
      0.016,
      false,
    );

    expect(wot.powertrain.load).toBeGreaterThan(cruise.powertrain.load);
    expect(wot.powertrain.throttle).toBeGreaterThan(cruise.powertrain.throttle);
  });

  it("upshift drops RPM for the same road speed (physics check)", () => {
    const profile = getPowertrainProfile("flat-six-sport");
    const speedKmh = 80;
    const rpmG2 = rpmFromSpeedAndGear(speedKmh, 2, profile);
    const rpmG3 = rpmFromSpeedAndGear(speedKmh, 3, profile);
    expect(rpmG3).toBeLessThan(rpmG2);

    const drop = rpmAfterUpshift(speedKmh, 2, 3, profile);
    expect(drop.after).toBeLessThan(drop.before);
    expect(drop.after).toBeCloseTo(rpmG3, -1);
  });

  it("american-v8 and synthetic-ev differ in gear count and redline", () => {
    const v8 = getPowertrainProfile("american-v8");
    const ev = getPowertrainProfile("synthetic-ev");
    expect(v8.transmission.gears).not.toBe(ev.transmission.gears);
    expect(ev.engine.redlineRpm).toBeGreaterThan(v8.engine.redlineRpm);
  });

  it("rev-match activates on downshift for profiles that enable it", () => {
    const session = new PowertrainSimulationSession("gt-v8");
    let sawRevMatch = false;

    for (let i = 0; i < 400; i++) {
      const throttle = i < 120 ? 0.85 : 0.15;
      const braking = i > 200 ? 0.4 : 0;
      const speed = Math.max(25, 110 - i * 0.22);
      const { powertrain } = session.tick(
        { speedKmh: speed, accelerationMs2: -1.2, throttle, braking },
        0.016,
        false,
      );
      if (powertrain.revMatchActive) sawRevMatch = true;
    }

    expect(sawRevMatch).toBe(true);
  });
});
