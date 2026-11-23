import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";

import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { seedAudioRandom } from "@/lib/sound/rng";
import { CoyoteV8Synth } from "./coyote-synth";

type Shift = { seq: number; from: number; to: number; dir: "up" | "down"; reason: string };

function rig(startup = false) {
  const Offline = globalThis.OfflineAudioContext;
  const ctx = new Offline(1, 48000 * 2, 48000);
  const g = () => ctx.createGain();
  const buses = { body: g(), accents: g(), tonal: g(), noise: g(), mechanical: g() };
  for (const b of Object.values(buses)) b.connect(ctx.destination);
  const synth = new CoyoteV8Synth({ startup });
  synth.build(ctx, buses as unknown as StrategyBuses);
  synth.attachBuffer(ctx.createBuffer(1, 48000 * 61, 48000));
  let t = 0;
  let seq = 0;
  const step = (
    s: Partial<DriveState> & {
      shift?: Shift;
      preset?: string;
      pt?: Record<string, unknown>;
    },
    frames = 1,
  ) => {
    for (let i = 0; i < frames; i += 1) {
      t += 1 / 30;
      const { shift, preset, pt, ...rest } = s;
      const state = {
        speed: 20,
        acceleration: 0,
        throttle: 0.2,
        regen: 0,
        rpm: 2000,
        gear: 3,
        load: 0.2,
        jerk: 0,
        isShifting: false,
        timestamp: t * 1000,
        ...rest,
        powertrain: {
          shiftEvent:
            shift && i === 0
              ? {
                  sequenceId: shift.seq,
                  atMs: t * 1000,
                  fromGear: shift.from,
                  toGear: shift.to,
                  direction: shift.dir,
                  reason: shift.reason,
                }
              : null,
          shiftLoadMultiplier: 1,
          revMatchActive: false,
          diagnostics: { shiftMapPreset: preset ?? "legacy" },
          ...pt,
        },
      } as unknown as DriveState;
      synth.update(state, t);
    }
  };
  const all = () => synth.getDiagnostics().recentOneShots.map((s) => s.split("@")[0]!);
  /** Bank one-shots only (the V10 shift transients are logged as v10_shift / v10_thump). */
  const shots = () => all().filter((s) => !s.startsWith("v10_"));
  const pulses = () => all().filter((s) => s.startsWith("v10_"));
  return { synth, step, shots, pulses, all, nextSeq: () => (seq += 1), now: () => t };
}

