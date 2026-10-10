import { describe, expect, it } from "vitest";
import { createBoostModelState, updateBoostModel } from "@/lib/powertrain/boost";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";

describe("simulated boost model", () => {
  it("builds deterministically and releases only on a genuine load drop", () => {
    const profile = getPowertrainProfile("turbo-inline-6");
    let state = createBoostModelState();
    let nowMs = 0;
    for (let i = 0; i < 100; i += 1) {
      nowMs += 20;
      const result = updateBoostModel({
        state,
        profile,
        rpm: 3600,
        engineLoad: 0.86,
        driverDemand: 0.82,
        dtSec: 0.02,
        nowMs,
        telemetryStable: true,
      });
      state = result.state;
      expect(result.releaseTriggered).toBe(false);
    }
    expect(state.boost).toBeGreaterThan(0.5);

    const release = updateBoostModel({
      state,
      profile,
      rpm: 3500,
      engineLoad: 0.18,
      driverDemand: 0.05,
      dtSec: 0.02,
      nowMs: nowMs + 20,
      telemetryStable: true,
    });
    expect(release.releaseTriggered).toBe(true);

    const repeated = updateBoostModel({
      state: release.state,
      profile,
      rpm: 3400,
      engineLoad: 0.1,
      driverDemand: 0.02,
      dtSec: 0.02,
      nowMs: nowMs + 40,
      telemetryStable: true,
    });
    expect(repeated.releaseTriggered).toBe(false);
  });

  it("does not release while telemetry is stale", () => {
    const profile = getPowertrainProfile("turbo-inline-6");
    const state = {
      boost: 0.8,
      previousLoad: 0.9,
      releaseArmed: true,
      lastReleaseAtMs: -60_000,
    };
    const result = updateBoostModel({
      state,
      profile,
      rpm: 3600,
      engineLoad: 0.1,
      driverDemand: 0,
      dtSec: 0.05,
      nowMs: 10_000,
      telemetryStable: false,
    });
    expect(result.releaseTriggered).toBe(false);
  });

  it("stays zero for naturally aspirated profiles", () => {
    const result = updateBoostModel({
      state: createBoostModelState(),
      profile: getPowertrainProfile("american-v8"),
      rpm: 4000,
      engineLoad: 1,
      driverDemand: 1,
      dtSec: 0.1,
      nowMs: 100,
      telemetryStable: true,
    });
    expect(result.boost).toBe(0);
    expect(result.releaseTriggered).toBe(false);
  });
});
