import { describe, expect, it } from "vitest";
import {
  VIRAL_EDM_CONFIG,
  applyStemScale,
  createEdmMachine,
  acousticPianoGain,
  choirGain,
  kitGainFromSpeed,
  nextPhraseTime,
  phraseStartIfEarly,
} from "./viral-edm-machine";

const bar = 2;
const origin = 0.02;

function input(
  t: number,
  kmh: number,
  throttle = 0.4,
  movement: "stopped" | "calm" | "cruise" | "building" | "energetic" | "decelerating" = "cruise",
) {
  return {
    kmh,
    throttle,
    movement,
    audioTime: t,
    clockOrigin: origin,
    barDuration: bar,
  };
}

describe("Viral Epic Party EDM form", () => {
  it("aligns phrase starts to 8-bar (16 s) downbeats", () => {
    expect(nextPhraseTime(1, origin, bar, 8)).toBeCloseTo(origin + 16, 5);
    expect(nextPhraseTime(16.02, origin, bar, 8)).toBeCloseTo(origin + 32, 5);
    expect(phraseStartIfEarly(0.1, origin, bar, 8)).toBeCloseTo(origin, 5);
  });

  it("brings the festival kit in with speed, not at idle", () => {
    expect(kitGainFromSpeed(0, "stopped")).toBe(0);
    expect(kitGainFromSpeed(20, "calm")).toBe(0);
    expect(kitGainFromSpeed(70, "cruise")).toBeGreaterThan(0.35);
    expect(kitGainFromSpeed(100, "energetic")).toBe(1);
  });

  it("starts a build when already at high speed on the first tick, drop lands 8 bars later on a phrase", () => {
    const m = createEdmMachine();
    const first = m.tick(input(0.05, 150, 0.85, "energetic"));
    expect(first.scheduledPhase).toBe("build");
    expect(first.scheduledAt).toBeCloseTo(origin, 5);

    const build = m.tick(input(0.05, 150, 0.85, "energetic"));
    // still at/after scheduled start
    const mid = m.tick(input(origin + 1, 150, 0.85, "energetic"));
    expect(mid.phase).toBe("build");
    expect(mid.buildProgress).toBeGreaterThan(0);
    expect(mid.filterHz).toBeGreaterThan(90);

    const last = m.tick(input(origin + 15.2, 160, 0.85, "energetic"));
    expect(last.phase).toBe("build");
    expect(last.lastBarOfBuild).toBe(true);
    expect(last.stemScale.drumsLow ?? 1).toBeLessThan(0.15);

    const drop = m.tick(input(origin + 16, 180, 0.85, "energetic"));
    expect(drop.phase).toBe("drop");
    expect(drop.dropGain).toBeGreaterThan(0.5);
    expect((drop.phaseStartedAt ?? 0) - origin).toBeCloseTo(16, 5);

    const melodic = m.tick(input(origin + 32.05, 180, 0.8, "energetic"));
    expect(melodic.phase).toBe("melodic");
    expect(melodic.melodicGain).toBeGreaterThan(0.4);
  });

  it("triggers a climb through 100–130 km/h and schedules the next 8-bar phrase", () => {
    const m = createEdmMachine();
    m.tick(input(1, 80, 0.4, "cruise"));
    m.tick(input(2, 95, 0.5, "cruise"));
    const crossed = m.tick(input(3, 108, 0.6, "building"));
    expect(crossed.scheduledPhase).toBe("build");
    expect(crossed.scheduledAt).toBeCloseTo(origin + 16, 5);
  });

  it("can re-enter a build after the melodic section while speed stays high", () => {
    const m = createEdmMachine();
    m.tick(input(0.05, 160, 0.9, "energetic"));
    m.tick(input(origin + 1, 160, 0.9, "energetic"));
    m.tick(input(origin + 16, 170, 0.9, "energetic"));
    m.tick(input(origin + 32, 180, 0.85, "energetic"));
    const endMelodic = m.tick(input(origin + 16 + 16 + 32, 180, 0.85, "energetic"));
    // 16 build + 16 drop + 32 melodic = 64s after origin
    expect(["melodic", "build"]).toContain(endMelodic.phase);
    if (endMelodic.phase === "melodic") {
      expect(endMelodic.scheduledPhase).toBe("build");
    }
  });

  it("strips back to the bed when slowing below the exit speed", () => {
    const m = createEdmMachine();
    m.tick(input(0.05, 160, 0.9, "energetic"));
    m.tick(input(origin + 1, 160, 0.9, "energetic"));
    const down = m.tick(input(origin + 4, 70, 0, "decelerating"));
    expect(down.phase).toBe("bed");
    expect(down.dropGain).toBe(0);
    expect(down.melodicGain).toBe(0);
    expect(down.filterHz).toBe(30);
  });

  it("applies stem scales as multipliers", () => {
    const out = applyStemScale({ piano: 1, cello: 0.5, lead: 1 }, { piano: 0.5, lead: 0.2 });
    expect(out.piano).toBeCloseTo(0.5);
    expect(out.cello).toBeCloseTo(0.5);
    expect(out.lead).toBeCloseTo(0.2);
  });
});

describe("acoustic piano and choir gates", () => {
  it("brings the acoustic piano in softly between 30 and 50 km/h", () => {
    expect(acousticPianoGain(20, "cruise", "bed", false)).toBe(0);
    expect(acousticPianoGain(40, "cruise", "bed", false)).toBeGreaterThan(0.3);
    expect(acousticPianoGain(40, "cruise", "bed", false)).toBeLessThan(0.85);
    expect(acousticPianoGain(55, "cruise", "bed", false)).toBeGreaterThan(0.8);
  });

  it("features the piano in the melodic section and on the last build bar", () => {
    const bed = acousticPianoGain(120, "cruise", "bed", false);
    const solo = acousticPianoGain(150, "energetic", "build", true);
    const melodic = acousticPianoGain(150, "cruise", "melodic", false);
    const drop = acousticPianoGain(150, "energetic", "drop", false);
    expect(solo).toBeGreaterThan(bed);
    expect(melodic).toBeGreaterThan(bed);
    expect(melodic).toBeGreaterThan(drop);
  });

  it("keeps the choir out until highway and swells it through the build into a loud drop", () => {
    expect(choirGain(50, "cruise", "bed", 0, false)).toBe(0);
    expect(choirGain(100, "cruise", "bed", 0, false)).toBeGreaterThan(0.2);
    const early = choirGain(140, "energetic", "build", 0.1, false);
    const late = choirGain(160, "energetic", "build", 0.9, false);
    const drop = choirGain(180, "energetic", "drop", 0, false);
    const last = choirGain(170, "energetic", "build", 0.95, true);
    expect(late).toBeGreaterThan(early);
    expect(drop).toBeGreaterThan(late);
    expect(drop).toBeGreaterThan(1.5);
    expect(last).toBeLessThan(early);
  });

  it("strips piano and choir back when slowing in the bed", () => {
    const cruise = acousticPianoGain(80, "cruise", "bed", false);
    const decel = acousticPianoGain(80, "decelerating", "bed", false);
    expect(decel).toBeLessThan(cruise);
    expect(choirGain(100, "decelerating", "bed", 0, false)).toBeLessThan(
      choirGain(100, "cruise", "bed", 0, false),
    );
  });
});
