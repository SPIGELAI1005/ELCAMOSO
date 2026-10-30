import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getProfile, SOUND_PROFILES } from "@/lib/sound/profiles";
import { FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access-config";
import { genreHeroImageSrc, profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { GENRES } from "@/lib/symphony/adaptive/genres";
import { hasSignatureGenre, resolveGenre } from "@/lib/symphony/adaptive/genre-store";
import { MUSIC_BANK, pickSample } from "@/lib/symphony/adaptive/sample-bank";
import {
  nextPoliceLightLevel,
  policeFlashRate,
  policeLightOpacity,
  policeLightPair,
} from "@/lib/drive/police-lights";

const NEW_IDS = ["symphony-latino-fiesta", "traby", "ge-squared", "police-patrol"];

describe("new Drive+ profiles", () => {
  it("are in the catalog, Drive+ only, with a hero image on disk", () => {
    for (const id of NEW_IDS) {
      expect(SOUND_PROFILES.some((p) => p.id === id), id).toBe(true);
      expect(FREE_SOUND_PROFILE_IDS).not.toContain(id);
      const src = profileHeroImageSrc(id);
      expect(src, id).toBe(`/hero/sound-profiles/${id}.png`);
      expect(existsSync(`public${src}`), id).toBe(true);
    }
    expect(existsSync(`public${genreHeroImageSrc("latino")}`)).toBe(true);
  });

  it("keep V8, GT V8 and V10 untouched and use their own gearing", () => {
    expect(getProfile("traby").transmission?.gearRatios).toHaveLength(4);
    expect(getProfile("traby").transmission?.redlineRpm).toBe(4200);
    expect(getProfile("ge-squared").transmission?.redlineRpm).toBe(6200);
    expect(getProfile("police-patrol").voice.textures?.some((t) => t.kind === "siren" && t.level <= 0.08)).toBe(true);
    expect(getProfile("racing-v10").voice.textures?.some((t) => t.kind === "siren")).toBe(false);
  });

  it("never name real brands in copy", () => {
    const text = NEW_IDS.map((id) => JSON.stringify(getProfile(id))).join(" ").toLowerCase();
    for (const bad of ["trabant", "mercedes", "g-class", "brabus", "cybertruck", "charger", "dodge"]) expect(text).not.toContain(bad);
  });
});

describe("latino genre", () => {
  const g = GENRES.latino;
  const ctx = (step: number, intensity: number, mode: "flow" | "stopped" = "flow") => ({
    step, bar: 1, chord: [45, 48, 52], root: 45, intensity, mode, variation: 0, stepDur: 60 / 96 / 4, barDur: 2.5, rand: Math.random,
  });
  const insts = (I: number) => new Set(Array.from({ length: 16 }, (_, s) => g.pattern(ctx(s, I))).flat().map((n) => `${n.inst}:${n.midi}`));

  it("is a fixed 96 bpm signature genre for Latino Fiesta", () => {
    expect(g.fixedBpm).toBe(96);
    expect(resolveGenre("symphony-latino-fiesta", "metal")).toBe("latino");
    expect(resolveGenre("symphony-latino-fiesta", "auto")).toBe("latino");
    expect(hasSignatureGenre("symphony-latino-fiesta")).toBe(true);
  });

  it("adds layers as speed rises", () => {
    const low = [...insts(0.05)].join(" ");
    expect(low).toContain("pad");
    expect(low).not.toContain("drums_latin:36");
    const mid = [...insts(0.4)].join(" ");
    expect(mid).toContain("drums_latin:36");
    expect(mid).toContain("nylon");
    expect(mid).not.toContain("brass");
    const high = [...insts(0.95)].join(" ");
    expect(high).toContain("brass");
    expect(high).toContain("piano");
    expect(high).toContain("drums_latin:56");
  });

  it("only plays rendered samples", () => {
    for (const I of [0.05, 0.4, 0.7, 0.95]) for (const s of insts(I)) {
      const [inst, midi] = s.split(":");
      expect(MUSIC_BANK[inst!], s).toBeDefined();
      expect(pickSample(inst!, Number(midi)), s).not.toBeNull();
    }
  });
});

describe("police light show", () => {
  it("follows the sqrt speed curve and caps at 2.5/s", () => {
    expect(policeFlashRate(0)).toBeCloseTo(0.8);
    expect(policeFlashRate(130)).toBeCloseTo(2.5);
    expect(policeFlashRate(250)).toBeCloseTo(2.5);
    expect(policeFlashRate(32.5)).toBeCloseTo(0.8 + 1.7 * 0.5);
    for (let k = 0; k < 300; k += 5) expect(policeFlashRate(k)).toBeLessThanOrEqual(2.5);
  });

  it("fades smoothly and stays within brightness limits", () => {
    expect(policeLightOpacity("60")).toBe(0.6);
    expect(policeLightOpacity("85")).toBe(0.85);
    expect(policeLightOpacity("off")).toBe(0);
    let prev = policeLightPair(0).red;
    for (let p = 0.01; p < 1; p += 0.01) {
      const { red, blue } = policeLightPair(p);
      expect(red + blue).toBeCloseTo(1);
      expect(Math.abs(red - prev)).toBeLessThan(0.04);
      prev = red;
    }
    expect(nextPoliceLightLevel("60")).toBe("85");
    expect(nextPoliceLightLevel("85")).toBe("off");
    expect(nextPoliceLightLevel("off")).toBe("60");
  });
});
