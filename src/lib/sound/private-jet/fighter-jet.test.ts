import { describe, expect, it } from "vitest";
import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";
import { SOUND_ALIASES, airfieldFor } from "@/lib/sound/engine";
import { PRIVATE_JET_TURBOFAN_PROFILE, getProfile } from "@/lib/sound/profiles";
import { audioRandom, audioRandomState, seedAudioRandom } from "@/lib/sound/rng";
import { afterburnerGain } from "./afterburner";
import { PRIVATE_JET_AIRFIELD } from "./airfield";
import { FIGHTER_JET_AIRFIELD, FIGHTER_JET_ENGINE_GAIN_DB } from "./fighter-jet";
import {
  PRIVATE_JET_WHISTLE,
  TAKEOFF_WHISTLE_LEVEL,
  createTakeoffWhistleModel,
} from "./takeoff-whistle";
import { PRIVATE_JET_WING_CHECK, styleWingCheckPlan, wingCheckPlan } from "./wing-check";

/** Rocket Car style frame: continuous drivetrain, no rpm, no gear. */
const gearless = (kmh: number, acc: number, throttle: number): DriveState => ({
  ...IDLE_STATE,
  speed: kmh / 3.6,
  acceleration: acc,
  throttle,
  load: throttle,
  rpm: 0,
  gear: 0,
});

function run(model: ReturnType<typeof createTakeoffWhistleModel>, f: DriveState, seconds: number) {
  let last = model.step(f, 1 / 60);
  for (let t = 1 / 60; t < seconds; t += 1 / 60) last = model.step(f, 1 / 60);
  return last;
}

describe("Fighter Jet (Turbine Jet) catalog entry", () => {
  it("keeps the turbine-jet id, name and category", () => {
    const p = getProfile("turbine-jet");
    expect(p.id).toBe("turbine-jet");
    expect(p.name).toBe("Turbine Jet");
    expect(p.category).toBe("Aviation");
    expect(p.drivetrainMode).toBe("continuous");
    expect(p.traits).toContain("Fighter Jet");
  });

  it("plays the Rocket Car sound through the alias, a bit louder", () => {
    expect(SOUND_ALIASES["turbine-jet"]).toEqual({
      base: "rocket-car",
      overlay: "jet-airfield",
      engineGainDb: FIGHTER_JET_ENGINE_GAIN_DB,
    });
    expect(FIGHTER_JET_ENGINE_GAIN_DB).toBeGreaterThan(0);
    expect(FIGHTER_JET_ENGINE_GAIN_DB).toBeLessThanOrEqual(3);
  });

  it("parks on its own turbofan voice; Private Jet keeps its wind bed and config", () => {
    const fighter = airfieldFor(getProfile("turbine-jet"));
    expect(fighter.bed.id).toBe("turbine-jet");
    expect(fighter.config).toBe(FIGHTER_JET_AIRFIELD);
    const pj = airfieldFor(getProfile("private-jet"));
    expect(pj.bed).toBe(PRIVATE_JET_TURBOFAN_PROFILE);
    expect(pj.config).toBe(PRIVATE_JET_AIRFIELD);
    expect(PRIVATE_JET_AIRFIELD.afterburner).toBe(false);
    expect(PRIVATE_JET_AIRFIELD.bedRandomSeed).toBeUndefined();
    expect(PRIVATE_JET_AIRFIELD.whistle).toBe(PRIVATE_JET_WHISTLE);
    expect(PRIVATE_JET_WHISTLE.level).toBe(TAKEOFF_WHISTLE_LEVEL);
    expect(PRIVATE_JET_WHISTLE.rpmFromSpeed).toBeUndefined();
  });

  it("leaves the Rocket Car itself as it was", () => {
    const rc = getProfile("rocket-car");
    expect(SOUND_ALIASES["rocket-car"]).toBeUndefined();
    expect(rc.name).toBe("Rocket Car");
    expect(rc.category).toBe("Future");
    expect(rc.drivetrainMode).toBe("continuous");
    expect(rc.motionModel).toBe("continuous");
    expect(rc.voice).toEqual({
      baseFrequency: 48,
      harmonics: [1, 1.5, 2.01],
      waveResponse: 0.8,
      filterBase: 160,
      filterRange: 2200,
      noise: 0.08,
      noiseColor: "pink",
      detune: 12,
      wave: "triangle",
      coreLevel: 0.18,
      textures: [{ kind: "rumble", level: 0.2, tone: 50, speedScale: 0.4, surge: 0.15 }],
    });
  });
});

