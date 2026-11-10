import { describe, expect, it } from "vitest";
import {
  CALM_CABIN_MAX_LINEAR,
  DEFAULT_CALM_CABIN,
  DEFAULT_MATCH_VOLUME_TO_SPEED,
  DEFAULT_MATCH_VOLUME_TO_SPEED_INTENSITY,
  DEFAULT_NOISE_MASKING,
  NOISE_MASKING_LABEL,
  NOISE_MASKING_SIGN_IN_REMARK,
  ROAD_LOUDNESS_CAP_KMH,
  ROAD_LOUDNESS_CAPS,
  ROAD_LOUDNESS_KNEE_KMH,
  calmCabinGainLinear,
  effectiveNoiseMaskingAudio,
  isNoiseMaskingAllowed,
  roadLoudnessAmount,
  roadLoudnessTargets,
  sanitizeRoadLoudnessIntensity,
  smoothRoadSpeedKmh,
} from "@/lib/sound/road-cabin";
import { DEFAULT_SETTINGS, mergeBackup, parseBackup, sanitizeSettings } from "@/lib/drive/settings";
import { dbToLinear } from "@/lib/sound/gain-staging/compute";

describe("road loudness curve", () => {
  it("is zero at and below the knee, including invalid speeds", () => {
    expect(roadLoudnessAmount(0)).toBe(0);
    expect(roadLoudnessAmount(ROAD_LOUDNESS_KNEE_KMH)).toBe(0);
    expect(roadLoudnessAmount(29.9)).toBe(0);
    expect(roadLoudnessAmount(-20)).toBe(0);
    expect(roadLoudnessAmount(Number.NaN)).toBe(0);
  });

  it("reaches 1 at and above the cap", () => {
    expect(roadLoudnessAmount(ROAD_LOUDNESS_CAP_KMH)).toBe(1);
    expect(roadLoudnessAmount(200)).toBe(1);
  });

  it("eases between the knee and the cap", () => {
    const early = roadLoudnessAmount(50);
    const mid = roadLoudnessAmount(80);
    const late = roadLoudnessAmount(110);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(mid);
    expect(mid).toBeLessThan(1);
    expect(late).toBeGreaterThan(mid);
    expect(late).toBeLessThan(1);
    // Smoothstep is below a linear ramp in the first half of the window.
    const linearEarly =
      (50 - ROAD_LOUDNESS_KNEE_KMH) / (ROAD_LOUDNESS_CAP_KMH - ROAD_LOUDNESS_KNEE_KMH);
    expect(early).toBeLessThan(linearEarly);
  });

  it("applies Low/Medium/High caps and mutes at volume 0", () => {
    const highway = { speedKmh: 130, userVolume: 0.35, enabled: true as const };
    expect(roadLoudnessTargets({ ...highway, intensity: "low" })).toEqual({
      gainDb: ROAD_LOUDNESS_CAPS.low.gainDb,
      bassDb: ROAD_LOUDNESS_CAPS.low.bassDb,
      gainLinear: dbToLinear(ROAD_LOUDNESS_CAPS.low.gainDb),
    });
    expect(roadLoudnessTargets({ ...highway, intensity: "medium" }).gainDb).toBe(4);
    expect(roadLoudnessTargets({ ...highway, intensity: "high" }).bassDb).toBe(4);
    expect(roadLoudnessTargets({ ...highway, intensity: "low", userVolume: 0 })).toEqual({
      gainDb: 0,
      bassDb: 0,
      gainLinear: 1,
    });
    expect(roadLoudnessTargets({ ...highway, intensity: "high", enabled: false }).gainDb).toBe(0);
  });
});

describe("calm cabin gain", () => {
  it("is silent when off, at rest, or when the user volume is zero", () => {
    expect(calmCabinGainLinear({ enabled: false, speedKmh: 130, userVolume: 1 })).toBe(0);
    expect(calmCabinGainLinear({ enabled: true, speedKmh: 20, userVolume: 1 })).toBe(0);
    expect(calmCabinGainLinear({ enabled: true, speedKmh: 130, userVolume: 0 })).toBe(0);
  });

  it("follows speed up to the published cap", () => {
    expect(calmCabinGainLinear({ enabled: true, speedKmh: 130, userVolume: 0.35 })).toBeCloseTo(
      CALM_CABIN_MAX_LINEAR,
      8,
    );
    const mid = calmCabinGainLinear({ enabled: true, speedKmh: 80, userVolume: 0.35 });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(CALM_CABIN_MAX_LINEAR);
  });
});

