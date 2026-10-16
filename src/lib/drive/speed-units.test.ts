import { describe, expect, it } from "vitest";
import {
  convertSpeedKmh,
  convertSpeedMps,
  defaultUnitsForLocale,
  formatLightFraction,
  KNOTS_PROFILE_IDS,
  LIGHT_SPEED_PROFILE_IDS,
  resolveSpeedUnit,
  speedUnitLabel,
} from "@/lib/drive/speed-units";
import { formatSpeed } from "@/lib/i18n";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { DEFAULT_SETTINGS } from "@/lib/drive/settings";

describe("speed units", () => {
  it("converts 1 kn = 1.852 km/h and mph", () => {
    expect(convertSpeedKmh(1.852, "kn")).toBeCloseTo(1, 9);
    expect(convertSpeedKmh(100, "kn")).toBeCloseTo(53.996, 3);
    expect(convertSpeedMps(10, "kmh")).toBeCloseTo(36, 9);
    expect(convertSpeedKmh(100, "mph")).toBeCloseTo(62.137, 2);
  });

  it("formats light-speed fractions readably", () => {
    expect(formatLightFraction(0)).toBe("0");
    expect(formatLightFraction(25)).toBe("8.3 × 10⁻⁸");
    expect(formatLightFraction(299_792_458)).toBe("1.0 × 10⁰");
    expect(formatLightFraction(29.9792458 * 0.9999)).toBe("1.0 × 10⁻⁷");
  });

  it("maps boats/aircraft to knots and space to c; rocket car and land vehicles keep units", () => {
    for (const id of [
      "speed-boat",
      "cruise-ship",
      "jet-ski",
      "submarine",
      "turbine-jet",
      "helicopter",
      "private-jet",
      "storm-glider",
    ]) {
      expect(resolveSpeedUnit("metric", id, true)).toBe("kn");
      expect(resolveSpeedUnit("imperial", id, false)).toBe("mph");
    }
    for (const id of ["space-ship", "ufo", "world-space-drive"]) {
      expect(resolveSpeedUnit("metric", id, true)).toBe("c");
      expect(resolveSpeedUnit("metric", id, false)).toBe("kmh");
    }
    for (const id of ["rocket-car", "gt-v8", "maglev-train", "high-speed-train", "steam-train"]) {
      expect(resolveSpeedUnit("metric", id, true)).toBe("kmh");
      expect(resolveSpeedUnit("imperial", id, true)).toBe("mph");
    }
    const known = new Set(SOUND_PROFILES.map((p) => p.id));
    for (const id of [...KNOTS_PROFILE_IDS, ...LIGHT_SPEED_PROFILE_IDS])
      expect(known.has(id)).toBe(true);
    for (const p of SOUND_PROFILES) {
      if (p.category === "Nautical" || p.category === "Aviation")
        expect(KNOTS_PROFILE_IDS.has(p.id)).toBe(true);
    }
    expect(speedUnitLabel("kn")).toBe("kn");
  });

  it("formatSpeed honours units and themed units", () => {
    expect(formatSpeed(25, "metric", "en")).toMatchObject({ value: 90, unit: "km/h", text: "90" });
    expect(formatSpeed(25, "imperial", "en")).toMatchObject({ value: 56, unit: "mph" });
    expect(
      formatSpeed(25, "metric", "de", { profileId: "speed-boat", knotsForNautical: true }),
    ).toMatchObject({ value: 49, unit: "kn" });
    expect(
      formatSpeed(25, "metric", "ro", { profileId: "ufo", knotsForNautical: true }),
    ).toMatchObject({ unit: "c", text: "8.3 × 10⁻⁸" });
  });

  it("locale defaults: en-US/en-GB mph, others km/h; themed units default on", () => {
    expect(defaultUnitsForLocale("en-US")).toBe("imperial");
    expect(defaultUnitsForLocale("en-GB")).toBe("imperial");
    expect(defaultUnitsForLocale("de-DE")).toBe("metric");
    expect(defaultUnitsForLocale("ro")).toBe("metric");
    expect(defaultUnitsForLocale(undefined)).toBe("metric");
    expect(DEFAULT_SETTINGS.knotsForNautical).toBe(true);
  });
});
