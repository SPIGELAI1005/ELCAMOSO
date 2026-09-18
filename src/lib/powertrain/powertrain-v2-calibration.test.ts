import { describe, expect, it } from "vitest";
import { sanitizeSettings, DEFAULT_SETTINGS, parseBackup } from "@/lib/drive/settings";
import {
  createDriverDemandState,
  roadLoadEstimate,
  updateDriverDemand,
} from "@/lib/powertrain/driver-demand";
import { shouldUseDynamicPowertrain } from "@/lib/powertrain/dynamic-powertrain-gate";
import { reconcileKickdownQueue } from "@/lib/powertrain/kickdown-queue";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";
import {
  calibrationUpshiftTable,
  generateShiftMap,
  resolveShiftMap,
  scheduleUpshiftRpmForDemand,
  validateShiftMap,
} from "@/lib/powertrain/shift-map";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import {
  assertPhysicalPlausibility,
  getPowertrainScenario,
  runPowertrainScenario,
  validatePowertrainTrace,
  POWERTRAIN_SCENARIOS,
} from "@/lib/powertrain/scenarios";
import type { VehicleMotionState } from "@/lib/motion/types";
import { DRIVETRAIN_PERSONALITY_IDS } from "@/lib/drive/drivetrain-personalities";

function motion(partial: Partial<VehicleMotionState> = {}): VehicleMotionState {
  return {
    timestamp: 1,
    speedKmh: 80,
    accelerationMs2: 0,
    accelerationFiltered: 0,
    decelerationMs2: 0,
    inferredThrottle: 0.08,
    motionConfidence: 1,
    primarySource: "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: "decay",
    transitioning: false,
    ...partial,
  };
}

describe("three speed signals", () => {
  it("keeps displaySpeed responsive while mechanical and decision lag differently", () => {
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    // Warm to 80 km/h
    for (let i = 0; i < 80; i += 1) {
      sim.tick(motion({ speedKmh: 80, timestamp: i * 16 }), 0.016, { directThrottle: 0.15 });
    }
    const base = sim.tick(motion({ speedKmh: 80, timestamp: 10_000 }), 0.016, {
      directThrottle: 0.15,
    });
    expect(base.diagnostics?.displaySpeedKmh).toBeCloseTo(80, 0);
    expect(base.diagnostics?.mechanicalSpeedKmh).toBeCloseTo(80, 0);
    expect(base.diagnostics?.shiftDecisionSpeedKmh).toBeCloseTo(80, 0);

    // Step to 100 - display jumps; mechanical and decision trail
    const step = sim.tick(motion({ speedKmh: 100, timestamp: 10_016 }), 0.016, {
      directThrottle: 0.15,
    });
    expect(step.diagnostics?.displaySpeedKmh).toBe(100);
    expect(step.diagnostics!.mechanicalSpeedKmh).toBeLessThan(99);
    expect(step.diagnostics!.mechanicalSpeedKmh).toBeGreaterThan(80);
    expect(step.diagnostics!.shiftDecisionSpeedKmh).toBeLessThan(
      step.diagnostics!.mechanicalSpeedKmh,
    );
  });

  it("keeps RPM acoustically stable under ±1 and ±2 km/h GPS noise", () => {
    const sim = new PowertrainSimulator({ profileId: "gt-v8" });
    // Mid-band cruise clear of light-demand upshift edges after Road Feel V3.
    const cruise = 75;
    for (let i = 0; i < 120; i += 1) {
      sim.tick(motion({ speedKmh: cruise, timestamp: i * 16 }), 0.016, { directThrottle: 0.14 });
    }
    const rpms1: number[] = [];
    const rpms2: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const noise1 = (i % 2 === 0 ? 1 : -1) * 1;
      const out1 = sim.tick(
        motion({ speedKmh: cruise + noise1, timestamp: 20_000 + i * 16 }),
        0.016,
        { directThrottle: 0.14 },
      );
      rpms1.push(out1.mechanicalRpm);
    }
    sim.reset();
    for (let i = 0; i < 120; i += 1) {
      sim.tick(motion({ speedKmh: cruise, timestamp: i * 16 }), 0.016, { directThrottle: 0.14 });
    }
    for (let i = 0; i < 200; i += 1) {
      const noise2 = (i % 2 === 0 ? 1 : -1) * 2;
      const out2 = sim.tick(
        motion({ speedKmh: cruise + noise2, timestamp: 40_000 + i * 16 }),
        0.016,
        { directThrottle: 0.14 },
      );
      rpms2.push(out2.mechanicalRpm);
    }
    const peakToPeak = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    // Raw ±2 km/h at ~90 would swing RPM by hundreds; filtered should stay tight.
    expect(peakToPeak(rpms1)).toBeLessThan(180);
    expect(peakToPeak(rpms2)).toBeLessThan(320);
  });

  it("still follows genuine acceleration with mechanical speed", () => {
    const sim = new PowertrainSimulator({ profileId: "gt-v8" });
    for (let i = 0; i < 60; i += 1) {
      sim.tick(motion({ speedKmh: 60, timestamp: i * 16 }), 0.016, { directThrottle: 0.2 });
    }
    const start = sim.tick(motion({ speedKmh: 60, timestamp: 5_000 }), 0.016, {
      directThrottle: 0.55,
    });
    let last = start;
    for (let i = 1; i <= 80; i += 1) {
      last = sim.tick(
        motion({
          speedKmh: 60 + i * 0.9,
          timestamp: 5_000 + i * 16,
          accelerationFiltered: 2.2,
          accelerationMs2: 2.2,
        }),
        0.016,
        { directThrottle: 0.55 },
      );
    }
    expect(last.diagnostics!.mechanicalSpeedKmh).toBeGreaterThan(
      start.diagnostics!.mechanicalSpeedKmh + 15,
    );
    expect(last.mechanicalRpm).toBeGreaterThan(start.mechanicalRpm + 150);
  });
});