describe("Fighter Jet take-off whistle on the gearless Rocket Car frame", () => {
  it("is silent while parked", () => {
    const m = createTakeoffWhistleModel(FIGHTER_JET_AIRFIELD.whistle);
    const f = run(m, gearless(0, 0, 0), 5);
    expect(f.active).toBe(false);
    expect(f.gain).toBe(0);
  });

  it("spools from speed although rpm is 0, rises, then fades in cruise", () => {
    const m = createTakeoffWhistleModel(FIGHTER_JET_AIRFIELD.whistle);
    run(m, gearless(0, 0, 0), 1);
    const early = run(m, gearless(15, 2.8, 0.95), 1.5);
    expect(early.active).toBe(true);
    const later = run(m, gearless(90, 2.4, 0.95), 3);
    expect(later.spool).toBeGreaterThan(early.spool);
    expect(later.gain).toBeGreaterThan(early.gain);
    expect(later.hz).toBeGreaterThan(early.hz);
    const cruise = run(m, gearless(120, 0, 0.3), 5);
    expect(cruise.active).toBe(false);
    expect(cruise.gain).toBeLessThan(0.001);
    expect(m.takeoffs).toBe(1);
  });

  it("the Private Jet whistle stays quiet on the same gearless frame (no rpm)", () => {
    const m = createTakeoffWhistleModel();
    run(m, gearless(0, 0, 0), 1);
    const f = run(m, gearless(60, 2.5, 0.95), 3);
    expect(f.spool).toBe(0);
  });
});

describe("Fighter Jet afterburner", () => {
  it("is off without a take-off gate and grows with gate and speed", () => {
    expect(afterburnerGain(0, 100)).toBe(0);
    expect(afterburnerGain(0.5, 50)).toBeGreaterThan(0);
    expect(afterburnerGain(1, 50)).toBeGreaterThan(afterburnerGain(0.5, 50));
    expect(afterburnerGain(1, 150)).toBeGreaterThan(afterburnerGain(1, 20));
    expect(afterburnerGain(1, 1000)).toBeLessThanOrEqual(0.42 + 1e-9);
  });
});

describe("Fighter Jet control-surface checks", () => {
  it("are snappier and higher than the Private Jet ones", () => {
    const s = FIGHTER_JET_AIRFIELD.wingCheck;
    const seq = [0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.05, 0.95, 0.45];
    const draw = () => {
      let i = 0;
      return () => seq[i++ % seq.length]!;
    };
    const plan = wingCheckPlan("ailerons", draw());
    const pj = styleWingCheckPlan(plan, PRIVATE_JET_WING_CHECK);
    expect(pj).toBe(plan);
    const fj = styleWingCheckPlan(wingCheckPlan("ailerons", draw()), s);
    expect(fj).toHaveLength(plan.length);
    fj.forEach((st, i) => {
      expect(st.dur).toBeLessThan(plan[i]!.dur);
      expect(st.fromHz).toBeGreaterThan(plan[i]!.fromHz);
    });
    expect(s.flapsShare).toBeLessThan(PRIVATE_JET_WING_CHECK.flapsShare);
  });
});

describe("audioRandomState", () => {
  it("lets a side voice use its own stream and hand the shared one back", () => {
    seedAudioRandom(1234);
    const reference = [audioRandom(), audioRandom(), audioRandom()];
    seedAudioRandom(1234);
    const a = audioRandom();
    const outer = audioRandomState();
    seedAudioRandom(999);
    audioRandom();
    audioRandom();
    seedAudioRandom(outer);
    expect([a, audioRandom(), audioRandom()]).toEqual(reference);
  });
});
