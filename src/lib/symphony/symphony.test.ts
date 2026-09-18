import { describe, expect, it } from "vitest";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import {
  computeRawDriveEnergy,
  createArrangementEngine,
  createDriveEnergyTracker,
  createMusicClock,
  createSymphonyEventBus,
  CINEMATIC_ROCK_PACK,
} from "@/lib/symphony";

function state(partial: Partial<DriveState>): DriveState {
  return { ...IDLE_STATE, timestamp: Date.now(), ...partial };
}

describe("drive energy", () => {
  it("does not treat steady highway as peak energy", () => {
    const cruise = computeRawDriveEnergy(
      state({
        speed: 120 / 3.6,
        throttle: 0.2,
        acceleration: 0.05,
        load: 0.3,
        speedNormalized: 120 / 160,
      }),
    );
    const kick = computeRawDriveEnergy(
      state({
        speed: 80 / 3.6,
        throttle: 0.95,
        acceleration: 3.2,
        load: 0.9,
        speedNormalized: 0.5,
        accelerationNormalized: 0.7,
      }),
    );
    expect(cruise.energy).toBeLessThan(0.55);
    expect(kick.energy).toBeGreaterThan(cruise.energy);
  });

  it("keeps stopped energy near zero", () => {
    expect(computeRawDriveEnergy(state({ speed: 0 })).energy).toBeLessThan(0.08);
  });

  it("hysteresis avoids movement flapping", () => {
    const tracker = createDriveEnergyTracker();
    let last = "stopped";
    for (let i = 0; i < 30; i++) {
      const e = 0.3 + (i % 2 === 0 ? 0.02 : -0.02);
      const snap = tracker.update(
        state({
          speed: 15,
          throttle: e,
          load: e,
          acceleration: 0.2,
          timestamp: i * 50,
        }),
        0.05,
      );
      if (i > 5) expect(snap.movementState).not.toBe("stopped");
      last = snap.movementState;
    }
    expect(["calm", "cruise", "building"]).toContain(last);
  });
});

describe("music clock", () => {
  it("quantizes to next bar without mapping speed to BPM", () => {
    const clock = createMusicClock({ bpm: 112, beatsPerBar: 4, barsPerLoop: 4 }, 0);
    const t = 1.1;
    const next = clock.nextBoundary(t, "bar");
    expect(next).toBeGreaterThan(t);
    const snap = clock.snapshot(next);
    expect(snap.bpm).toBe(112);
    expect(snap.beat).toBe(0);
  });
});

describe("event bus", () => {
  it("rate-limits energy_rise", () => {
    const bus = createSymphonyEventBus();
    const energy = {
      energy: 0.5,
      smoothness: 0.5,
      momentum: 0.5,
      tension: 0.4,
      regenIntensity: 0,
      driverDemand: 0.5,
      movementState: "building" as const,
    };
    bus.observe(state({ throttle: 0.5, load: 0.5 }), { ...energy, energy: 0.2 }, 0);
    bus.drain();
    bus.observe(state({ throttle: 0.8, load: 0.8 }), { ...energy, energy: 0.5 }, 0.2);
    bus.observe(state({ throttle: 0.9, load: 0.9 }), { ...energy, energy: 0.7 }, 0.4);
    const events = bus.drain();
    expect(events.filter((e) => e.type === "energy_rise").length).toBeLessThanOrEqual(1);
  });
});

describe("arrangement", () => {
  it("schedules energy rise at a quantized boundary", () => {
    const clock = createMusicClock(
      {
        bpm: CINEMATIC_ROCK_PACK.bpm,
        beatsPerBar: CINEMATIC_ROCK_PACK.beatsPerBar,
        barsPerLoop: CINEMATIC_ROCK_PACK.barsPerLoop,
      },
      0,
    );
    const arr = createArrangementEngine(CINEMATIC_ROCK_PACK, clock, 42);
    arr.setMovementState("cruise");
    arr.ingestEvents([{ type: "energy_rise", at: 0.3 }], 0.3, "building");
    const snap = arr.snapshot();
    expect(snap.scheduled).not.toBeNull();
    expect(snap.scheduled!.at).toBeGreaterThanOrEqual(0.3);
  });

  it("same journey seed yields the same arrangement decisions", () => {
    const clockA = createMusicClock(
      {
        bpm: 112,
        beatsPerBar: 4,
        barsPerLoop: 4,
      },
      0,
    );
    const clockB = createMusicClock(
      {
        bpm: 112,
        beatsPerBar: 4,
        barsPerLoop: 4,
      },
      0,
    );
    const a = createArrangementEngine(CINEMATIC_ROCK_PACK, clockA, 7);
    const b = createArrangementEngine(CINEMATIC_ROCK_PACK, clockB, 7);
    a.setMovementState("peak");
    b.setMovementState("peak");
    const events = [
      { type: "strong_acceleration" as const, at: 0.3 },
      { type: "upshift" as const, at: 0.7 },
    ];
    a.ingestEvents(events, 0.3, "peak");
    b.ingestEvents(events, 0.3, "peak");
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
