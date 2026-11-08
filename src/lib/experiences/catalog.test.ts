import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_FAMILIES,
  canAccessExperience,
  experienceForProfileId,
  getExperienceFlags,
  listFusionExperiences,
  listSymphonyExperiences,
  listWorldPageExperiences,
  listWorldPageHeroIds,
  listWorldExperiences,
} from "@/lib/experiences";
import { entitlementsForPlan } from "@/lib/entitlements/plans";
import type { Entitlement, Plan } from "@/lib/entitlements/types";

describe("experiences catalog", () => {
  const accessFor = (plan: Plan) => {
    const grants = new Set(entitlementsForPlan(plan));
    return (entitlement: Entitlement) => grants.has(entitlement);
  };

  it("gives Free one Symphony and one Worlds sampler while reserving Fusion for Drive the Music", () => {
    const symphonies = listSymphonyExperiences();
    const worlds = listWorldExperiences();
    const fusion = listFusionExperiences();
    expect(
      symphonies
        .filter((item) => canAccessExperience(item, accessFor("FREE")))
        .map((item) => item.id),
    ).toEqual(["symphony-latino-fiesta"]);
    expect(worlds.filter((item) => canAccessExperience(item, accessFor("FREE")))).toHaveLength(0);
    expect(fusion.every((item) => !canAccessExperience(item, accessFor("FREE")))).toBe(true);
    expect(fusion.every((item) => canAccessExperience(item, accessFor("DRIVE_MUSIC")))).toBe(true);
  });

  it("defines four product families with routes", () => {
    expect(EXPERIENCE_FAMILIES.map((f) => f.kind)).toEqual([
      "engine",
      "symphony",
      "world",
      "fusion",
    ]);
    expect(EXPERIENCE_FAMILIES.find((f) => f.kind === "engine")?.href).toBe("/sounds");
  });

  it("curates worlds onto World engine or SoundProfiles", () => {
    const worlds = listWorldExperiences();
    expect(worlds.length).toBeGreaterThanOrEqual(5);
    expect(worlds.find((w) => w.id === "world-space-drive")?.capabilities.profileId).toBe(
      "world-space-drive",
    );
    for (const w of worlds) {
      expect(w.capabilities.profileId).toBeTruthy();
    }
  });

  it("exposes Fusion presets when flag on", () => {
    const flags = getExperienceFlags();
    const fusion = listFusionExperiences();
    expect(fusion.length).toBeGreaterThanOrEqual(4);
    if (flags.fusion) {
      expect(fusion.every((f) => f.capabilities.selectableInDrive)).toBe(true);
    }
  });

  it("lists the moved sounds on the Worlds page and keeps them off the Symphony packs", () => {
    const moved = [
      "retro-arcade",
      "synthwave-drive",
      "deep-bass-pulse",
      "heartbeat",
      "bollywood-rickshaw",
      "dracula-carriage",
      "fusion-road-anthem",
      "fusion-mechanical-symphony",
      "fusion-midnight-boost",
      "fusion-future-pulse",
    ];
    const page = listWorldPageExperiences().map((item) => item.capabilities.profileId);
    const packs = listSymphonyExperiences().map((item) => item.capabilities.profileId);
    for (const id of moved) {
      expect(page.filter((value) => value === id)).toHaveLength(1);
      expect(packs).not.toContain(id);
    }
    expect(page.filter((id) => id === "world-space-drive")).toHaveLength(1);
    expect(new Set(listWorldPageExperiences().map((item) => item.id)).size).toBe(page.length);
    const heroes = listWorldPageHeroIds();
    expect(heroes.slice(0, moved.length)).toEqual(moved);
    for (const id of ["world-space-drive", "world-cyber-city", "world-storm-run", "ocean-drive"]) {
      expect(heroes).toContain(id);
    }
  });

  it("keeps symphony selectable when flag on", () => {
    const flags = getExperienceFlags();
    if (flags.symphony) {
      const shells = listSymphonyExperiences();
      expect(
        shells.find((s) => s.id === "symphony-cinematic-rock")?.capabilities.selectableInDrive,
      ).toBe(true);
      expect(shells.find((s) => s.id === "symphony-neon-run")?.capabilities.selectableInDrive).toBe(
        true,
      );
    }
  });

  it("maps active profile to experience kind", () => {
    expect(experienceForProfileId("gt-v8").kind).toBe("engine");
    expect(experienceForProfileId("world-cyber-city").kind).toBe("world");
    expect(experienceForProfileId("symphony-cinematic-rock").kind).toBe("symphony");
    expect(experienceForProfileId("fusion-road-anthem").kind).toBe("fusion");
  });
});
