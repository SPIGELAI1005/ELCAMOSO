import { describe, expect, it } from "vitest";
import { createOverrunState, updateOverrun } from "@/lib/powertrain/overrun";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";

const base = getPowertrainProfile("american-v8");
const profile = {
  ...base,
  overrun: { ...base.overrun, probability: 1 },
};

describe("updateOverrun", () => {
  it("triggers on lift-off after loaded throttle", () => {
    const r = updateOverrun({
      throttle: 0.1,
      previousThrottle: 0.7,
      accelerationFiltered: 0.05,
      speedKmh: 80,
      now: 5_000,
      profile,
      state: createOverrunState(),
    });
    expect(r.overrun).toBe(true);
  });

  it("respects cooldown - no repeated pop spam", () => {
    const first = updateOverrun({
      throttle: 0.05,
      previousThrottle: 0.75,
      accelerationFiltered: 0.02,
      speedKmh: 90,
      now: 1_000,
      profile,
      state: createOverrunState(),
    });
    const duringPulse = updateOverrun({
      throttle: 0.05,
      previousThrottle: 0.75,
      accelerationFiltered: 0.02,
      speedKmh: 90,
      now: 1_200,
      profile,
      state: first.state,
    });
    const afterPulse = updateOverrun({
      throttle: 0.05,
      previousThrottle: 0.75,
      accelerationFiltered: 0.02,
      speedKmh: 90,
      now: 1_600,
      profile,
      state: duringPulse.state,
    });
    expect(first.overrun).toBe(true);
    expect(afterPulse.overrun).toBe(false);
    expect(afterPulse.state.cooldownUntil).toBe(first.state.cooldownUntil);
  });
});
