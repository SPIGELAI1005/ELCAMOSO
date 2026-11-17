import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/sound/profiles";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { getRecordedBed } from "@/lib/sound/recorded-beds";
import { CARRIAGE_SNORT_PROFILES, isHorseSnortProfile } from "@/lib/sound/horse-snorts";
import { getStrategy } from "@/lib/sound/realism/strategies";
import { familyForProfile } from "@/lib/sound/realism/families";
import {
  CARAVAN_STREET_CALL_PROFILE_ID,
  STREET_CALL_TEXT,
  STREET_CALL_TIMING,
  STREET_CALL_URLS,
  StreetCallScheduler,
  isCaravanStreetCallProfile,
} from "@/lib/sound/caravan-street-calls";

describe("Caravan Carriage", () => {
  it("is a distinct catalog profile that reuses the Romanian '85 Carriage voice", () => {
    const caravan = getProfile("caravan-carriage");
    const romanian = getProfile("romanian-85-carriage");
    expect(caravan.id).toBe("caravan-carriage");
    expect(caravan.name).toBe("Caravan Carriage");
    expect(caravan.category).toBe("Heritage");
    expect(caravan.traits).toHaveLength(3);
    expect(caravan.drivetrainMode).toBe("continuous");
    expect(caravan.access).toBe("drive_plus");
    expect(caravan.voice).toEqual(romanian.voice);
    expect(familyForProfile("caravan-carriage")).toBe(familyForProfile("romanian-85-carriage"));
    expect(getStrategy("caravan-carriage")).not.toBeNull();
  });

  it("has its own hero still and reuses the carriage bed and snorts", () => {
    expect(profileHeroImageSrc("caravan-carriage")).toBe("/hero/sound-profiles/caravan-carriage.png");
    expect(existsSync("public/hero/sound-profiles/caravan-carriage.png")).toBe(true);
    expect(getRecordedBed("caravan-carriage")?.url).toBe(getRecordedBed("romanian-85-carriage")?.url);
    expect(isHorseSnortProfile("caravan-carriage")).toBe(true);
    expect(CARRIAGE_SNORT_PROFILES.has("caravan-carriage")).toBe(true);
  });

  it("ships the two Romanian street-call one-shots with diacritics in the copy", () => {
    expect(isCaravanStreetCallProfile(CARAVAN_STREET_CALL_PROFILE_ID)).toBe(true);
    expect(STREET_CALL_TEXT.woman).toBe("Fiare vechi. Fiare vechi luăm");
    expect(STREET_CALL_TEXT.man).toBe("Fiare vechi, frigidere vechi, calorifere, electronice luăm");
    expect(existsSync("public/sample-packs/caravan-carriage/fiare-vechi-woman.m4a")).toBe(true);
    expect(existsSync("public/sample-packs/caravan-carriage/fiare-vechi-man.m4a")).toBe(true);
    expect(STREET_CALL_URLS.woman).toContain("fiare-vechi-woman.m4a");
    expect(STREET_CALL_URLS.man).toContain("fiare-vechi-man.m4a");
    expect(getProfile("caravan-carriage").description).toMatch(/Fiare vechi/);
  });

  it("plays the woman first, then the man, then waits a few minutes", () => {
    const rand = () => 0; // always pick the minimum of each range
    const s = new StreetCallScheduler(rand);
    const dur = { woman: 4, man: 6 };
    expect(s.step(0, dur)).toBeNull();
    expect(s.step(24.9, dur)).toBeNull();
    expect(s.step(25, dur)).toEqual({ kind: "woman" });
    // manGapMin 7s after the 4s woman clip
    expect(s.step(25 + 4 + 6.9, dur)).toBeNull();
    expect(s.step(25 + 4 + 7, dur)).toEqual({ kind: "man" });
    const manAt = 25 + 4 + 7;
    // next woman after man duration (6) + cycleMin (180)
    expect(s.step(manAt + 6 + 179.9, dur)).toBeNull();
    expect(s.step(manAt + 6 + 180, dur)).toEqual({ kind: "woman" });
    expect(STREET_CALL_TIMING.cycleMin).toBeGreaterThanOrEqual(180);
    expect(STREET_CALL_TIMING.firstMin).toBeGreaterThanOrEqual(20);
  });
});
