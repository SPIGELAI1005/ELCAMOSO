import { describe, expect, it } from "vitest";
import { PUBLIC_PROFILE_IDS } from "@/lib/sound/profile-experience-config";
import {
  profileExperienceConfig,
  profileExperienceConfigBase,
} from "@/lib/sound/profile-experience-config";
import {
  acousticEngineBaseForProfile,
  acousticEngineForProfile,
  isCombustionRealismV2Profile,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  CATALOG_TUNING_BY_PROFILE,
  FAMILY_DEFAULTS,
  allCatalogTuningEntries,
  catalogTuningForProfile,
  emptyListeningRubric,
} from "@/lib/sound/realism/catalog-tuning";
import { LISTENING_RUBRIC_DIMENSIONS } from "@/lib/sound/realism/catalog-tuning/listening-rubric";

describe("Prompt 07 catalog tuning", () => {
  it("covers the live public catalog (57) with one distinct row per ID", () => {
    expect(PUBLIC_PROFILE_IDS).toHaveLength(57);
    const entries = allCatalogTuningEntries();
    expect(entries).toHaveLength(57);
    expect(Object.keys(CATALOG_TUNING_BY_PROFILE).sort()).toEqual([...PUBLIC_PROFILE_IDS].sort());
    const ids = new Set(entries.map((e) => e.profileId));
    expect(ids.size).toBe(57);
  });

  it("gives every row a concrete outcome or explicit blocker", () => {
    for (const entry of allCatalogTuningEntries()) {
      expect(entry.outcome, entry.profileId).toBeTruthy();
      expect(entry.audibleRationale.length, entry.profileId).toBeGreaterThan(12);
      expect(entry.changedCode.length, entry.profileId).toBeGreaterThan(0);
      expect(entry.humanListeningStatus, entry.profileId).toBe("unverified");
      expect(entry.deviceStatus, entry.profileId).toBe("unverified");
      if (entry.outcome.startsWith("blocked")) {
        expect(entry.blocker, entry.profileId).toBeTruthy();
      }
      expect(entry.acousticOverlay || entry.experienceOverlay, entry.profileId).toBeTruthy();
    }
  });

  it("does not use identical experience overlays across all IDs", () => {
    const fingerprints = allCatalogTuningEntries().map((e) =>
      JSON.stringify({ a: e.acousticOverlay ?? null, x: e.experienceOverlay ?? null }),
    );
    expect(new Set(fingerprints).size).toBeGreaterThan(40);
  });

  it("applies combustion acoustic overlays distinctly for V2 engines", () => {
    const combustion = PUBLIC_PROFILE_IDS.filter((id) => isCombustionRealismV2Profile(id));
    expect(combustion.length).toBe(9);
    for (const id of combustion) {
      const base = acousticEngineBaseForProfile(id)!;
      const tuned = acousticEngineForProfile(id)!;
      const entry = catalogTuningForProfile(id)!;
      expect(entry.acousticOverlay, id).toBeTruthy();
      // At least one scalar differs vs untuned archetype.
      const keys = [
        "exhaustPulse",
        "intakePresence",
        "mechanicalIntensity",
        "bodyBrightness",
        "upperRpmEnergy",
        "idleIrregularity",
        "loadContrast",
      ] as const;
      const changed = keys.some((k) => Math.abs(base[k] - tuned[k]) > 1e-6);
      expect(changed, id).toBe(true);
    }
  });

  it("keeps family guidance distinctions: muscle vs flat-six vs turbo I6 vs race", () => {
    const muscle = acousticEngineForProfile("american-muscle-v8")!;
    const flat = acousticEngineForProfile("flat-six-sport")!;
    const turbo = acousticEngineForProfile("turbo-inline-6")!;
    const v10 = acousticEngineForProfile("racing-v10")!;
    expect(muscle.exhaustPulse).toBeGreaterThan(flat.exhaustPulse);
    expect(flat.mechanicalIntensity).toBeGreaterThan(muscle.mechanicalIntensity);
    expect(flat.intakePresence).toBeGreaterThan(muscle.intakePresence);
    expect(turbo.intakePresence).toBeLessThan(0.45);
    expect(turbo.intakeLoadResponse).toBeGreaterThan(turbo.intakePresence);
    expect(v10.upperRpmEnergy).toBeGreaterThan(muscle.upperRpmEnergy);
    expect(muscle.upperRpmEnergy).toBeLessThan(0.35);
  });

  it("applies experience overlays for every public ID at runtime", () => {
    for (const id of PUBLIC_PROFILE_IDS) {
      const base = profileExperienceConfigBase(id)!;
      const tuned = profileExperienceConfig(id)!;
      const entry = catalogTuningForProfile(id)!;
      expect(entry.experienceOverlay || entry.acousticOverlay, id).toBeTruthy();
      if (entry.experienceOverlay?.phases) {
        for (const [key, value] of Object.entries(entry.experienceOverlay.phases)) {
          if (typeof value === "number") {
            expect((tuned.phases as Record<string, number>)[key], `${id}.${key}`).toBeCloseTo(
              value,
              5,
            );
          }
        }
      }
      expect(tuned.transitionTauSeconds).toBeGreaterThanOrEqual(0.04);
      // Base remains available for A/B.
      expect(base).not.toBe(tuned);
    }
  });

  it("exposes family defaults for design hints without forcing identical presets", () => {
    expect(Object.keys(FAMILY_DEFAULTS).length).toBeGreaterThanOrEqual(8);
    const muscleHint = allCatalogTuningEntries().filter((e) => e.designFamilyHint === "cross-plane-muscle-v8");
    expect(muscleHint.map((e) => e.profileId).sort()).toEqual(["american-muscle-v8", "big-twin"].sort());
    expect(muscleHint[0].audibleRationale).not.toEqual(muscleHint[1].audibleRationale);
  });

  it("keeps listening rubric empty until humans score", () => {
    const rubric = emptyListeningRubric();
    for (const dim of LISTENING_RUBRIC_DIMENSIONS) {
      expect(rubric[dim]).toBeNull();
    }
    expect(rubric.scoredBy).toBeNull();
    expect(rubric.loudnessMatched).toBe(false);
  });

  it("does not invent a diesel acoustic engine ID", () => {
    expect(isCombustionRealismV2Profile("wiesn-tractor")).toBe(false);
    expect(acousticEngineForProfile("wiesn-tractor")).toBeNull();
    const tractor = catalogTuningForProfile("wiesn-tractor")!;
    expect(tractor.designFamilyHint).toBe("heavy-mechanical");
    expect(tractor.sampleStatus).toBe("asset-pending");
    expect(tractor.chosenRenderer).toBe("improved-strategy");
    expect(tractor.blocker).toMatch(/diesel|acoustic|recording/i);
  });
});
