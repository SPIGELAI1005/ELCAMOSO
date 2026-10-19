import { describe, expect, it } from "vitest";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { validateShiftMap } from "@/lib/powertrain/shift-map";
import {
  RACE_FINAL_DRIVE_SCALE,
  RACE_LIMITER_FRACTION,
  SHIFT_MAP_PRESET_IDS,
  applyShiftPresetToProfile,
  buildRaceShiftMap,
  isShiftMapPresetId,
} from "@/lib/powertrain/shift-presets";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";

const GEAR_CARS = [
  "american-muscle-v8",
  "gt-v8",
  "racing-v10",
  "race-car",
  "rally-car",
  "flat-six-sport",
  "turbo-inline-6",
];

describe("Race shift mode (opt-in)", () => {
  it("is a selectable preset id", () => {
    expect(SHIFT_MAP_PRESET_IDS).toContain("race");
    expect(isShiftMapPresetId("race")).toBe(true);
  });

  it("only changes the profile when Race is chosen", () => {
    const base = getPowertrainProfile("racing-v10");
    const race = applyShiftPresetToProfile(base, "race");
    expect(race.engine.redlineRpm).toBe(Math.round(base.engine.redlineRpm * RACE_LIMITER_FRACTION));
    expect(race.transmission.finalDrive).toBeCloseTo(
      base.transmission.finalDrive * RACE_FINAL_DRIVE_SCALE,
      6,
    );
    expect(applyShiftPresetToProfile(base, "sport").transmission.finalDrive).toBe(
      base.transmission.finalDrive,
    );
    expect(applyShiftPresetToProfile(base, "legacy")).toBe(base);
  });

  it("builds a valid late-shift map for the gear cars", () => {
    for (const id of GEAR_CARS) {
      const race = applyShiftPresetToProfile(getPowertrainProfile(id), "race");
      const map = buildRaceShiftMap(race);
      expect(validateShiftMap(map, race).ok, id).toBe(true);
    }
  });

  it("revs into the limiter, bounces, then upshifts at full demand", () => {
    const sim = new PowertrainSimulator({ profileId: "racing-v10", shiftMapPreset: "race" });
    const limiter = sim.getProfile().engine.redlineRpm;
    let speed = 0;
    let limiterMs = 0;
    let cutTicks = 0;
    let firstUpshiftRpm = 0;
    let maxRpm = 0;
    for (let i = 0; i < 900 && !firstUpshiftRpm; i += 1) {
      speed = Math.min(120, speed + 0.016 * 14);
      const out = sim.tick(
        {
          ...IDLE_VEHICLE_MOTION,
          timestamp: 1_000 + i * 16,
          speedKmh: speed,
          primarySource: "simulator",
          fallbackTier: "browser",
          inferredThrottle: 1,
          accelerationMs2: 4,
          accelerationFiltered: 4,
        },
        0.016,
        { directThrottle: 1 },
      );
      maxRpm = Math.max(maxRpm, out.rpm);
      if (out.limiterActive) limiterMs += 16;
      if (out.limiterCut) cutTicks += 1;
      if (out.shifting && out.shiftDirection === "up") firstUpshiftRpm = out.mechanicalRpm;
    }
    expect(maxRpm).toBeLessThanOrEqual(limiter + 1);
    expect(maxRpm).toBeGreaterThan(limiter - 300);
    expect(limiterMs).toBeGreaterThanOrEqual(200);
    expect(limiterMs).toBeLessThanOrEqual(450);
    expect(cutTicks).toBeGreaterThan(0);
    expect(firstUpshiftRpm).toBeGreaterThan(0);
  });

  it("never reports limiter fields outside Race", () => {
    const sim = new PowertrainSimulator({ profileId: "racing-v10", shiftMapPreset: "sport" });
    let speed = 0;
    for (let i = 0; i < 600; i += 1) {
      speed = Math.min(120, speed + 0.016 * 14);
      const out = sim.tick(
        {
          ...IDLE_VEHICLE_MOTION,
          timestamp: 1_000 + i * 16,
          speedKmh: speed,
          primarySource: "simulator",
          fallbackTier: "browser",
          inferredThrottle: 1,
          accelerationMs2: 4,
          accelerationFiltered: 4,
        },
        0.016,
        { directThrottle: 1 },
      );
      expect(out.limiterActive).toBeUndefined();
      expect(out.limiterCut).toBeUndefined();
    }
  });
});
