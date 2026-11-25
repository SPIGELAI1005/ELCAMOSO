import "@/test-utils/install-web-audio";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { driveDisplayKind } from "@/lib/drive/drive-display";
import { RUNNER_START_KMH, runnerAmount, runnerBandHz } from "@/lib/sound/dsp/sleigh-runner";
import {
  SANTA_CHRISTMAS_SLEIGH_BELLS_LEVEL,
  SANTA_CHRISTMAS_SLEIGH_ID,
  SOUND_ALIASES,
  SoundEngine,
} from "@/lib/sound/engine";
import {
  CARRIAGE_SNORT_PROFILES,
  HORSE_SNORT_PROFILES,
  isHorseSnortProfile,
} from "@/lib/sound/horse-snorts";
import { isHorseWhinnyProfile } from "@/lib/sound/horse-whinnies";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { getProfile, SOUND_PROFILES } from "@/lib/sound/profiles";
import { getRecordedBed } from "@/lib/sound/recorded-beds";

const root = join(__dirname, "../../..");

const at = (kmh: number) =>
  ({
    speed: kmh / 3.6,
    acceleration: 0,
    throttle: 0,
    regen: 0,
    rpm: 0,
    gear: 0,
    load: 0,
    timestamp: 0,
    jerk: 0,
    isShifting: false,
    speedNormalized: 0,
    accelerationNormalized: 0,
  }) as never;

describe("Santa Christmas Sleigh profile", () => {
  it("is a new Festive profile with its emoji name, next to the existing ones", () => {
    const p = getProfile(SANTA_CHRISTMAS_SLEIGH_ID);
    expect(p.id).toBe("santa-christmas-sleigh");
    expect(p.name).toBe("Santa Christmas Sleigh 🛷");
    expect(p.category).toBe("Festive");
    expect(p.traits).toHaveLength(3);
    expect(p.drivetrainMode).toBe("continuous");
    expect(driveDisplayKind(p)).toBe("cadence");
    expect(SOUND_PROFILES.filter((x) => x.id === p.id)).toHaveLength(1);
    // the other two keep their names
    expect(getProfile("santa-sleigh").name).toBe("Santa V8 Sleigh");
    expect(getProfile("romanian-85-carriage").name).toBe("Romanian '85 Carriage");
    // not an alias: its own sound
    expect(SOUND_ALIASES[p.id]).toBeUndefined();
  });

  it("has no neigh signal in its voice", () => {
    const kinds = (getProfile(SANTA_CHRISTMAS_SLEIGH_ID).voice.signals ?? []).map((s) => s.kind);
    expect(kinds).not.toContain("neigh");
  });

  it("uses the wagon-free sleigh bed with the carriage gait table", () => {
    const sleigh = getRecordedBed(SANTA_CHRISTMAS_SLEIGH_ID)!;
    const carriage = getRecordedBed("romanian-85-carriage")!;
    expect(sleigh.url).toBe("/sample-packs/recorded/beds-v2/sleigh.m4a");
    expect(carriage.url).toBe("/sample-packs/recorded/beds-v2/carriage.m4a");
    expect(sleigh.loops).toEqual(carriage.loops);
    expect(sleigh.sourceSamples).toBe(carriage.sourceSamples);
    expect(sleigh.level).toBe(carriage.level);
    expect(sleigh.lowpassHz).toBeLessThan(carriage.lowpassHz);
    expect(existsSync(join(root, "public", sleigh.url))).toBe(true);
  });

  it("reindeer snort (brrr) but never neigh; horses keep both", () => {
    expect(isHorseSnortProfile(SANTA_CHRISTMAS_SLEIGH_ID)).toBe(true);
    expect(CARRIAGE_SNORT_PROFILES.has(SANTA_CHRISTMAS_SLEIGH_ID)).toBe(true);
    expect(isHorseWhinnyProfile(SANTA_CHRISTMAS_SLEIGH_ID)).toBe(false);
    for (const id of HORSE_SNORT_PROFILES) {
      if (id !== SANTA_CHRISTMAS_SLEIGH_ID) expect(isHorseWhinnyProfile(id)).toBe(true);
    }
  });

  it("has its Drive still like the other profiles", () => {
    const src = profileHeroImageSrc(SANTA_CHRISTMAS_SLEIGH_ID)!;
    expect(src).toBe("/hero/sound-profiles/santa-christmas-sleigh.png");
    const file = join(root, "public", src);
    expect(statSync(file).size).toBeGreaterThan(500_000);
  });
});

describe("sleigh runners", () => {
  it("are silent parked and rise smoothly with speed", () => {
    expect(runnerAmount(0)).toBe(0);
    expect(runnerAmount(RUNNER_START_KMH)).toBe(0);
    let prev = 0;
    for (let kmh = 2; kmh <= 120; kmh += 2) {
      const v = runnerAmount(kmh);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
    expect(runnerAmount(120)).toBe(1);
    expect(runnerBandHz(0)).toBeLessThan(runnerBandHz(90));
    expect(runnerBandHz(200)).toBeLessThanOrEqual(1500);
  });
});

describe("Santa Christmas Sleigh in the real engine", { timeout: 30000 }, () => {
  async function started(id: string) {
    const engine = new SoundEngine();
    const ctx = new OfflineAudioContext(2, 48_000 * 2, 48_000);
    engine.setProfile(getProfile(id));
    await engine.start(getProfile(id), {
      context: ctx as never,
      signature: false,
      seed: 1,
      environmentId: "open",
    });
    engine.update(at(0));
    return engine;
  }

  it("builds bells and runners, no Coyote", async () => {
    const engine = await started(SANTA_CHRISTMAS_SLEIGH_ID);
    expect(engine.sleighBellsDiagnostics()?.connected).toBe(true);
    expect(engine.sleighRunnerDiagnostics()?.connected).toBe(true);
    expect(engine.getCoyoteDiagnostics()).toBeNull();
    expect(SANTA_CHRISTMAS_SLEIGH_BELLS_LEVEL).toBeGreaterThan(0);
  });

  it("the Romanian carriage and Santa V8 Sleigh get no runners", async () => {
    const rom = await started("romanian-85-carriage");
    expect(rom.sleighRunnerDiagnostics()).toBeNull();
    expect(rom.sleighBellsDiagnostics()).toBeNull();
    const v8 = await started("santa-sleigh");
    expect(v8.sleighRunnerDiagnostics()).toBeNull();
    expect(v8.sleighBellsDiagnostics()).not.toBeNull();
  });

  it("switching away removes the sleigh layers", async () => {
    const engine = await started(SANTA_CHRISTMAS_SLEIGH_ID);
    engine.setProfile(getProfile("romanian-85-carriage"));
    engine.update(at(0));
    expect(engine.sleighRunnerDiagnostics()).toBeNull();
    expect(engine.sleighBellsDiagnostics()).toBeNull();
  });
});
