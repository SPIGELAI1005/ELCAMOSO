import { describe, expect, it } from "vitest";
import { HARD_REV_BY_PROFILE, HardRevOverlay } from "@/lib/powertrain/hard-rev-overlay";
import { IDLE_POWERTRAIN, type VirtualPowertrainState } from "@/lib/powertrain/types";

function state(over: Partial<VirtualPowertrainState>): VirtualPowertrainState {
  return {
    ...IDLE_POWERTRAIN,
    gear: 1,
    rpm: 4000,
    driverDemand: 0.7,
    diagnostics: { ...(IDLE_POWERTRAIN.diagnostics ?? {}), accelerationFilteredMs2: 4.4 },
    ...over,
  } as VirtualPowertrainState;
}

describe("hard-rev overlay (superbike only)", () => {
  it("is configured for the superbike powertrain only", () => {
    expect(Object.keys(HARD_REV_BY_PROFILE)).toEqual(["motorcycle-inline-4"]);
  });

  it("revs into the limiter, bounces, then quickshifts up on a full-throttle pull", () => {
    const o = new HardRevOverlay(HARD_REV_BY_PROFILE["motorcycle-inline-4"]!);
    let seq = 0;
    let maxRpm = 0;
    let limiter = 0;
    const ups: number[] = [];
    let last = 1;
    for (let i = 0; i < 60 * 12; i += 1) {
      const r = o.apply(state({ timestamp: i * 16.7 }), 16.7, () => (seq += 1));
      maxRpm = Math.max(maxRpm, r.rpm);
      if (r.limiterActive) limiter += 1;
      if (r.gear > last) ups.push(r.gear);
      last = r.gear;
    }
    expect(maxRpm).toBeGreaterThan(13000);
    expect(limiter).toBeGreaterThan(0);
    expect(ups.length).toBeGreaterThanOrEqual(3);
  });

  it("stays out of the way on gentle riding", () => {
    const o = new HardRevOverlay(HARD_REV_BY_PROFILE["motorcycle-inline-4"]!);
    for (let i = 0; i < 600; i += 1) {
      const s = state({ driverDemand: 0.3, diagnostics: { ...(IDLE_POWERTRAIN.diagnostics ?? {}), accelerationFilteredMs2: 1.2 } as never });
      expect(o.apply(s, 16.7, () => 0)).toBe(s);
    }
  });
});
