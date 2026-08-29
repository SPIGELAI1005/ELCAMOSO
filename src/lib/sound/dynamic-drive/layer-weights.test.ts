import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/sound/profiles";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import {
  computeDynamicLayerWeights,
  fundamentalHzForLayer,
} from "@/lib/sound/dynamic-drive/layer-weights";

describe("computeDynamicLayerWeights", () => {
  it("normalizes steady bands near unity", () => {
    const drivetrain = resolveDrivetrain(getProfile("gt-v8"));
    const w = computeDynamicLayerWeights(
      { ...IDLE_POWERTRAIN, normalizedRpm: 0.5, rpm: 4500, load: 0.6, gear: 3 },
      drivetrain,
    );
    const steady = w.idle + w.low + w.mid + w.high + w.redline;
    expect(steady).toBeGreaterThan(0.7);
    expect(steady).toBeLessThan(1.05);
  });

  it("ducks steady bands during shift", () => {
    const drivetrain = resolveDrivetrain(getProfile("gt-v8"));
    const steady = {
      ...IDLE_POWERTRAIN,
      normalizedRpm: 0.55,
      rpm: 4200,
      load: 0.7,
      gear: 3,
    };
    const atRest = computeDynamicLayerWeights(steady, drivetrain);
    const shifting = computeDynamicLayerWeights(
      { ...steady, shifting: true, shiftDirection: "up", shiftProgress: 0.5 },
      drivetrain,
    );
    const steadyAtRest = atRest.idle + atRest.low + atRest.mid + atRest.high + atRest.redline;
    const steadyShift =
      shifting.idle + shifting.low + shifting.mid + shifting.high + shifting.redline;
    expect(steadyShift).toBeLessThan(steadyAtRest);
    expect(shifting.upshiftTransient).toBeGreaterThan(0);
  });

  it("boosts low band in first gears", () => {
    const drivetrain = resolveDrivetrain(getProfile("gt-v8"));
    const pt = { ...IDLE_POWERTRAIN, normalizedRpm: 0.25, rpm: 2200, load: 0.5, gear: 1 };
    const lowGear = computeDynamicLayerWeights(pt, drivetrain);
    const highGear = computeDynamicLayerWeights({ ...pt, gear: 5 }, drivetrain);
    expect(lowGear.low).toBeGreaterThan(highGear.low);
  });
});

describe("fundamentalHzForLayer", () => {
  it("derives per-layer Hz from personality RPM range", () => {
    const drivetrain = resolveDrivetrain(getProfile("flat-six-sport"));
    const pt = { ...IDLE_POWERTRAIN, rpm: 5500, normalizedRpm: 0.7, load: 0.8, gear: 4 };
    const idleHz = fundamentalHzForLayer("dd-idle", pt, drivetrain);
    const highHz = fundamentalHzForLayer("dd-high", pt, drivetrain);
    expect(highHz).toBeGreaterThan(idleHz);
  });
});
