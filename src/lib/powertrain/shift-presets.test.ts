import { describe, expect, it } from "vitest";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmAfterGearChange, rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";
import {
  getPowertrainScenario,
  runPowertrainScenario,
} from "@/lib/powertrain/scenarios";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import {
  CITY_DOWNSHIFT_KMH,
  CITY_UPSHIFT_KMH,
  adaptSpeedLadder,
  defaultShiftMapPreset,
  resolveShiftMapForPreset,
  summarizeShiftPreset,
} from "@/lib/powertrain/shift-presets";
import { gearlessDrivetrainState } from "@/lib/powertrain/gearless-state";
import { sanitizeSettings, DEFAULT_SETTINGS } from "@/lib/drive/settings";

describe("shift presets (Prompt 03)", () => {
  it("exposes City gentle thresholds for suitable six-speed profiles", () => {
    // Catalog fact: gt-v8 personality is six-speed; turbo-inline-6 is seven-speed.
    const profile = getPowertrainProfile("gt-v8");
    expect(profile.transmission.gears).toBe(6);
    const summary = summarizeShiftPreset(profile, "city");
    expect(summary.valid).toBe(true);
    expect(summary.gentleUpshiftKmh).toEqual([...CITY_UPSHIFT_KMH]);
    expect(summary.gentleDownshiftKmh).toEqual([...CITY_DOWNSHIFT_KMH]);
    expect(summary.minGearHoldMs).toBeGreaterThanOrEqual(800);
    expect(summary.minGearHoldMs).toBeLessThanOrEqual(1200);
    expect(summary.upshiftDurationMs).toBeGreaterThanOrEqual(150);
    expect(summary.upshiftDurationMs).toBeLessThanOrEqual(300);
  });

  it("adapts City ladders for non-six-speed gearboxes", () => {
    const muscle = summarizeShiftPreset(getPowertrainProfile("american-v8"), "city");
    expect(muscle.gearCount).toBe(5);
    expect(muscle.gentleUpshiftKmh).toHaveLength(4);
    expect(muscle.gentleUpshiftKmh[0]).toBeCloseTo(15, 0);
    expect(muscle.valid).toBe(true);

    const turbo = summarizeShiftPreset(getPowertrainProfile("turbo-inline-6"), "city");
    expect(turbo.gearCount).toBe(7);
    expect(turbo.gentleUpshiftKmh).toHaveLength(6);
    expect(turbo.gentleUpshiftKmh[0]).toBe(15);
    expect(turbo.gentleUpshiftKmh[4]).toBe(75);
    expect(turbo.gentleUpshiftKmh[5]).toBeGreaterThan(75);
    expect(turbo.valid).toBe(true);

    const tractor = summarizeShiftPreset(getPowertrainProfile("single-cylinder-ag"), "city");
    expect(tractor.gearCount).toBe(4);
    expect(tractor.gentleUpshiftKmh).toHaveLength(3);
    expect(tractor.valid).toBe(true);
  });

  it("keeps Sport gentle upshifts later than City; Touring in between", () => {
    const profile = getPowertrainProfile("gt-v8");
    const city = summarizeShiftPreset(profile, "city");
    const touring = summarizeShiftPreset(profile, "touring");
    const sport = summarizeShiftPreset(profile, "sport");
    for (let i = 0; i < city.gentleUpshiftKmh.length; i += 1) {
      expect(touring.gentleUpshiftKmh[i]!).toBeGreaterThan(city.gentleUpshiftKmh[i]!);
      expect(sport.gentleUpshiftKmh[i]!).toBeGreaterThan(touring.gentleUpshiftKmh[i]!);
    }
  });

  it("defaults to legacy unless the City flag is enabled", () => {
    expect(defaultShiftMapPreset()).toBe("legacy");
  });

  it("adapts ladders with compression and extrapolation", () => {
    expect(adaptSpeedLadder(CITY_UPSHIFT_KMH, 5)).toEqual([...CITY_UPSHIFT_KMH]);
    expect(adaptSpeedLadder(CITY_UPSHIFT_KMH, 3)).toHaveLength(3);
    expect(adaptSpeedLadder(CITY_UPSHIFT_KMH, 7)).toHaveLength(7);
  });
});

