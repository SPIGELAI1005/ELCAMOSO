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
  it("defines twelve distinct built-in personalities", () => {
    expect(DRIVETRAIN_PERSONALITY_IDS).toHaveLength(12);
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("high-rev-v10");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("flat-plane-v8-track");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("rally-turbo-3");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("motorcycle-inline-4");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("v-twin-cruiser");
    expect(DRIVETRAIN_PERSONALITY_IDS).toContain("single-cylinder-ag");
  });

  it("lists the dedicated core engine personalities", () => {
    expect(CORE_DRIVETRAIN_PERSONALITY_IDS).toEqual([
      "flat-six-sport",
      "high-rev-v10",
      "flat-plane-v8-track",
      "rally-turbo-3",
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

  it("maps Electric Hyperdrive sound profile to synthetic-ev personality", () => {
    const resolved = resolveDrivetrain(getProfile("electric-hypercar"));
    expect(resolved.personalityId).toBe("synthetic-ev");
    expect(getProfile("electric-hypercar").drivetrainMode).toBe("virtual-transmission");
  });

  it("maps featured sound profiles to core personalities", () => {
    expect(resolveDrivetrain(getProfile("gt-v8")).personalityId).toBe("gt-v8");
    expect(resolveDrivetrain(getProfile("racing-v10")).personalityId).toBe("high-rev-v10");
    expect(resolveDrivetrain(getProfile("race-car")).personalityId).toBe("flat-plane-v8-track");
    expect(resolveDrivetrain(getProfile("rally-car")).personalityId).toBe("rally-turbo-3");
    expect(resolveDrivetrain(getProfile("american-muscle-v8")).personalityId).toBe("american-v8");
    expect(resolveDrivetrain(getProfile("turbo-inline-6")).personalityId).toBe("turbo-inline-6");
  });

  it("keeps V10, track V8, rally, and flat-six gear behavior distinct", () => {
    const v10 = resolveDrivetrain(getProfile("racing-v10")).personality;
    const track = resolveDrivetrain(getProfile("race-car")).personality;
    const rally = resolveDrivetrain(getProfile("rally-car")).personality;
    const flatSix = resolveDrivetrain(getProfile("flat-six-sport")).personality;

    // Spec §4.5: Racing V10 is 6-speed ASG-type (LFA-class)
    expect(v10.transmission.gearRatios).toHaveLength(6);
    // Spec §4.6: Race Car is 7-speed DCT (458-type)
    expect(track.transmission.gearRatios).toHaveLength(7);
    expect(rally.transmission.gearRatios).toHaveLength(6); // GR Yaris 6-speed per spec §4
    expect(flatSix.transmission.gearRatios).toHaveLength(7);
    // Track V8 and Flat-Six now both have 9000 redline per spec;
    // verify distinct by comparing final drive instead (5.14 vs 3.44)
    expect(track.transmission.finalDrive).not.toBe(flatSix.transmission.finalDrive);
    expect(rally.transient.aspiration).toBe("turbo");
    expect(v10.transmission.shift.upshiftDurationMs).toBeGreaterThan(
      track.transmission.shift.upshiftDurationMs,
    );
  });

  it("maps motorcycle, twin, and tractor profiles to dedicated personalities", () => {
    expect(resolveDrivetrain(getProfile("motorcycle-superbike")).personalityId).toBe(
      "motorcycle-inline-4",
    );
    expect(resolveDrivetrain(getProfile("big-twin")).personalityId).toBe("v-twin-cruiser");
    expect(resolveDrivetrain(getProfile("wiesn-tractor")).personalityId).toBe("single-cylinder-ag");
  });
});