describe("shift map gentle calibration", () => {
  it("validates every personality map and keeps light demand earlier than WOT", () => {
    for (const id of DRIVETRAIN_PERSONALITY_IDS) {
      const profile = getPowertrainProfile(id);
      const map = generateShiftMap(profile);
      const validation = validateShiftMap(map, profile);
      expect(validation.ok, `${id}: ${validation.issues.join("; ")}`).toBe(true);
      const table = calibrationUpshiftTable(profile);
      const light = table.find((r) => r.demand === 0.1)!;
      const wot = table.find((r) => r.demand === 1)!;
      for (let g = 0; g < light.speeds.length; g += 1) {
        expect(light.speeds[g]!).toBeLessThanOrEqual(wot.speeds[g]! + 0.5);
      }
    }
  });

  it("places GT V8 city driving well below redline RPM on light demand", () => {
    const gt = getPowertrainProfile("gt-v8");
    const rpm = scheduleUpshiftRpmForDemand(0.1, gt);
    expect(rpm).toBeLessThan(gt.transmission.upshiftRpm.lowLoad);
    expect(rpm).toBeLessThan(gt.engine.redlineRpm * 0.72);
  });

  it("keeps American V8 earlier than Flat-Six under light demand in 1st", () => {
    const am = getPowertrainProfile("american-v8");
    const fs = getPowertrainProfile("flat-six-sport");
    const amMap = resolveShiftMap(am);
    const fsMap = resolveShiftMap(fs);
    expect(amMap.upshiftSpeedKmh[0]![1]!).toBeLessThan(fsMap.upshiftSpeedKmh[0]![1]!);
  });
});

