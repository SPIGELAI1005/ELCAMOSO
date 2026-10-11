import { describe, expect, it } from "vitest";
import type { DrivetrainShiftEvent } from "@/lib/powertrain/types";
import {
  buildShiftChoreography,
  maxMechanicalTransientLevel,
  ShiftEventConsumer,
  shiftEngagementForProfile,
  listShiftEngagementMatrixRows,
} from "@/lib/sound/realism/shift-events";

function event(partial: Partial<DrivetrainShiftEvent> & Pick<DrivetrainShiftEvent, "sequenceId">): DrivetrainShiftEvent {
  return {
    atMs: 1000,
    fromGear: 2,
    toGear: 3,
    direction: "up",
    reason: "test",
    ...partial,
  };
}

describe("ShiftEventConsumer exactly-once", () => {
  it("accepts a sequence id once and rejects duplicates", () => {
    const c = new ShiftEventConsumer();
    const e = event({ sequenceId: 7, atMs: 1000 });
    expect(c.consume(e, 1010).accepted).toBe(true);
    expect(c.consume(e, 1020).accepted).toBe(false);
    expect(c.consume(e, 1020).reason).toBe("duplicate");
    expect(c.consumedCount()).toBe(1);
  });

  it("discards stale events and timestamp gaps after suspension", () => {
    const c = new ShiftEventConsumer(350, 200);
    expect(c.consume(event({ sequenceId: 1, atMs: 0 }), 1000).reason).toBe("stale");
    c.markTimelineGap(500);
    const overdue = event({ sequenceId: 2, atMs: 100 });
    expect(c.consume(overdue, 900).reason).toBe("timeline-gap");
    const fresh = event({ sequenceId: 3, atMs: 880 });
    expect(c.consume(fresh, 900).accepted).toBe(true);
  });

  it("detects large audio-clock gaps without UI frame timing", () => {
    const c = new ShiftEventConsumer();
    expect(c.consume(event({ sequenceId: 1, atMs: 1000 }), 1010).accepted).toBe(true);
    // Simulate long suspend: next audio now jumps far ahead with an old event.
    const burst = event({ sequenceId: 2, atMs: 1050 });
    expect(c.consume(burst, 1010 + 5000).reason).toBe("timeline-gap");
  });
});

describe("engagement presets", () => {
  it("uses muscle-heavy vs sports-precise vs gearless silence", () => {
    expect(shiftEngagementForProfile("american-muscle-v8").style).toBe("muscle-heavy");
    expect(shiftEngagementForProfile("flat-six-sport").style).toBe("sports-precise");
    expect(shiftEngagementForProfile("cyber-pulse").allowMechanicalTransient).toBe(false);
    expect(shiftEngagementForProfile("cyber-pulse").style).toBe("none");
  });

  it("exposes matrix rows for combustion profiles only", () => {
    const rows = listShiftEngagementMatrixRows();
    expect(rows.some((r) => r.profileId === "american-muscle-v8")).toBe(true);
    expect(rows.every((r) => r.style !== "none")).toBe(true);
  });
});

describe("choreography + intensity", () => {
  const engagement = shiftEngagementForProfile("american-muscle-v8");

  it("mutes mechanical steps at zero intensity but keeps torque/recovery envelopes", () => {
    const plan = buildShiftChoreography({
      event: event({ sequenceId: 9, atMs: 1000, direction: "up" }),
      engagement,
      shiftIntensity: 0,
      audioNowSec: 1.01,
      audioNowMs: 1010,
    });
    expect(plan.mechanicalMuted).toBe(true);
    expect(plan.steps.every((s) => s.kind === null)).toBe(true);
    expect(plan.steps.some((s) => s.phase === "torque-cut")).toBe(true);
    expect(plan.steps.some((s) => s.phase === "recovery")).toBe(true);
  });

  it("schedules mechanical engagement on the audio clock at full intensity", () => {
    const plan = buildShiftChoreography({
      event: event({ sequenceId: 10, atMs: 1000, direction: "down" }),
      engagement,
      shiftIntensity: 1,
      audioNowSec: 1.0,
      audioNowMs: 1000,
    });
    expect(plan.mechanicalMuted).toBe(false);
    const mech = plan.steps.filter((s) => s.phase === "mechanical");
    expect(mech.length).toBeGreaterThanOrEqual(1);
    expect(mech.every((s) => s.audioTime >= 1.0)).toBe(true);
    expect(maxMechanicalTransientLevel(engagement)).toBeGreaterThan(0.4);
    expect(maxMechanicalTransientLevel(shiftEngagementForProfile("cyber-pulse"))).toBe(0);
  });

  it("sports engagement is shorter/higher than muscle thump body", () => {
    const sports = shiftEngagementForProfile("flat-six-sport");
    expect(sports.shiftDecayMs).toBeLessThan(engagement.shiftDecayMs);
    expect(sports.thumpFilterHz).toBeGreaterThan(engagement.thumpFilterHz);
  });
});

describe("simultaneous profile switch continuity", () => {
  it("reset clears consumed ids so a new profile can accept fresh sequences", () => {
    const c = new ShiftEventConsumer();
    expect(c.consume(event({ sequenceId: 1, atMs: 100 }), 110).accepted).toBe(true);
    c.reset();
    expect(c.hasConsumed(1)).toBe(false);
    expect(c.consume(event({ sequenceId: 1, atMs: 200 }), 210).accepted).toBe(true);
  });
});
