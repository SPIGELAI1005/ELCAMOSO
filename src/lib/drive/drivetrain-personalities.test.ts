import { describe, expect, it } from "vitest";
import {
  CORE_DRIVETRAIN_PERSONALITY_IDS,
  DRIVETRAIN_PERSONALITY_IDS,
  getDrivetrainPersonality,
} from "@/lib/drive/drivetrain-personalities";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { getProfile } from "@/lib/sound/profiles";
import { resolveVariantPools } from "@/lib/sound/dynamic-drive/transient-scheduler";

describe("drivetrain personalities", () => {
  it("defines eight distinct built-in personalities", () => {
    expect(DRIVETRAIN_PERSONALITY_IDS).toHaveLength(8);
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("motorcycle-inline-4");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("v-twin-cruiser");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("single-cylinder-ag");
  });

  it("lists five core launch personalities", () => {
    expect(CORE_DRIVETRAIN_PERSONALITY_IDS).toEqual([
      "flat-six-sport",
      "american-v8",
      "turbo-inline-6",
      "gt-v8",
      "synthetic-ev",
    ]);
  });

  it("core five differ in gears, RPM range, shift timing, kickdown, response, overrun, transients", () => {
    const flat = getDrivetrainPersonality("flat-six-sport");
    const muscle = getDrivetrainPersonality("american-v8");
    const turbo = getDrivetrainPersonality("turbo-inline-6");
    const gt = getDrivetrainPersonality("gt-v8");
    const ev = getDrivetrainPersonality("synthetic-ev");

    expect(flat.transmission.gearRatios.length).toBe(7);
    expect(muscle.transmission.gearRatios.length).toBe(5);
    expect(turbo.transmission.gearRatios.length).toBe(7);
    expect(gt.transmission.gearRatios.length).toBe(6);
    expect(ev.transmission.gearRatios.length).toBe(6);

    expect(ev.engine.redlineRpm).toBeGreaterThan(flat.engine.redlineRpm);
    expect(flat.engine.redlineRpm).toBeGreaterThan(muscle.engine.redlineRpm);

    expect(muscle.transmission.shift.upshiftDurationMs).toBeGreaterThan(
      gt.transmission.shift.upshiftDurationMs,
    );
    expect(ev.transmission.shift.upshiftDurationMs).toBeLessThan(
      flat.transmission.shift.upshiftDurationMs,
    );

    const flatSpread = flat.transmission.gearRatios[0]! / flat.transmission.gearRatios.at(-1)!;
    const muscleSpread =
      muscle.transmission.gearRatios[0]! / muscle.transmission.gearRatios.at(-1)!;
    expect(flatSpread).toBeGreaterThan(muscleSpread);

    expect(ev.transmission.gearRatios[0]).toBeGreaterThan(gt.transmission.gearRatios[0]);

    expect(turbo.transmission.kickdown.rpmFractionOfUpshift).toBeGreaterThan(
      muscle.transmission.kickdown.rpmFractionOfUpshift,
    );
    expect(ev.transmission.kickdown.throttleThreshold).toBeLessThan(
      muscle.transmission.kickdown.throttleThreshold,
    );

    expect(ev.behavior.engineResponse).toBeGreaterThan(muscle.behavior.engineResponse);
    expect(muscle.throttle.attackTau).toBeGreaterThan(ev.throttle.attackTau);

    expect(muscle.overrun.probability).toBeGreaterThan(ev.overrun.probability);
    expect(muscle.overrun.probability).toBeGreaterThan(gt.overrun.probability);

    expect(ev.transmission.shift.revMatchEnabled).toBe(false);
    expect(flat.transmission.shift.revMatchEnabled).toBe(true);
    expect(ev.transient.revMatchStrength).toBe(0);
    expect(flat.transient.upshiftStrength).toBeGreaterThan(ev.transient.upshiftStrength);

    expect(turbo.transient.aspiration).toBe("turbo");
    expect(ev.transient.aspiration).toBe("electric");
    expect(resolveVariantPools(turbo.transient).turboFlutter.length).toBeGreaterThan(0);
    expect(resolveVariantPools(muscle.transient).overrun.length).toBeGreaterThan(1);
  });

  it("resolves from Sound Profile personality id", () => {
    const resolved = resolveDrivetrain(getProfile("flat-six-sport"));
    expect(resolved.personalityId).toBe("flat-six-sport");
    expect(resolved.powertrain.transmission.gears).toBe(7);
  });

  it("maps Synthetic Hyper EV sound profile to synthetic-ev personality", () => {
    const resolved = resolveDrivetrain(getProfile("electric-hypercar"));
    expect(resolved.personalityId).toBe("synthetic-ev");
    expect(getProfile("electric-hypercar").drivetrainMode).toBe("virtual-transmission");
  });

  it("maps featured sound profiles to core personalities", () => {
    expect(resolveDrivetrain(getProfile("gt-v8")).personalityId).toBe("gt-v8");
    expect(resolveDrivetrain(getProfile("american-muscle-v8")).personalityId).toBe("american-v8");
    expect(resolveDrivetrain(getProfile("turbo-inline-6")).personalityId).toBe("turbo-inline-6");
  });

  it("maps motorcycle, twin, and tractor profiles to dedicated personalities", () => {
    expect(resolveDrivetrain(getProfile("motorcycle-superbike")).personalityId).toBe(
      "motorcycle-inline-4",
    );
    expect(resolveDrivetrain(getProfile("big-twin")).personalityId).toBe("v-twin-cruiser");
    expect(resolveDrivetrain(getProfile("wiesn-tractor")).personalityId).toBe("single-cylinder-ag");
  });
});