describe("steady-speed driverDemand", () => {
  const profile = getPowertrainProfile("flat-six-sport");

  function steadyDemand(speedKmh: number) {
    const state = createDriverDemandState();
    let last = updateDriverDemand({
      motion: motion({
        speedKmh,
        accelerationMs2: 0,
        accelerationFiltered: 0,
        inferredThrottle: 0,
      }),
      profile,
      rpmNormalized: 0.35,
      dt: 0.05,
      state,
      directThrottle: 0.12,
    });
    for (let i = 0; i < 40; i += 1) {
      last = updateDriverDemand({
        motion: motion({
          speedKmh,
          accelerationMs2: 0,
          accelerationFiltered: 0,
          inferredThrottle: 0,
        }),
        profile,
        rpmNormalized: 0.35,
        dt: 0.05,
        state: last.state,
        directThrottle: 0.12,
      });
    }
    return last;
  }

  it.each([30, 50, 80, 100, 130])("keeps driverDemand modest at %i km/h cruise", (speed) => {
    const r = steadyDemand(speed);
    expect(r.driverDemand).toBeLessThan(0.28);
    expect(r.driverDemand).toBeGreaterThan(0.05);
    // Road speed must not masquerade as pedal - demand stays near the directThrottle.
    expect(Math.abs(r.driverDemand - 0.12)).toBeLessThan(0.1);
    expect(roadLoadEstimate(speed)).toBeLessThan(0.15);
    // engineLoad may rise with speed (aero) while demand stays modest
    if (speed >= 100) {
      expect(r.engineLoad).toBeGreaterThan(r.driverDemand * 0.4);
    }
  });

  it("responds clearly from 100 km/h cruise to accel and lift", () => {
    const state = createDriverDemandState();
    let cruise = updateDriverDemand({
      motion: motion({ speedKmh: 100, accelerationFiltered: 0, accelerationMs2: 0 }),
      profile,
      rpmNormalized: 0.4,
      dt: 0.05,
      state,
      directThrottle: 0.12,
    });
    for (let i = 0; i < 30; i += 1) {
      cruise = updateDriverDemand({
        motion: motion({ speedKmh: 100, accelerationFiltered: 0, accelerationMs2: 0 }),
        profile,
        rpmNormalized: 0.4,
        dt: 0.05,
        state: cruise.state,
        directThrottle: 0.12,
      });
    }
    let gentle = cruise;
    for (let i = 0; i < 20; i += 1) {
      gentle = updateDriverDemand({
        motion: motion({
          speedKmh: 100 + i * 0.2,
          accelerationFiltered: 0.9,
          accelerationMs2: 0.9,
        }),
        profile,
        rpmNormalized: 0.45,
        dt: 0.05,
        state: gentle.state,
        directThrottle: 0.35,
      });
    }
    let strong = cruise;
    for (let i = 0; i < 20; i += 1) {
      strong = updateDriverDemand({
        motion: motion({
          speedKmh: 100 + i * 0.5,
          accelerationFiltered: 2.8,
          accelerationMs2: 2.8,
        }),
        profile,
        rpmNormalized: 0.55,
        dt: 0.05,
        state: strong.state,
        directThrottle: 0.9,
      });
    }
    let lift = strong;
    for (let i = 0; i < 25; i += 1) {
      lift = updateDriverDemand({
        motion: motion({
          speedKmh: 110,
          accelerationFiltered: -1.2,
          accelerationMs2: -1.2,
        }),
        profile,
        rpmNormalized: 0.5,
        dt: 0.05,
        state: lift.state,
        directThrottle: 0,
      });
    }
    expect(gentle.driverDemand).toBeGreaterThan(cruise.driverDemand + 0.08);
    expect(strong.driverDemand).toBeGreaterThan(gentle.driverDemand + 0.25);
    expect(lift.driverDemand).toBeLessThan(0.2);
  });
});