describe("Coyote V8 race mode: Racing V10 gear shift, heel-and-toe downshifts", () => {
  it("braking downshift: V10 engagement + thump, throttle blip on the loops", () => {
    seedAudioRandom(11);
    const r = rig();
    const race = { preset: "race", throttle: 0, load: 0, gear: 4, speed: 22, regen: 0.4 };
    r.step({ ...race, rpm: 2600 }, 15);
    const before = r.synth.getDiagnostics().mixLoads;
    expect(before.over).toBeGreaterThan(0.6);
    r.step({
      ...race,
      rpm: 3200,
      gear: 3,
      shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "downshift-schedule" },
    });
    r.step({ ...race, rpm: 3300, gear: 3 }, 2);
    const blip = r.synth.getDiagnostics();
    // the blip opens the throttle: overrun -> on-load morph on the same loops
    expect(blip.mixLoads.on).toBeGreaterThan(0.6);
    expect(blip.mixLoads.over).toBeLessThan(0.3);
    expect(blip.rpm).toBeGreaterThan(3300);
    r.step({ ...race, rpm: 3000, gear: 3 }, 30);
    const after = r.synth.getDiagnostics();
    expect(after.mixLoads.on).toBeLessThan(0.05);
    expect(after.heelToes).toBe(1);
    const shots = r.shots();
    // no struck-metal gearbox one-shots any more: the V10's filtered-noise transients
    expect(shots.filter((s) => s.startsWith("gear") || s.startsWith("upshift"))).toHaveLength(0);
    expect(r.pulses()).toEqual(["v10_shift", "v10_thump"]);
    // the blip is the loops themselves, not a second engine one-shot on top
    expect(shots.filter((s) => s.startsWith("blip"))).toHaveLength(0);
  });

  it("race kickdown: V10 shift but no heel-toe blip; upshift: V10 shift as well", () => {
    seedAudioRandom(12);
    const r = rig();
    const race = { preset: "race", gear: 4, speed: 22 };
    r.step({ ...race, throttle: 0.95, load: 0.9, rpm: 2600 }, 15);
    r.step({
      ...race,
      throttle: 0.95,
      load: 0.9,
      rpm: 3400,
      gear: 3,
      shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "kickdown" },
    });
    r.step({ ...race, throttle: 0.95, load: 0.9, rpm: 3500, gear: 3 }, 20);
    expect(r.synth.getDiagnostics().heelToes).toBe(0);
    expect(r.pulses()).toEqual(["v10_shift", "v10_thump"]);
    r.step({
      ...race,
      throttle: 0.95,
      load: 0.9,
      rpm: 4200,
      gear: 4,
      shift: { seq: r.nextSeq(), from: 3, to: 4, dir: "up", reason: "upshift-schedule" },
    });
    r.step({ ...race, throttle: 0.95, load: 0.9, rpm: 3500, gear: 4 }, 20);
    expect(r.pulses()).toEqual(["v10_shift", "v10_thump", "v10_shift", "v10_thump"]);
    expect(r.shots().filter((s) => s.startsWith("gear") || s.startsWith("upshift"))).toHaveLength(
      0,
    );
  });

  it("shift sounds off (intensity 0) mutes the gear transients, keeps the rpm blip (as V10)", () => {
    seedAudioRandom(13);
    const r = rig();
    r.synth.setShiftIntensity(0);
    const race = { preset: "race", throttle: 0, load: 0, gear: 4, speed: 22, regen: 0.4 };
    r.step({ ...race, rpm: 2600 }, 15);
    r.step({
      ...race,
      rpm: 3200,
      gear: 3,
      shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "downshift-schedule" },
    });
    r.step({ ...race, rpm: 3000, gear: 3 }, 20);
    expect(r.pulses()).toHaveLength(0);
    expect(r.synth.getDiagnostics().shiftPulses).toBe(0);
    // V10: zero mutes clacks / thumps, the torque cut and rpm continuity stay
    expect(r.synth.getDiagnostics().heelToes).toBe(1);
  });

  it("other modes: the same V10 shift, no heel-toe", () => {
    seedAudioRandom(14);
    const r = rig();
    r.step({ throttle: 0, load: 0, rpm: 1600, gear: 4, speed: 12, regen: 0.4 }, 10);
    r.step({
      throttle: 0,
      rpm: 2000,
      gear: 3,
      speed: 12,
      regen: 0.4,
      shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "downshift-schedule" },
    });
    r.step({ throttle: 0, rpm: 1900, gear: 3, speed: 11, regen: 0.4 }, 20);
    expect(r.shots().filter((s) => s.startsWith("gear"))).toHaveLength(0);
    expect(r.pulses()).toEqual(["v10_shift", "v10_thump"]);
    expect(r.synth.getDiagnostics().heelToes).toBe(0);
  });

  it("every mode plays the V10 shift on an upshift (legacy, city, touring, sport, race)", () => {
    for (const preset of ["legacy", "city", "touring", "sport", "race"]) {
      seedAudioRandom(21);
      const r = rig();
      r.step({ preset, throttle: 0.5, load: 0.5, rpm: 3000, gear: 2 }, 10);
      r.step({
        preset,
        throttle: 0.5,
        load: 0.5,
        rpm: 2200,
        gear: 3,
        shift: { seq: r.nextSeq(), from: 2, to: 3, dir: "up", reason: "upshift-schedule" },
      });
      r.step({ preset, throttle: 0.5, load: 0.5, rpm: 2250, gear: 3 }, 10);
      expect(r.pulses(), preset).toEqual(["v10_shift", "v10_thump"]);
    }
  });

  it("the V10 recovery bark lifts the note after the engagement, then lets go", () => {
    seedAudioRandom(22);
    const r = rig();
    r.step({ throttle: 0.3, load: 0.3, rpm: 3000, gear: 2 }, 20);
    const before = r.synth.getDiagnostics().mixLoads.on;
    r.step({
      throttle: 0.3,
      load: 0.3,
      rpm: 2200,
      gear: 3,
      shift: { seq: r.nextSeq(), from: 2, to: 3, dir: "up", reason: "upshift-schedule" },
    });
    r.step({ throttle: 0.3, load: 0.3, rpm: 2200, gear: 3 }, 2);
    expect(r.synth.getDiagnostics().mixLoads.on).toBeGreaterThan(before + 0.02);
    r.step({ throttle: 0.3, load: 0.3, rpm: 2200, gear: 3 }, 20);
    expect(Math.abs(r.synth.getDiagnostics().mixLoads.on - before)).toBeLessThan(0.02);
  });
});

