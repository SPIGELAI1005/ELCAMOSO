import { describe, expect, it } from "vitest";
import {
  PROFILE_CATEGORIES,
  SOUND_PROFILES,
  getProfile,
  type MotionModel,
  type SourceMode,
} from "@/lib/sound/profiles";
import { EXPANSION_PROFILES } from "@/lib/sound/profiles-expansion";
import { FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access-config";
import { getStrategy, listStrategyIds } from "@/lib/sound/realism/strategies";
import { familyForProfile } from "@/lib/sound/realism/families";

const MOTION_MODELS = new Set<MotionModel>([
  "virtual-transmission",
  "continuous",
  "cadence",
  "ambient",
  "event-driven",
  "physical-machine",
]);

const SOURCE_MODES = new Set<SourceMode>(["procedural", "sample", "hybrid"]);

const EXPECTED_NEW_IDS = [
  "flat-six-sport",
  "american-muscle-v8",
  "turbo-inline-6",
  "electric-hypercar",
  "formula-electric",
  "neon-drive",
  "maglev-train",
  "high-speed-train",
  "submarine",
  "jet-ski",
  "motorcycle-superbike",
  "big-twin",
  "snowmobile",
  "tank",
  "construction-monster",
  "horse-gallop",
  "dragon",
  "thunder-beast",
  "retro-arcade",
  "synthwave-drive",
  "deep-bass-pulse",
  "zen-drive",
  "rain-drive",
  "ocean-drive",
  "heartbeat",
];

describe("built-in sound profiles", () => {
  it("has 47 built-in profiles", () => {
    expect(SOUND_PROFILES).toHaveLength(47);
    expect(EXPANSION_PROFILES).toHaveLength(25);
  });

  it("has unique ids and names", () => {
    const ids = SOUND_PROFILES.map((p) => p.id);
    const names = SOUND_PROFILES.map((p) => p.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("registers all expansion profile ids", () => {
    for (const id of EXPECTED_NEW_IDS) {
      expect(SOUND_PROFILES.some((p) => p.id === id)).toBe(true);
      expect(getProfile(id).id).toBe(id);
    }
  });

  it("uses valid categories", () => {
    const allowed = new Set(PROFILE_CATEGORIES);
    for (const p of SOUND_PROFILES) {
      expect(allowed.has(p.category)).toBe(true);
    }
  });

  it("has required metadata", () => {
    for (const p of SOUND_PROFILES) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.traits).toHaveLength(3);
      expect(p.description.length).toBeGreaterThan(10);
      expect(["virtual-transmission", "continuous"]).toContain(p.drivetrainMode);
      expect(p.voice.harmonics.length).toBeGreaterThan(0);
      expect(p.access).toMatch(/^(free|drive_plus)$/);
      if (p.drivetrainMode === "virtual-transmission") {
        expect(p.transmission).toBeDefined();
        expect(p.transmission!.gearRatios.length).toBeGreaterThan(0);
        expect(p.transmission!.idleRpm).toBeLessThan(p.transmission!.redlineRpm);
      } else {
        expect(p.transmission).toBeUndefined();
      }
    }
  });

  it("validates expansion motion and source modes", () => {
    for (const p of EXPANSION_PROFILES) {
      expect(p.motionModel).toBeDefined();
      expect(MOTION_MODELS.has(p.motionModel!)).toBe(true);
      expect(p.sourceMode).toBeDefined();
      expect(SOURCE_MODES.has(p.sourceMode!)).toBe(true);
      if (p.id === "electric-hypercar") {
        expect(p.drivetrainMode).toBe("virtual-transmission");
        expect(p.drivetrainPersonalityId).toBe("synthetic-ev");
      }
    }
  });

  it("has an improved strategy for every built-in profile", () => {
    const ids = listStrategyIds();
    expect(ids.length).toBeGreaterThanOrEqual(47);
    for (const p of SOUND_PROFILES) {
      expect(getStrategy(p.id), `missing strategy for ${p.id}`).not.toBeNull();
      expect(familyForProfile(p)).toBeTruthy();
    }
  });

  it("marks configurable free profiles as free access", () => {
    for (const id of FREE_SOUND_PROFILE_IDS) {
      expect(getProfile(id).access).toBe("free");
    }
    expect(getProfile("dragon").access).toBe("drive_plus");
  });

  it("keeps ambient profiles valid at idle", () => {
    for (const id of ["zen-drive", "rain-drive", "ocean-drive", "deep-bass-pulse", "heartbeat"]) {
      const p = getProfile(id);
      expect(p.drivetrainMode).toBe("continuous");
      expect(p.voice.baseFrequency).toBeGreaterThan(0);
    }
  });
});