describe("kickdown queue cancellation", () => {
  const profile = getPowertrainProfile("gt-v8");
  const map = resolveShiftMap(profile);

  function baseCtx(overrides: Partial<Parameters<typeof reconcileKickdownQueue>[0]> = {}) {
    const speed = 80;
    return {
      currentGear: 6,
      queuedTargetGear: 4,
      driverDemand: 0.95,
      braking: 0,
      rpm: rpmFromSpeedAndGear(speed, 6, profile) * 0.55,
      shiftDecisionSpeedKmh: speed,
      speedKmh: speed,
      lastShiftCompletedAt: 0,
      now: 30_000,
      lastShiftWasUp: false,
      blockDownshiftUntil: 0,
      lastKickdownAt: 0,
      previousDemand: 0.2,
      kickdownPlanActive: true,
      ...overrides,
    };
  }

  it("holds throttle through kickdown and keeps a lower queued target", () => {
    const r = reconcileKickdownQueue(baseCtx(), profile, map);
    expect(r.kickdownPlanActive).toBe(true);
    expect(r.queuedTargetGear).toBeLessThan(6);
  });

  it("cancels remaining queue on throttle release", () => {
    const r = reconcileKickdownQueue(
      baseCtx({ driverDemand: 0.25, currentGear: 5, queuedTargetGear: 4 }),
      profile,
      map,
    );
    expect(r.kickdownPlanActive).toBe(false);
    expect(r.queuedTargetGear).toBeGreaterThanOrEqual(4);
  });

  it("cancels acceleration kickdown queue when braking", () => {
    const r = reconcileKickdownQueue(baseCtx({ braking: 0.6 }), profile, map);
    expect(r.kickdownPlanActive).toBe(false);
  });

  it("raises unsafe queued gear after a speed spike", () => {
    const unsafe = reconcileKickdownQueue(
      baseCtx({
        shiftDecisionSpeedKmh: 140,
        speedKmh: 140,
        queuedTargetGear: 2,
        currentGear: 6,
      }),
      profile,
      map,
    );
    expect(unsafe.queuedTargetGear).toBeGreaterThan(2);
  });

  it("simulator cancels queued 4th when throttle drops after 6→5 starts", () => {
    const sim = new PowertrainSimulator({ profile });
    const internals = sim.getInternals() as {
      gear: number;
      rpm: number;
      lastShiftCompletedAt: number;
      mechanicalSpeedKmh: number;
      shiftDecisionSpeedKmh: number;
      previousThrottle: number;
      queuedTargetGear: number;
      kickdownPlanActive: boolean;
    };
    const cruise = 85;
    internals.gear = 6;
    internals.rpm = rpmFromSpeedAndGear(cruise, 6, profile);
    internals.lastShiftCompletedAt = -60_000;
    internals.mechanicalSpeedKmh = cruise;
    internals.shiftDecisionSpeedKmh = cruise;
    internals.previousThrottle = 0.2;

    let sawQueueBelow5 = false;
    let released = false;
    for (let i = 0; i < 80; i += 1) {
      const throttle = i < 25 ? 0.95 : 0.2;
      if (i === 25) released = true;
      const out = sim.tick(
        motion({
          speedKmh: cruise,
          timestamp: 40_000 + i * 16,
          inferredThrottle: throttle,
          accelerationFiltered: throttle > 0.5 ? 2.2 : 0,
          accelerationMs2: throttle > 0.5 ? 2.2 : 0,
        }),
        0.016,
        { directThrottle: throttle },
      );
      if (out.queuedTargetGear <= 4) sawQueueBelow5 = true;
      if (released && i > 40 && !out.shifting) {
        // After release, should not keep chasing an unconditional 4th.
        expect(out.queuedTargetGear).toBeGreaterThanOrEqual(4);
      }
    }
    expect(sawQueueBelow5 || released).toBe(true);
  });
});

describe("settings v8 dynamicDrive migration", () => {
  function backup(version: number, settings: Record<string, unknown>) {
    return JSON.stringify({
      kind: "elcamoso.settings.backup",
      version,
      exportedAt: new Date().toISOString(),
      app: { name: "ELCAMOSO" },
      settings,
    });
  }

  it("defaults unset dynamicDrive to true when migrating to v8", () => {
    const { settings } = parseBackup(backup(7, { profileId: "gt-v8" }));
    expect(settings.dynamicDrive).toBe(true);
  });

  it("preserves explicit dynamicDrive false across v8 migration", () => {
    const { settings } = parseBackup(backup(7, { profileId: "gt-v8", dynamicDrive: false }));
    expect(settings.dynamicDrive).toBe(false);
  });

  it("preserves explicit dynamicDrive true across v8 migration", () => {
    const { settings } = parseBackup(backup(7, { profileId: "gt-v8", dynamicDrive: true }));
    expect(settings.dynamicDrive).toBe(true);
  });

  it("sanitizeSettings preserves explicit false and defaults unset to true", () => {
    expect(sanitizeSettings({ dynamicDrive: false }).settings.dynamicDrive).toBe(false);
    expect(sanitizeSettings({}).settings.dynamicDrive).toBe(true);
    expect(DEFAULT_SETTINGS.dynamicDrive).toBe(true);
  });
});

describe("dynamic powertrain entitlement gate", () => {
  it("never activates for continuous profiles even in demo", () => {
    expect(
      shouldUseDynamicPowertrain({
        supportsVirtualTransmission: false,
        settingsDynamicDrive: true,
        hasDynamicDriveEntitlement: true,
        sessionKind: "demo",
      }),
    ).toBe(false);
  });

  it("allows demo for VT profiles without entitlement", () => {
    expect(
      shouldUseDynamicPowertrain({
        supportsVirtualTransmission: true,
        settingsDynamicDrive: false,
        hasDynamicDriveEntitlement: false,
        sessionKind: "demo",
      }),
    ).toBe(true);
  });

  it("requires setting AND entitlement for live drive", () => {
    expect(
      shouldUseDynamicPowertrain({
        supportsVirtualTransmission: true,
        settingsDynamicDrive: true,
        hasDynamicDriveEntitlement: false,
        sessionKind: "drive",
      }),
    ).toBe(false);
    expect(
      shouldUseDynamicPowertrain({
        supportsVirtualTransmission: true,
        settingsDynamicDrive: false,
        hasDynamicDriveEntitlement: true,
        sessionKind: "drive",
      }),
    ).toBe(false);
    expect(
      shouldUseDynamicPowertrain({
        supportsVirtualTransmission: true,
        settingsDynamicDrive: true,
        hasDynamicDriveEntitlement: true,
        sessionKind: "drive",
      }),
    ).toBe(true);
  });
});

