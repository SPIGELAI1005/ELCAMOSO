import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_FIXTURE_IDS,
  LAB_FIXTURES,
  SPEED_DRIVEN_FIXTURE_IDS,
  fixtureFingerprint,
  getLabFixture,
  materializeFixture,
} from "@/lib/sound/lab/fixtures";

describe("audio lab fixtures", () => {
  it("lists required speed-driven and diagnostic fixtures", () => {
    const ids = LAB_FIXTURES.map((fixture) => fixture.id);
    for (const required of [
      "idle",
      "gentle-0-80",
      "assertive-accel",
      "steady-30",
      "steady-50",
      "steady-80",
      "lift-off",
      "decel-80-0",
      "threshold-hover",
      "gps-loss-recovery",
      "profile-switch",
      "rpm-sweep",
      "load-sweep",
    ]) {
      expect(ids).toContain(required);
    }
    expect(SPEED_DRIVEN_FIXTURE_IDS.length).toBeGreaterThanOrEqual(11);
    expect(DIAGNOSTIC_FIXTURE_IDS).toEqual(["rpm-sweep", "load-sweep"]);
  });

  it("keeps diagnostic fixtures separated from speed-driven kind", () => {
    for (const id of DIAGNOSTIC_FIXTURE_IDS) {
      expect(getLabFixture(id).kind).toBe("rpm-load-diagnostic");
    }
    for (const id of SPEED_DRIVEN_FIXTURE_IDS) {
      expect(getLabFixture(id).kind).toBe("speed-driven");
    }
  });

  it("is deterministic across materializations", () => {
    for (const fixture of LAB_FIXTURES) {
      const a = materializeFixture(fixture);
      const b = materializeFixture(fixture);
      expect(a).toEqual(b);
      expect(fixtureFingerprint(fixture.id)).toBe(fixtureFingerprint(fixture.id));
    }
  });

  it("marks GPS loss without forcing speed to zero in the curve", () => {
    const fixture = getLabFixture("gps-loss-recovery");
    const lost = fixture.sampleAt(5);
    expect(lost.motionConfidence).toBe(0);
    expect(lost.speedKmh).toBe(50);
  });

  it("exposes RPM/load overrides only on diagnostic fixtures", () => {
    const rpm = getLabFixture("rpm-sweep").sampleAt(4);
    expect(rpm.rpmOverride).toBeGreaterThan(800);
    expect(getLabFixture("idle").sampleAt(1).rpmOverride).toBeUndefined();
  });
});