describe("Coyote V8 race mode: Racing V10 rev overrun", () => {
  it("limiter: the ignition-cut gate runs on the limiter in race mode only", () => {
    for (const preset of ["race", "sport"]) {
      seedAudioRandom(31);
      const r = rig();
      const on = { preset, throttle: 1, load: 1, rpm: 6100, gear: 2, speed: 25 };
      r.step({ ...on, pt: { limiterActive: true, limiterCut: false, driverDemand: 1 } }, 6);
      expect(r.synth.getDiagnostics().limiterGate, preset).toBe(preset === "race");
      r.step({ ...on, pt: { limiterActive: false, driverDemand: 1 } }, 4);
      expect(r.synth.getDiagnostics().limiterGate).toBe(false);
    }
  });

  it("lift-off at speed: V10 overrun pops with a crackle tail, without the Drive+ extras", () => {
    let fired: ReturnType<typeof rig> | null = null;
    for (const seed of [41, 42, 43, 44, 45, 46]) {
      seedAudioRandom(seed);
      const r = rig();
      r.synth.setAdvancedTransientsEnabled(false);
      const race = { preset: "race", gear: 3, speed: 30 };
      r.step({ ...race, throttle: 0.9, load: 0.9, rpm: 5200, pt: { driverDemand: 0.9 } }, 15);
      r.step({ ...race, throttle: 0, load: 0, rpm: 5000, pt: { driverDemand: 0 } }, 15);
      if (r.synth.getDiagnostics().racePopSequences > 0) {
        fired = r;
        break;
      }
    }
    expect(fired, "a seed with a lift-off pop (60 %)").not.toBeNull();
    const shots = fired!.shots();
    const bangs = shots.filter((s) => s.startsWith("pop")).length;
    const crackles = shots.filter((s) => s.startsWith("crackle")).length;
    expect(bangs).toBeGreaterThanOrEqual(1);
    expect(bangs).toBeLessThanOrEqual(3);
    expect(crackles).toBeGreaterThanOrEqual(3);
    expect(crackles).toBeLessThanOrEqual(7);
  });

  it("race downshifts under braking can pop (V10 rev-match pops); road modes never", () => {
    const run = (preset: string, seed: number) => {
      seedAudioRandom(seed);
      const r = rig();
      const brk = { preset, throttle: 0, load: 0, gear: 4, speed: 22, regen: 0.5 };
      r.step({ ...brk, rpm: 2600, pt: { driverDemand: 0 } }, 15);
      r.step({
        ...brk,
        rpm: 3200,
        gear: 3,
        shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "downshift-schedule" },
        pt: { shifting: true, shiftDirection: "down", shiftPhase: "torque_cut", driverDemand: 0 },
      });
      r.step(
        {
          ...brk,
          rpm: 3200,
          gear: 3,
          pt: { shifting: true, shiftDirection: "down", driverDemand: 0 },
        },
        3,
      );
      r.step({ ...brk, rpm: 3000, gear: 3, pt: { driverDemand: 0 } }, 20);
      return r.synth.getDiagnostics().racePopSequences;
    };
    const race = [51, 52, 53, 54, 55, 56].map((seed) => run("race", seed));
    expect(race.some((n) => n > 0)).toBe(true);
    expect([51, 52, 53].map((seed) => run("legacy", seed))).toEqual([0, 0, 0]);
  });

  it("hard race upshift near the limiter can crack (50 %), never at low rpm", () => {
    const run = (rpm: number, seed: number) => {
      seedAudioRandom(seed);
      const r = rig();
      const race = { preset: "race", throttle: 1, load: 1, gear: 2, speed: 25 };
      r.step({ ...race, rpm, pt: { driverDemand: 1 } }, 10);
      r.step({
        ...race,
        rpm,
        gear: 3,
        shift: { seq: r.nextSeq(), from: 2, to: 3, dir: "up", reason: "upshift-schedule" },
        pt: { shifting: true, shiftDirection: "up", shiftPhase: "torque_cut", driverDemand: 1 },
      });
      r.step({ ...race, rpm: rpm * 0.7, gear: 3, pt: { driverDemand: 1 } }, 10);
      return r.synth.getDiagnostics().racePopSequences;
    };
    const seeds = [61, 62, 63, 64, 65, 66, 67, 68];
    expect(seeds.some((seed) => run(5900, seed) > 0)).toBe(true);
    expect(seeds.map((seed) => run(3500, seed))).toEqual(seeds.map(() => 0));
  });
});