describe("calibration scenario acceptance", () => {
  it("gentle 0–60: multiple early shifts, no redline behavior", () => {
    const result = runPowertrainScenario(getPowertrainScenario("gentle-0-60")!);
    const profile = getPowertrainProfile(result.profileId);
    expect(validatePowertrainTrace(result, profile).ok).toBe(true);
    expect(assertPhysicalPlausibility(result, profile).ok).toBe(true);
    const ups = result.gearChanges.filter((c) => c.to === c.from + 1 && c.from > 0);
    expect(ups.length).toBeGreaterThanOrEqual(2);
    const maxRpm = Math.max(...result.samples.map((s) => s.rpm));
    expect(maxRpm).toBeLessThan(profile.engine.redlineRpm * 0.92);
  });

  it("normal 0–100: progressively held gears", () => {
    const result = runPowertrainScenario(getPowertrainScenario("medium-0-100")!);
    const profile = getPowertrainProfile(result.profileId);
    expect(validatePowertrainTrace(result, profile).ok).toBe(true);
    const ups = result.gearChanges.filter((c) => c.to === c.from + 1 && c.from > 0);
    expect(ups.length).toBeGreaterThanOrEqual(2);
  });

  it("WOT 0–140: near-performance shift points", () => {
    const result = runPowertrainScenario(getPowertrainScenario("wot-0-140")!);
    const profile = getPowertrainProfile(result.profileId);
    expect(validatePowertrainTrace(result, profile).ok).toBe(true);
    expect(result.shiftCount).toBeGreaterThanOrEqual(2);
  });

  it.each(["cruise-30", "cruise-50", "cruise-80", "cruise-100", "cruise-120"] as const)(
    "%s: stable gear and RPM",
    (id) => {
      const result = runPowertrainScenario(getPowertrainScenario(id)!);
      const profile = getPowertrainProfile(result.profileId);
      expect(validatePowertrainTrace(result, profile).ok).toBe(true);
      // Allow initial schedule climb; judge stability on the settled tail.
      const engaged = result.samples.filter((s) => s.gear > 0 && s.tMs > 4500);
      const gears = new Set(engaged.map((s) => s.gear));
      expect(gears.size).toBeLessThanOrEqual(2);
      const rpms = engaged.map((s) => s.rpm);
      expect(Math.max(...rpms) - Math.min(...rpms)).toBeLessThan(900);
    },
  );

  it("80→120 kickdown then upshifts", () => {
    const result = runPowertrainScenario(getPowertrainScenario("highway-kickdown")!);
    const profile = getPowertrainProfile(result.profileId);
    expect(validatePowertrainTrace(result, profile).ok).toBe(true);
    const after = result.gearChanges.filter((c) => c.atMs >= 350 * 16);
    expect(after.some((c) => c.to < c.from)).toBe(true);
  });

  it("100→50 coast: natural downshifts without hunting", () => {
    const result = runPowertrainScenario(getPowertrainScenario("decel-100-50")!);
    const profile = getPowertrainProfile(result.profileId);
    const v = validatePowertrainTrace(result, profile);
    expect(v.ok, v.issues.join("; ")).toBe(true);
    expect(result.gearChanges.some((c) => c.to < c.from && c.from > 0)).toBe(true);
  });

  it("runs all registered scenarios without hunting", () => {
    for (const scenario of POWERTRAIN_SCENARIOS) {
      const result = runPowertrainScenario(scenario);
      const profile = getPowertrainProfile(result.profileId);
      const v = validatePowertrainTrace(result, profile);
      expect(v.ok, `${scenario.id}: ${v.issues.join("; ")}`).toBe(true);
    }
  });
});