describe("authoritative drivetrain state", () => {
  it("emits unique sequence IDs once per shift begin on 0–80–0 City run", () => {
    const scenario = getPowertrainScenario("city-0-80-0")!;
    const result = runPowertrainScenario(scenario);
    expect(result.shiftMapPreset).toBe("city");
    expect(result.shiftEvents.length).toBeGreaterThan(0);
    const ids = result.shiftEvents.map((e) => e.sequenceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBe(ids.length);

    // Recorded fixture outputs (actual run in this environment).
    const fixture = {
      shiftEventCount: result.shiftEvents.length,
      firstUpshifts: result.shiftEvents
        .filter((e) => e.direction === "up")
        .slice(0, 5)
        .map((e) => ({
          sequenceId: e.sequenceId,
          from: e.fromGear,
          to: e.toGear,
          atMs: e.atMs,
        })),
      maxGear: Math.max(...result.samples.map((s) => s.gear)),
      finalGear: result.samples[result.samples.length - 1]!.gear,
      finalSpeed: result.samples[result.samples.length - 1]!.speedKmh,
    };
    expect(fixture.maxGear).toBeGreaterThanOrEqual(3);
    expect(fixture.finalSpeed).toBeLessThan(25);
    expect(fixture.firstUpshifts[0]?.from).toBe(1);
    expect(fixture.firstUpshifts[0]?.to).toBe(2);
    // Soft band: City 1→2 begins near the 15 km/h artistic threshold after filtering.
    const firstUpAt = fixture.firstUpshifts[0]!.atMs;
    const sampleAt = result.samples.find((s) => s.tMs >= firstUpAt);
    expect(sampleAt!.speedKmh).toBeLessThan(32);
    expect(sampleAt!.speedKmh).toBeGreaterThan(8);
  });

  it("avoids hunting while hovering near a City threshold", () => {
    const profile = getPowertrainProfile("gt-v8");
    const sim = new PowertrainSimulator({ profile, shiftMapPreset: "city" });
    const map = resolveShiftMapForPreset(sim.getProfile(), "city");
    const threshold = map.upshiftSpeedKmh[0]![0]!;
    let lastEventId = 0;
    let eventCount = 0;
    for (let i = 0; i < 400; i += 1) {
      const speed = threshold + (i % 16 < 8 ? 1.2 : -1.2);
      const motion = {
        ...IDLE_VEHICLE_MOTION,
        timestamp: 1_000 + i * 16,
        speedKmh: Math.max(0, speed),
        primarySource: "simulator" as const,
        fallbackTier: "browser" as const,
        inferredThrottle: 0.28,
        accelerationFiltered: 0,
        accelerationMs2: 0,
      };
      const out = sim.tick(motion, 0.016, { directThrottle: 0.28 });
      if (out.shiftEvent) {
        eventCount += 1;
        expect(out.shiftEvent.sequenceId).toBeGreaterThan(lastEventId);
        lastEventId = out.shiftEvent.sequenceId;
      }
    }
    // Dwell + hysteresis must prevent an artificial barrage.
    expect(eventCount).toBeLessThanOrEqual(4);
  });

  it("keeps ratio-correct RPM drops on upshift at stable speed", () => {
    const profile = getPowertrainProfile("gt-v8");
    const speed = 40;
    const change = rpmAfterGearChange(speed, 2, 3, profile);
    expect(change.after).toBeLessThan(change.before);
    const ratio = profile.transmission.gearRatios[2]! / profile.transmission.gearRatios[1]!;
    expect(change.after / change.before).toBeCloseTo(ratio, 2);
  });

  it("protects redline and rejects reverse / negative speed", () => {
    const sim = new PowertrainSimulator({
      profileId: "gt-v8",
      shiftMapPreset: "city",
    });
    const redline = sim.getProfile().engine.redlineRpm;
    let maxRpm = 0;
    for (let i = 0; i < 200; i += 1) {
      const out = sim.tick(
        {
          ...IDLE_VEHICLE_MOTION,
          timestamp: 2_000 + i * 16,
          speedKmh: 180,
          primarySource: "simulator",
          fallbackTier: "browser",
          inferredThrottle: 1,
          accelerationMs2: 2,
          accelerationFiltered: 2,
        },
        0.016,
        { directThrottle: 1 },
      );
      maxRpm = Math.max(maxRpm, out.rpm);
    }
    expect(maxRpm).toBeLessThanOrEqual(redline + 1);

    const neg = sim.tick(
      {
        ...IDLE_VEHICLE_MOTION,
        timestamp: 10_000,
        speedKmh: -12,
        primarySource: "simulator",
        fallbackTier: "browser",
      },
      0.016,
      { directThrottle: 0.2 },
    );
    expect(neg.speedKmh).toBe(0);
  });

  it("handles startup at speed without a shift barrage", () => {
    const sim = new PowertrainSimulator({
      profileId: "gt-v8",
      shiftMapPreset: "city",
    });
    const events: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      const out = sim.tick(
        {
          ...IDLE_VEHICLE_MOTION,
          timestamp: 5_000 + i * 16,
          speedKmh: 55,
          primarySource: "phone",
          fallbackTier: "phone",
          inferredThrottle: 0.25,
          accelerationFiltered: 0,
          accelerationMs2: 0,
        },
        0.016,
        { directThrottle: 0.25 },
      );
      if (out.shiftEvent) events.push(out.shiftEvent.sequenceId);
    }
    expect(events.length).toBeLessThanOrEqual(5);
    expect(sim.getInternals().gear).toBeGreaterThanOrEqual(2);
  });

  it("marks GPS loss as hold/decay freshness and does not invent acceleration", () => {
    const sim = new PowertrainSimulator({
      profileId: "flat-six-sport",
      shiftMapPreset: "city",
    });
    for (let i = 0; i < 40; i += 1) {
      sim.tick(
        {
          ...IDLE_VEHICLE_MOTION,
          timestamp: 1_000 + i * 16,
          speedKmh: 40 + i * 0.4,
          primarySource: "tesla-browser",
          fallbackTier: "browser",
          accelerationProvenance: "estimated-speed",
          inferredThrottle: 0.4,
          accelerationMs2: 0.5,
          accelerationFiltered: 0.5,
        },
        0.016,
        { directThrottle: 0.4 },
      );
    }
    const held = sim.tick(
      {
        ...IDLE_VEHICLE_MOTION,
        timestamp: 2_000,
        speedKmh: 55,
        primarySource: "tesla-browser",
        fallbackTier: "hold",
        transitioning: true,
        motionConfidence: 0.3,
        inferredThrottle: 0.2,
        accelerationMs2: 3,
        accelerationFiltered: 3,
      },
      0.016,
      { directThrottle: 0.2 },
    );
    expect(held.speedFreshness).toBe("hold");
    expect(held.diagnostics?.sourceChanged).toBe(true);
    expect(Math.abs(held.diagnostics!.accelerationFilteredMs2)).toBeLessThan(1.5);
  });

  it("exposes gearless authoritative state without gears or shift accents", () => {
    const state = gearlessDrivetrainState({
      ...IDLE_VEHICLE_MOTION,
      timestamp: 99,
      speedKmh: 33,
      primarySource: "phone",
      fallbackTier: "phone",
      inferredThrottle: 0.4,
    });
    expect(state.gear).toBe(0);
    expect(state.rpm).toBe(0);
    expect(state.shiftEvent).toBeNull();
    expect(state.operatingRegime).toBe("steady");
    expect(state.diagnostics?.powertrainBackend).toBe("gearless");
  });

  it("sanitizes old persisted settings missing shiftMapPreset", () => {
    const { settings } = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      shiftMapPreset: undefined,
    });
    expect(["legacy", "city", "touring", "sport"]).toContain(settings.shiftMapPreset);
    const broken = sanitizeSettings({ profileId: "gt-v8", shiftMapPreset: "warp" });
    expect(broken.settings.shiftMapPreset).toBe(defaultShiftMapPreset());
  });

  it("keeps mechanical RPM consistent with wheel×ratio×finalDrive", () => {
    const profile = getPowertrainProfile("gt-v8");
    const rpm = rpmFromSpeedAndGear(36, 3, profile);
    const speedMs = 36 / 3.6;
    const wheelRpm = (speedMs / profile.wheelCircumferenceM) * 60;
    const expected =
      wheelRpm * profile.transmission.gearRatios[2]! * profile.transmission.finalDrive;
    expect(rpm).toBeCloseTo(
      Math.min(profile.engine.redlineRpm, Math.max(profile.engine.idleRpm * 0.85, expected)),
      4,
    );
  });
});
