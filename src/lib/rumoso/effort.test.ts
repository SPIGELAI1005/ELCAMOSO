import { describe, expect, it } from "vitest";
import {
  EffortMapper,
  WARMUP_MS,
  cadenceScore,
  instantEffort,
  speedScore,
} from "./effort";

describe("instantEffort", () => {
  it("is ~20 for a walking cadence and pace", () => {
    const e = instantEffort({ cadenceSpm: 110, speedMps: 1.4, accelMps2: 0 });
    expect(e).toBeGreaterThan(15);
    expect(e).toBeLessThan(30);
  });

  it("is ~50 for a jogging cadence and pace", () => {
    const e = instantEffort({ cadenceSpm: 150, speedMps: 2.5, accelMps2: 0 });
    expect(e).toBeGreaterThan(44);
    expect(e).toBeLessThan(56);
  });

  it("is high for a hard push", () => {
    const e = instantEffort({ cadenceSpm: 190, speedMps: 4.2, accelMps2: 1.2 });
    expect(e).toBeGreaterThan(85);
  });

  it("drops missing cues instead of treating them as zero", () => {
    const onlyCadence = instantEffort({ cadenceSpm: 150, speedMps: null, accelMps2: null });
    expect(onlyCadence).toBe(cadenceScore(150));
    const onlySpeed = instantEffort({ cadenceSpm: null, speedMps: 2.5, accelMps2: null });
    expect(onlySpeed).toBe(speedScore(2.5));
  });

  it("is 0 when nothing is known", () => {
    expect(instantEffort({ cadenceSpm: null, speedMps: null, accelMps2: null })).toBe(0);
  });

  it("raises effort when accelerating, lowers it when slowing", () => {
    const base = { cadenceSpm: 150, speedMps: 2.5, accelMps2: 0 };
    const up = instantEffort({ ...base, accelMps2: 1.5 });
    const down = instantEffort({ ...base, accelMps2: -1.5 });
    expect(up).toBeGreaterThan(instantEffort(base));
    expect(down).toBeLessThan(instantEffort(base));
  });
});

describe("calibration", () => {
  it("maps a personal walking baseline near 22 effort", () => {
    const calib = { baselineCadenceSpm: 100, baselineSpeedMps: 1.2 };
    const e = instantEffort({ cadenceSpm: 100, speedMps: 1.2, accelMps2: 0 }, calib);
    expect(e).toBeGreaterThan(18);
    expect(e).toBeLessThan(28);
  });

  it("gives a naturally high-cadence walk a lower effort than the default curve", () => {
    const calib = { baselineCadenceSpm: 130, baselineSpeedMps: 1.5 };
    const raw = instantEffort({ cadenceSpm: 130, speedMps: 1.5, accelMps2: 0 });
    const cal = instantEffort({ cadenceSpm: 130, speedMps: 1.5, accelMps2: 0 }, calib);
    expect(cal).toBeLessThan(raw);
    expect(cal).toBeLessThan(35);
  });
});

describe("EffortMapper", () => {
  it("smooths toward the instant value", () => {
    const m = new EffortMapper();
    let v = 0;
    for (let i = 0; i < 20; i++) {
      v = m.update({ cadenceSpm: 150, speedMps: 2.5, accelMps2: 0 }, 0.2);
    }
    const target = instantEffort({ cadenceSpm: 150, speedMps: 2.5, accelMps2: 0 });
    expect(v).toBeGreaterThan(target * 0.7);
    expect(v).toBeLessThanOrEqual(target + 0.5);
  });

  it("finishes a 60 s warm-up and stores the median baseline", () => {
    const m = new EffortMapper();
    m.startWarmup(0);
    for (let t = 0; t <= WARMUP_MS; t += 1000) {
      m.pushWarmup(t, { cadenceSpm: 108, speedMps: 1.35, accelMps2: 0 });
    }
    expect(m.warmingUp).toBe(false);
    expect(m.calibration?.baselineCadenceSpm).toBeCloseTo(108, 0);
    expect(m.calibration?.baselineSpeedMps).toBeCloseTo(1.35, 2);
  });
});
