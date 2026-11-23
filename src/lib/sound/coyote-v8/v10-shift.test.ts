import { describe, expect, it } from "vitest";

import { buildShiftChoreography } from "@/lib/sound/realism/shift-events/choreography";
import { shiftEngagementForProfile } from "@/lib/sound/realism/shift-events/engagement-presets";
import {
  V10_RACE,
  coyoteV10ShiftPlan,
  v10BarkLevel,
  v10LimiterGateCycles,
  v10PopSequence,
  v10PulsePeak,
  v10ShiftIntensity,
} from "./v10-shift";

const event = {
  sequenceId: 3,
  atMs: 1000,
  fromGear: 2,
  toGear: 3,
  direction: "up" as const,
  reason: "upshift-schedule",
};

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("Racing V10 shift on the Coyote V8", () => {
  it("is the Racing V10's own choreography (same engagement, timing and voices)", () => {
    const plan = coyoteV10ShiftPlan(event, 1, 1);
    const v10 = buildShiftChoreography({
      event,
      engagement: shiftEngagementForProfile("racing-v10"),
      shiftIntensity: 0.72,
      audioNowSec: 1,
      audioNowMs: 1000,
      torqueCutMs: 85 * 0.45,
      recoveryMs: 85 * 0.35,
    });
    expect(plan).toEqual(v10);
    const mech = plan.steps.filter((s) => s.kind);
    expect(mech.map((s) => [s.kind, s.filterHz, s.decayMs])).toEqual([
      ["upshift", 880, 130],
      ["drivetrain-thump", 230, 140],
    ]);
    // engagement 18 ms after the shift, the driveline thump 12 ms later
    expect(mech[0]!.audioTime - 1).toBeCloseTo(0.018, 6);
    expect(mech[1]!.audioTime - mech[0]!.audioTime).toBeCloseTo(0.012, 6);
    // nothing tuned above ~1 kHz: no ringing "struck steel" modes
    for (const s of mech) expect(s.filterHz).toBeLessThan(1000);
  });

  it("follows the shift-sound setting (default = the V10 default, 0 mutes)", () => {
    expect(v10ShiftIntensity(1)).toBeCloseTo(0.72, 6);
    expect(v10ShiftIntensity(2)).toBe(1);
    expect(coyoteV10ShiftPlan(event, 0, 1).mechanicalMuted).toBe(true);
    expect(v10PulsePeak("shift", 1)).toBeCloseTo(0.7, 6);
    expect(v10PulsePeak("thump", 0)).toBeCloseTo(0.45 * 0.4, 6);
  });

  it("recovery bark falls linearly over 160 ms", () => {
    expect(v10BarkLevel(0.2, 0)).toBeCloseTo(0.2, 6);
    expect(v10BarkLevel(0.2, 0.08)).toBeCloseTo(0.1, 6);
    expect(v10BarkLevel(0.2, 0.17)).toBe(0);
    expect(v10BarkLevel(0.2, -0.01)).toBe(0);
  });
});

describe("Racing V10 race overrun on the Coyote V8", () => {
  it("pop sequences: 1-3 bangs then a 3-7 crackle tail, decaying", () => {
    const rand = lcg(7);
    for (let i = 0; i < 200; i += 1) {
      const kind = i % 2 ? "overrun" : "rev-match";
      const seq = v10PopSequence(kind, 0.5, rand);
      const bangs = seq.filter((s) => s.id.startsWith("pop"));
      const tail = seq.filter((s) => s.id.startsWith("crackle"));
      expect(bangs.length).toBeGreaterThanOrEqual(1);
      expect(bangs.length).toBeLessThanOrEqual(3);
      expect(tail.length).toBeGreaterThanOrEqual(3);
      expect(tail.length).toBeLessThanOrEqual(7);
      // bangs first, then the tail, in time order
      expect(seq.map((s) => s.at)).toEqual([...seq.map((s) => s.at)].sort((a, b) => a - b));
      expect(Math.max(...tail.map((s) => s.level))).toBeLessThan(
        Math.max(...bangs.map((s) => s.level)),
      );
    }
  });

  it("lift-off (overrun) gives more multi-bang sequences than a rev-match", () => {
    const multi = (kind: "overrun" | "rev-match") => {
      const rand = lcg(11);
      let n = 0;
      for (let i = 0; i < 400; i += 1) {
        if (v10PopSequence(kind, 0.5, rand).filter((s) => s.id.startsWith("pop")).length > 1)
          n += 1;
      }
      return n / 400;
    };
    expect(multi("overrun")).toBeGreaterThan(0.45);
    expect(multi("rev-match")).toBeLessThan(0.35);
  });

  it("limiter gate: 11 Hz ignition-cut cycles, 42 % cut", () => {
    const cycles = v10LimiterGateCycles(1, 1.2);
    expect(cycles.length).toBe(3);
    const period = cycles[1]![0] - cycles[0]![0];
    expect(1 / period).toBeCloseTo(V10_RACE.limiterGateHz, 6);
    expect((cycles[0]![1] - cycles[0]![0]) / period).toBeCloseTo(0.42, 6);
  });
});