describe("Coyote V8 transient rules (George's spec 4, 5, 8-12)", () => {
  it("kickdown on throttle gives a bark but no rev-match blip", () => {
    seedAudioRandom(3);
    const r = rig();
    r.step({ throttle: 0.15, load: 0.2, rpm: 1500, gear: 4 }, 20);
    r.step({ throttle: 0.95, load: 0.8, rpm: 1550, gear: 4 }, 3);
    r.step({
      throttle: 0.95,
      load: 0.9,
      rpm: 2600,
      gear: 3,
      shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "kickdown" },
    });
    r.step({ throttle: 0.95, load: 0.9, rpm: 2700, gear: 3 }, 20);
    expect(r.shots()).toContain("bark");
    expect(r.shots().filter((s) => s.startsWith("blip"))).toHaveLength(0);
  });

  it("rev-matched downshift while slowing gives a blip, not near idle", () => {
    seedAudioRandom(4);
    const r = rig();
    r.step({ throttle: 0, load: 0, rpm: 1600, gear: 4, speed: 12, regen: 0.4 }, 10);
    r.step({
      throttle: 0,
      rpm: 2000,
      gear: 3,
      speed: 12,
      regen: 0.4,
      shift: { seq: r.nextSeq(), from: 4, to: 3, dir: "down", reason: "downshift-schedule" },
    });
    r.step({ throttle: 0, rpm: 1900, gear: 3, speed: 11, regen: 0.4 }, 20);
    expect(r.shots().filter((s) => s.startsWith("blip"))).toHaveLength(1);
    r.step({
      throttle: 0,
      rpm: 720,
      gear: 2,
      speed: 3.5,
      regen: 0.4,
      shift: { seq: r.nextSeq(), from: 3, to: 2, dir: "down", reason: "downshift-schedule" },
    });
    r.step({ throttle: 0, rpm: 700, gear: 2, speed: 3, regen: 0.4 }, 20);
    expect(r.shots().filter((s) => s.startsWith("blip"))).toHaveLength(1);
  });

  it("light-throttle upshifts are understated: no bank one-shot (only the V10 shift)", () => {
    seedAudioRandom(5);
    const r = rig();
    for (let g = 1; g < 5; g += 1) {
      r.step({ throttle: 0.22, load: 0.25, rpm: 2400, gear: g }, 30);
      r.step({
        throttle: 0.22,
        load: 0.25,
        rpm: 1700,
        gear: g + 1,
        shift: { seq: r.nextSeq(), from: g, to: g + 1, dir: "up", reason: "upshift-schedule" },
      });
    }
    r.step({ throttle: 0.22, load: 0.25, rpm: 1700, gear: 5 }, 30);
    expect(r.shots()).toEqual([]);
  });

  it("never pops on upshift torque cuts, and pop clusters are sparse with a cooldown", () => {
    seedAudioRandom(6);
    const r = rig();
    // hard pull with upshifts where the throttle proxy briefly collapses at each shift
    for (let g = 1; g < 5; g += 1) {
      r.step({ throttle: 0.95, load: 0.9, rpm: 5200, gear: g }, 30);
      r.step({
        throttle: 0.05,
        load: 0.3,
        rpm: 3800,
        gear: g + 1,
        shift: { seq: r.nextSeq(), from: g, to: g + 1, dir: "up", reason: "upshift-schedule" },
      });
      r.step({ throttle: 0.05, load: 0.3, rpm: 3800, gear: g + 1 }, 3); // 0.1 s cut
    }
    expect(r.shots().filter((s) => s.startsWith("pop"))).toHaveLength(0);
    // repeated lifts without braking: at most one pop cluster (<= 3 pops) per 4 s
    let clusters = 0;
    for (let i = 0; i < 6; i += 1) {
      const before = r.shots().filter((s) => s.startsWith("pop")).length;
      r.step({ throttle: 0.9, load: 0.8, rpm: 4000, gear: 3, regen: 0 }, 15);
      r.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0 }, 30);
      const added = r.shots().filter((s) => s.startsWith("pop")).length - before;
      expect(added).toBeLessThanOrEqual(3);
      if (added > 0) clusters += 1;
    }
    // 6 lifts over ~9 s: a plain lift-off can still pop, and the cooldown caps clusters
    expect(clusters).toBeGreaterThan(0);
    expect(clusters).toBeLessThanOrEqual(3);
  });

  it("does not pop while braking, and cancels pending pops when the brake goes on", () => {
    seedAudioRandom(6);
    const braking = rig();
    for (let i = 0; i < 6; i += 1) {
      braking.step({ throttle: 0.9, load: 0.8, rpm: 4000, gear: 3, regen: 0 }, 15);
      braking.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0.6 }, 30);
    }
    expect(braking.shots().filter((s) => s.startsWith("pop"))).toHaveLength(0);

    // Same lift, no brake: at least one of several seeds must be able to pop
    // (coyotePopCount is 0 about 35% of the time).
    let plainPops = 0;
    for (const seed of [6, 7, 8, 9, 10]) {
      seedAudioRandom(seed);
      const plain = rig();
      plain.step({ throttle: 0.9, load: 0.8, rpm: 4000, gear: 3, regen: 0 }, 15);
      plain.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0 }, 30);
      plainPops += plain.shots().filter((s) => s.startsWith("pop")).length;
    }
    expect(plainPops).toBeGreaterThan(0);

    // Schedule a cluster on a lift, then put the brake on before the shots play.
    let cancel: ReturnType<typeof rig> | null = null;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      seedAudioRandom(seed);
      const attempt = rig();
      attempt.step({ throttle: 0.9, load: 0.8, rpm: 4000, gear: 3, regen: 0 }, 15);
      attempt.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0 }, 8); // ~0.27s: hold done
      if (attempt.shots().some((s) => s.startsWith("pop"))) {
        cancel = attempt;
        break;
      }
    }
    expect(cancel, "needed a seed that schedules a lift-off pop").not.toBeNull();
    expect(cancel!.shots().filter((s) => s.startsWith("pop")).length).toBeGreaterThan(0);
    cancel!.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0.6 }, 2);
    expect(cancel!.shots().filter((s) => s.startsWith("pop"))).toHaveLength(0);
    // After the brake is released, the 0.5s hold still blocks a new lift's pops.
    // Arm and qualify the lift inside that 0.5s window (short arm + 0.2s hold).
    cancel!.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0 }, 1);
    cancel!.step({ throttle: 0.9, load: 0.8, rpm: 4000, gear: 3, regen: 0 }, 6);
    cancel!.step({ throttle: 0, load: 0, rpm: 3800, gear: 3, regen: 0 }, 8);
    expect(cancel!.shots().filter((s) => s.startsWith("pop"))).toHaveLength(0);
  });

  it("plays the startup only when asked (engine passes false on rebuilds)", () => {
    const a = rig(true);
    a.step({ speed: 0, rpm: 700, gear: 0, throttle: 0.03 }, 2);
    // startup plays on attach when stationary
    expect(a.shots()).toContain("startup");
    const b = rig(false);
    b.step({ speed: 0, rpm: 700, gear: 0, throttle: 0.03 }, 2);
    expect(b.shots()).not.toContain("startup");
  });
});
