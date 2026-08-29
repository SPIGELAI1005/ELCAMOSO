import { describe, expect, it } from "vitest";
import { fuseAccelLayers, fuseSpeedLayers } from "@/lib/motion/sensor-fusion-correction";

describe("sensor-fusion correction", () => {
  it("limits speed correction toward a lagged telemetry anchor", () => {
    let anchor = 20;
    let filtered = 20;
    for (let i = 0; i < 30; i += 1) {
      const out = fuseSpeedLayers({
        anchorTargetMs: 30,
        anchorSource: "vehicle-telemetry",
        currentAnchorMs: anchor,
        currentFilteredMs: filtered,
        phoneImuAccelMs2: 0.5,
        conflictGapMs: 0,
        telemetryAgeMs: 700,
        dt: 0.05,
        reconnectBlend: false,
        tierBlend: 1,
        holdSpeedMs: 0,
      });
      anchor = out.anchorMs;
      filtered = out.filteredMs;
    }
    expect(filtered).toBeGreaterThan(20);
    expect(filtered).toBeLessThan(29);
  });

  it("preserves leading phone accel before telemetry catches up", () => {
    let transient = 0;
    let anchor = 0;
    const phoneLead = fuseAccelLayers({
      imuAccelMs2: 2.6,
      telemetryAccelMs2: 0.4,
      currentTransientMs2: transient,
      currentAnchorMs2: anchor,
      telemetryAgeMs: 650,
      dt: 0.05,
      reconnectBlend: false,
      maxSpike: 14,
    });
    expect(phoneLead.transientMs2).toBeGreaterThan(1.0);
    const peak = phoneLead.transientMs2;

    transient = phoneLead.transientMs2;
    anchor = phoneLead.anchorMs2;
    for (let i = 0; i < 20; i += 1) {
      const out = fuseAccelLayers({
        imuAccelMs2: 0.3,
        telemetryAccelMs2: 1.8,
        currentTransientMs2: transient,
        currentAnchorMs2: anchor,
        telemetryAgeMs: 120,
        dt: 0.05,
        reconnectBlend: false,
        maxSpike: 14,
      });
      transient = out.transientMs2;
      anchor = out.anchorMs2;
    }
    expect(transient).toBeGreaterThan(peak * 0.25);
    expect(transient).toBeLessThan(peak + 0.35);
  });

  it("accepts browser IMU transients when phone is absent", () => {
    const out = fuseAccelLayers({
      imuAccelMs2: 1.8,
      telemetryAccelMs2: null,
      currentTransientMs2: 0,
      currentAnchorMs2: 0,
      telemetryAgeMs: null,
      dt: 0.05,
      reconnectBlend: false,
      maxSpike: 14,
    });
    expect(out.transientMs2).toBeGreaterThan(0.65);
  });

  it("limits correction when fast speed layer leads the anchor", () => {
    let filtered = 24;
    let anchor = 20;
    for (let i = 0; i < 20; i += 1) {
      const out = fuseSpeedLayers({
        anchorTargetMs: 20,
        anchorSource: "vehicle-telemetry",
        currentAnchorMs: anchor,
        currentFilteredMs: filtered,
        phoneImuAccelMs2: 0.8,
        conflictGapMs: 0,
        telemetryAgeMs: 600,
        dt: 0.05,
        reconnectBlend: false,
        tierBlend: 1,
        holdSpeedMs: 0,
      });
      anchor = out.anchorMs;
      filtered = out.filteredMs;
    }
    expect(filtered).toBeGreaterThan(22);
    expect(filtered).toBeLessThan(26);
  });

  it("rate-limits correction under large telemetry vs phone GPS conflict", () => {
    const speeds: number[] = [];
    let anchor = 30 / 3.6;
    let filtered = 30 / 3.6;
    for (let i = 0; i < 40; i += 1) {
      const out = fuseSpeedLayers({
        anchorTargetMs: 90 / 3.6,
        anchorSource: "vehicle-telemetry",
        currentAnchorMs: anchor,
        currentFilteredMs: filtered,
        phoneImuAccelMs2: null,
        conflictGapMs: 16.7,
        telemetryAgeMs: 200,
        dt: 0.04,
        reconnectBlend: false,
        tierBlend: 1,
        holdSpeedMs: 0,
      });
      anchor = out.anchorMs;
      filtered = out.filteredMs;
      speeds.push(filtered * 3.6);
    }
    const maxJump = speeds.slice(1).reduce((max, speed, idx) => {
      return Math.max(max, Math.abs(speed - speeds[idx]!));
    }, 0);
    expect(maxJump).toBeLessThan(4);
    expect(speeds.at(-1)).toBeGreaterThan(35);
    expect(speeds.at(-1)! - speeds[0]!).toBeGreaterThan(5);
  });
});
