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

  it("flares the revs into the lower gear on each hard-braking downshift, down to 2nd", () => {
    const o = new HardRevOverlay(HARD_REV_BY_PROFILE["motorcycle-inline-4"]!);
    let seq = 0;
    let speed = 150;
    let last = 6;
    const flares: number[] = [];
    let peak = 0;
    let downs = 0;
    for (let i = 0; i < 60 * 8 && speed > 35; i += 1) {
      speed -= (5.5 * 3.6) / 60;
      const r = o.apply(
        state({ gear: 6, rpm: 4500, speedKmh: speed, driverDemand: 0, overrun: true,
          diagnostics: { ...(IDLE_POWERTRAIN.diagnostics ?? {}), accelerationFilteredMs2: -5.5 } as never }),
        16.7,
        () => (seq += 1),
      );
      if (r.gear < last) { downs += 1; peak = 0; }
      if (r.shifting && r.shiftDirection === "down") { peak = Math.max(peak, r.rpm); expect(r.revMatchActive || r.shiftPhase === "reengage").toBe(true); }
      if (!r.shifting && peak > 0) { flares.push(peak); peak = 0; }
      last = r.gear;
      expect(r.gear).toBeGreaterThanOrEqual(2);
      expect(r.rpm).toBeLessThanOrEqual(13800);
    }
    expect(downs).toBeGreaterThanOrEqual(3);
    expect(Math.max(...flares)).toBeGreaterThan(11500);
  });

  it("keeps gentle slowing on the normal map", () => {
    const o = new HardRevOverlay(HARD_REV_BY_PROFILE["motorcycle-inline-4"]!);
    for (let i = 0; i < 600; i += 1) {
      const s = state({ gear: 5, rpm: 3000, speedKmh: 100, driverDemand: 0,
        diagnostics: { ...(IDLE_POWERTRAIN.diagnostics ?? {}), accelerationFilteredMs2: -1.5 } as never });
      expect(o.apply(s, 16.7, () => 0)).toBe(s);
    }
  });
});
