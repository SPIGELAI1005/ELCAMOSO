import { describe, expect, it } from "vitest";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access-config";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { getProfile } from "@/lib/sound/profiles";
import {
  acousticEngineForProfile,
  isCombustionRealismV2Profile,
} from "@/lib/sound/realism/v2/acoustic-engine";
import { combustionTopologyForProfile } from "@/lib/sound/realism/v2/combustion-topology";
import { speedKmhFromRpmAndGear } from "@/lib/powertrain/rpm-model";
import { resolveSpeedUnit, profileUsesKnots, profileUsesLightSpeed } from "@/lib/drive/speed-units";

describe("F1 V10 sound profile", () => {
  it("is a Drive+ (not free) fully synthesised V2 combustion profile with a picture", () => {
    const p = getProfile("f1-v10");
    expect(p.id).toBe("f1-v10");
    expect(FREE_SOUND_PROFILE_IDS).not.toContain("f1-v10");
    expect(isCombustionRealismV2Profile("f1-v10")).toBe(true);
    expect(profileHeroImageSrc("f1-v10")).toBeTruthy();
    expect(acousticEngineForProfile("f1-v10")?.redlineRpm).toBe(19000);
    expect(acousticEngineForProfile("f1-v10")?.supportRatios[0]).toBe(2.5);
    expect(combustionTopologyForProfile("f1-v10")?.cylinderCount).toBe(10);
    // Land car: road speed in km/h (metric), never knots / fraction of c.
    expect(profileUsesKnots("f1-v10")).toBe(false);
    expect(profileUsesLightSpeed("f1-v10")).toBe(false);
    expect(resolveSpeedUnit("metric", "f1-v10", true)).toBe("kmh");
  });

  it("idles at 4-5k, redlines at 19k, seven close gears, fast slew and ~35 ms upshifts", () => {
    const d = resolveDrivetrain(getProfile("f1-v10"));
    expect(d.personalityId).toBe("f1-v10");
    const pt = d.powertrain;
    expect(pt.engine.idleRpm).toBeGreaterThanOrEqual(4000);
    expect(pt.engine.idleRpm).toBeLessThanOrEqual(5000);
    expect(pt.engine.redlineRpm).toBe(19000);
    expect(pt.transmission.gears).toBe(7);
    expect(pt.transmission.rpm.maxRateRpmPerSec).toBeGreaterThanOrEqual(30000);
    expect(pt.transmission.shift.upshiftDurationMs).toBeGreaterThanOrEqual(30);
    expect(pt.transmission.shift.upshiftDurationMs).toBeLessThanOrEqual(40);
    // Road-compressed ratios: 1st tops out ~45 km/h, 7th ~170 km/h at 18.5k rpm.
    expect(speedKmhFromRpmAndGear(18500, 1, pt)).toBeGreaterThan(40);
    expect(speedKmhFromRpmAndGear(18500, 1, pt)).toBeLessThan(50);
    expect(speedKmhFromRpmAndGear(18500, 7, pt)).toBeGreaterThan(160);
    expect(speedKmhFromRpmAndGear(18500, 7, pt)).toBeLessThan(180);
  });
});