describe("speed smoothing", () => {
  it("does not jump to a highway target in one frame", () => {
    const next = smoothRoadSpeedKmh(0, 130, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(20);
  });

  it("converges toward the target and treats invalid values as zero", () => {
    let kmh = 0;
    for (let i = 0; i < 80; i += 1) kmh = smoothRoadSpeedKmh(kmh, 130, 0.1);
    expect(kmh).toBeGreaterThan(125);
    expect(smoothRoadSpeedKmh(40, Number.NaN, 0.5)).toBeLessThan(40);
    expect(smoothRoadSpeedKmh(Number.NaN, 50, 10)).toBeCloseTo(50, 3);
  });
});

describe("settings sanitize and migration", () => {
  it("uses recommended defaults on a new device", () => {
    expect(NOISE_MASKING_LABEL).toBe("Road Noise Masking");
    expect(NOISE_MASKING_SIGN_IN_REMARK).toBe("Sign in to activate");
    expect(DEFAULT_SETTINGS.noiseMasking).toBe(DEFAULT_NOISE_MASKING);
    expect(DEFAULT_SETTINGS.matchVolumeToSpeed).toBe(DEFAULT_MATCH_VOLUME_TO_SPEED);
    expect(DEFAULT_SETTINGS.matchVolumeToSpeedIntensity).toBe(
      DEFAULT_MATCH_VOLUME_TO_SPEED_INTENSITY,
    );
    expect(DEFAULT_SETTINGS.calmCabin).toBe(DEFAULT_CALM_CABIN);
    const { settings } = sanitizeSettings({});
    expect(settings.noiseMasking).toBe(true);
    expect(settings.matchVolumeToSpeed).toBe(true);
    expect(settings.matchVolumeToSpeedIntensity).toBe("low");
    expect(settings.calmCabin).toBe(false);
  });

  it("sanitizes malformed intensity and flags", () => {
    expect(sanitizeRoadLoudnessIntensity("extreme")).toBe("low");
    expect(sanitizeRoadLoudnessIntensity("high")).toBe("high");
    const { settings } = sanitizeSettings({
      noiseMasking: "yes",
      matchVolumeToSpeed: "yes",
      matchVolumeToSpeedIntensity: "loud",
      calmCabin: 1,
    });
    expect(settings.noiseMasking).toBe(true);
    expect(settings.matchVolumeToSpeed).toBe(true);
    expect(settings.matchVolumeToSpeedIntensity).toBe("low");
    expect(settings.calmCabin).toBe(false);
  });

  it("preserves a saved off/high choice and migrates v9 backups to defaults", () => {
    const saved = sanitizeSettings({
      noiseMasking: false,
      matchVolumeToSpeed: false,
      matchVolumeToSpeedIntensity: "high",
      calmCabin: true,
    }).settings;
    expect(saved.noiseMasking).toBe(false);
    expect(saved.matchVolumeToSpeed).toBe(false);
    expect(saved.matchVolumeToSpeedIntensity).toBe("high");
    expect(saved.calmCabin).toBe(true);

    const { settings, report } = parseBackup(
      JSON.stringify({
        kind: "elcamoso.settings.backup",
        version: 9,
        settings: { profileId: "gt-v8", volume: 0.5 },
      }),
    );
    expect(settings.noiseMasking).toBe(true);
    expect(settings.matchVolumeToSpeed).toBe(true);
    expect(settings.matchVolumeToSpeedIntensity).toBe("low");
    expect(settings.calmCabin).toBe(false);
    expect(report.migrations.some((m) => /noise masking/i.test(m))).toBe(true);
  });

  it("keeps match-volume and calm-cabin settings device-local on merge", () => {
    const current = sanitizeSettings({
      noiseMasking: false,
      matchVolumeToSpeed: false,
      matchVolumeToSpeedIntensity: "high",
      calmCabin: true,
      volume: 0.4,
    }).settings;
    const incoming = sanitizeSettings({
      noiseMasking: true,
      matchVolumeToSpeed: true,
      matchVolumeToSpeedIntensity: "low",
      calmCabin: false,
      volume: 0.9,
    }).settings;
    const merged = mergeBackup(current, incoming).settings;
    expect(merged.noiseMasking).toBe(false);
    expect(merged.matchVolumeToSpeed).toBe(false);
    expect(merged.matchVolumeToSpeedIntensity).toBe("high");
    expect(merged.calmCabin).toBe(true);
    expect(merged.volume).toBe(0.4);
  });
});

describe("Noise masking access", () => {
  it("allows only signed-in users and forces audio off when signed out", () => {
    expect(isNoiseMaskingAllowed(true)).toBe(true);
    expect(isNoiseMaskingAllowed(false)).toBe(false);
    const signedOut = effectiveNoiseMaskingAudio({
      isSignedIn: false,
      noiseMasking: true,
      matchVolumeToSpeed: true,
      calmCabin: true,
    });
    expect(signedOut).toEqual({ matchVolumeToSpeed: false, calmCabin: false });
    const signedIn = effectiveNoiseMaskingAudio({
      isSignedIn: true,
      noiseMasking: true,
      matchVolumeToSpeed: true,
      calmCabin: false,
    });
    expect(signedIn).toEqual({ matchVolumeToSpeed: true, calmCabin: false });
    const masterOff = effectiveNoiseMaskingAudio({
      isSignedIn: true,
      noiseMasking: false,
      matchVolumeToSpeed: true,
      calmCabin: true,
    });
    expect(masterOff).toEqual({ matchVolumeToSpeed: false, calmCabin: false });
  });
});
