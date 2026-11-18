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
  streetCallSpeedKmh,
} from "@/lib/sound/caravan-street-calls";

const T = STREET_CALL_TIMING;
const CRUISE = 25;
const dur = { woman: 14, man: 9 };

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
});

describe("StreetCallScheduler", () => {
  it("converts DriveState speed (m/s) the same way as other speed-gated features", () => {
    expect(streetCallSpeedKmh({ speed: 0 })).toBe(0);
    expect(streetCallSpeedKmh({ speed: 20 / 3.6 })).toBeCloseTo(20, 10);
    expect(streetCallSpeedKmh({ speed: -4 })).toBe(0);
  });

  it("does not fire below 20 km/h, including a brief spike above it", () => {
    const s = new StreetCallScheduler(() => 0);
    expect(s.step(0, 0, dur)).toBeNull();
    expect(s.step(1, 19.9, dur)).toBeNull();
    expect(s.step(2, CRUISE, dur)).toBeNull(); // arm starts
    expect(s.step(2.9, 10, dur)).toBeNull(); // dropped before the 2 s hold
    expect(s.step(10, 19.9, dur)).toBeNull();
    expect(s.step(100, 19.9, dur)).toBeNull();
    expect(s.step(101, T.enterKmh, dur)).toBeNull(); // exactly 20 does not arm
  });

  it("fires the woman 2–4 s after speed first stays above 20 km/h", () => {
    const s = new StreetCallScheduler(() => 0); // armMin = 2
    expect(s.step(0, CRUISE, dur)).toBeNull();
    expect(s.step(1.99, CRUISE, dur)).toBeNull();
    expect(s.step(2, CRUISE, dur)).toEqual({ kind: "woman" });
    expect(T.enterKmh).toBe(20);
    expect(T.armMin).toBe(2);
    expect(T.armMax).toBe(4);
  });

  it("alternates woman / man about every 30 s start to start", () => {
    const s = new StreetCallScheduler(() => 0); // interval - jitter = 27
    const interval = T.interval - T.jitter;
    s.step(0, CRUISE, dur);
    expect(s.step(2, CRUISE, dur)).toEqual({ kind: "woman" });
    expect(s.step(2 + interval - 0.1, CRUISE, dur)).toBeNull();
    expect(s.step(2 + interval, CRUISE, dur)).toEqual({ kind: "man" });
    expect(s.step(2 + 2 * interval - 0.1, CRUISE, dur)).toBeNull();
    expect(s.step(2 + 2 * interval, CRUISE, dur)).toEqual({ kind: "woman" });
    expect(s.step(2 + 3 * interval, CRUISE, dur)).toEqual({ kind: "man" });
    expect(T.interval).toBe(30);
    expect(T.jitter).toBe(3);
  });

  it("waits until the clip ends plus 2 s when the clip is longer than the gap", () => {
    const s = new StreetCallScheduler(() => 0);
    const long = { woman: 32, man: 9 };
    s.step(0, CRUISE, long);
    expect(s.step(2, CRUISE, long)).toEqual({ kind: "woman" });
    // 27 s later would be t=29, but the clip ends at 34, plus 2 s = 36
    expect(s.step(35.9, CRUISE, long)).toBeNull();
    expect(s.step(36, CRUISE, long)).toEqual({ kind: "man" });
    expect(T.afterClipGap).toBe(2);
  });

  it("pauses below 17 km/h and resumes the next voice after 2–4 s back above 20", () => {
    const s = new StreetCallScheduler(() => 0);
    const interval = T.interval - T.jitter;
    s.step(0, CRUISE, dur);
    expect(s.step(2, CRUISE, dur)).toEqual({ kind: "woman" });
    expect(s.step(5, 16, dur)).toBeNull();
    // original start-to-start would have been t=29; stay paused below 17
    expect(s.step(2 + interval, 16, dur)).toBeNull();
    // 17–20 after a pause is not enough to resume
    expect(s.step(40, 18, dur)).toBeNull();
    expect(s.step(41, CRUISE, dur)).toBeNull(); // re-arm starts
    expect(s.step(42.9, CRUISE, dur)).toBeNull();
    expect(s.step(43, CRUISE, dur)).toEqual({ kind: "man" });
    expect(T.exitKmh).toBe(17);
  });

  it("keeps the schedule running between 17 and 20 km/h once already armed", () => {
    const s = new StreetCallScheduler(() => 0);
    const interval = T.interval - T.jitter;
    s.step(0, CRUISE, dur);
    expect(s.step(2, CRUISE, dur)).toEqual({ kind: "woman" });
    expect(s.step(10, 18, dur)).toBeNull();
    expect(s.step(2 + interval, 18, dur)).toEqual({ kind: "man" });
  });

  it("does not overlap a still-playing clip when speed returns above 20 km/h", () => {
    const s = new StreetCallScheduler(() => 0);
    s.step(0, CRUISE, dur);
    expect(s.step(2, CRUISE, dur)).toEqual({ kind: "woman" }); // plays until t=16
    expect(s.step(5, 10, dur)).toBeNull();
    expect(s.step(6, CRUISE, dur)).toBeNull(); // re-arm starts
    // arm ends at t=8, but the clip plus 2 s holds the next start until t=18
    expect(s.step(8, CRUISE, dur)).toBeNull();
    expect(s.step(17.9, CRUISE, dur)).toBeNull();
    expect(s.step(18, CRUISE, dur)).toEqual({ kind: "man" });
  });
});
