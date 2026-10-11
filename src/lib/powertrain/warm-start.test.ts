import { describe, expect, it } from "vitest";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";

describe("PowertrainSimulator.warmStartAtSpeed", () => {
  it("maps current speed into a legal gear/RPM without inventing a shift event", () => {
    const profile = getPowertrainProfile("flat-six-sport");
    const sim = new PowertrainSimulator({ profile, shiftMapPreset: "city" });
    sim.warmStartAtSpeed(72, 0.35);
    const internals = sim.getInternals();
    expect(internals.gear).toBeGreaterThanOrEqual(1);
    expect(internals.lastShiftEvent).toBeNull();
    expect(internals.operatingRegime).toBe("steady");
    const expected = rpmFromSpeedAndGear(72, internals.gear, profile);
    expect(internals.rpm).toBeCloseTo(expected, 0);
    expect(internals.rpm).toBeLessThanOrEqual(profile.engine.redlineRpm);
  });

  it("idles without fictitious gears when nearly stopped", () => {
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    sim.warmStartAtSpeed(0.4, 0);
    const internals = sim.getInternals();
    expect(internals.gear).toBe(0);
    expect(internals.rpm).toBeGreaterThan(0);
  });
});
