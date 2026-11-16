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
  const step = (s: Partial<DriveState> & { shift?: Shift }, frames = 1) => {
    for (let i = 0; i < frames; i += 1) {
      t += 1 / 30;
      const { shift, ...rest } = s;
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
        },
      } as unknown as DriveState;
      synth.update(state, t);
    }
  };
  const shots = () => synth.getDiagnostics().recentOneShots.map((s) => s.split("@")[0]!);
  return { synth, step, shots, nextSeq: () => (seq += 1) };
}

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

  it("light-throttle upshifts are understated: no one-shot", () => {
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
