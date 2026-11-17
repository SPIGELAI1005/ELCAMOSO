import { describe, expect, it } from "vitest";

import { VIRAL_MIX_PACK } from "@/lib/symphony/packs/viral-mix";
import { gainsFromSpeedGates } from "@/lib/symphony/speed-layers";

import {
  HARD_DRIVE_KMH,
  HARD_RUNNING_KMH,
  MUSIC_INTENSITY_TAU_S,
  MusicIntensitySmoother,
  driveSpeedKmhFromLevel,
  mapRunningToMusic,
  mpsToKmh,
  paceLevelFromRunningKmh,
  visibleEffortFromRunningKmh,
} from "./music-intensity";

function atKmh(kmh: number, cadenceSpm?: number) {
  return mapRunningToMusic({ speedMps: kmh / 3.6, cadenceSpm: cadenceSpm ?? null });
}

describe("running pace to Drive music", () => {
  it("maps 6, 10, 14 and 18 km/h to clearly different internal levels and Drive speeds", () => {
    const walk = atKmh(6);
    const jog = atKmh(10);
    const tempo = atKmh(14);
    const hard = atKmh(18);

    expect(walk.level).toBeLessThan(jog.level - 1.2);
    expect(jog.level).toBeLessThan(tempo.level - 1.2);
    expect(tempo.level).toBeLessThan(hard.level - 1.2);

    expect(walk.driveSpeedKmh).toBeLessThan(jog.driveSpeedKmh - 12);
    expect(jog.driveSpeedKmh).toBeLessThan(tempo.driveSpeedKmh - 12);
    expect(tempo.driveSpeedKmh).toBeLessThan(hard.driveSpeedKmh - 18);

    expect(walk.visibleZone).toBe("walk");
    expect(jog.visibleZone).toBe("steady");
    expect(tempo.visibleZone).toBe("push");
    expect(hard.visibleZone).toBe("hard");

    // Typical easy jogging lands mid-range, below the Drive 80 / Hard cut.
    expect(jog.driveSpeedKmh).toBeGreaterThan(45);
    expect(jog.driveSpeedKmh).toBeLessThan(HARD_DRIVE_KMH);
  });

  it("starts Hard at 16 km/h, mapped to Drive 80 km/h; 14 km/h stays Push and below 80", () => {
    expect(HARD_RUNNING_KMH).toBe(16);
    expect(HARD_DRIVE_KMH).toBe(80);

    const justUnder = atKmh(15.5);
    const start = atKmh(16);
    const under = atKmh(14);

    expect(under.visibleZone).toBe("push");
    expect(under.driveSpeedKmh).toBeLessThan(HARD_DRIVE_KMH);
    expect(justUnder.visibleZone).toBe("push");
    expect(justUnder.driveSpeedKmh).toBeLessThan(HARD_DRIVE_KMH);

    expect(start.visibleZone).toBe("hard");
    expect(start.driveSpeedKmh).toBeGreaterThanOrEqual(HARD_DRIVE_KMH);
    expect(visibleEffortFromRunningKmh(16)).toBeCloseTo(80, 5);
  });

  it("does not let cadence alone push a walk or easy jog into Hard", () => {
    const walk = atKmh(6, 190);
    expect(walk.visibleZone).toBe("walk");
    expect(walk.driveSpeedKmh).toBeLessThan(HARD_DRIVE_KMH);
    expect(walk.level).toBeLessThan(9);

    const easy = atKmh(10, 200);
    expect(easy.visibleZone).toBe("steady");
    expect(easy.driveSpeedKmh).toBeLessThan(HARD_DRIVE_KMH);
  });

  it("is stopped at a standstill and ignores a null speed", () => {
    const still = mapRunningToMusic({ speedMps: 0.2, cadenceSpm: 0 });
    expect(still.level).toBe(0);
    expect(still.driveSpeedKmh).toBe(0);
    expect(mapRunningToMusic({ speedMps: null }).driveSpeedKmh).toBe(0);
    expect(mpsToKmh(null)).toBe(0);
  });

  it("unlocks different Viral Mix instruments across 6 / 10 / 14 / 18 km/h", () => {
    const speeds = [6, 10, 14, 18].map((kmh) => atKmh(kmh).driveSpeedKmh);
    const [walk, jog, tempo, sprint] = speeds.map((kmh) =>
      gainsFromSpeedGates(VIRAL_MIX_PACK, kmh, kmh >= 100 ? "building" : kmh >= 42 ? "cruise" : "calm", kmh / 160),
    );
    // Walk: bed + hook / atmosphere, no mid-speed strings or bass.
    expect(walk!.piano).toBeGreaterThan(0.2);
    expect(walk!.strings ?? 0).toBeLessThan(0.15);
    expect(walk!.bass ?? 0).toBeLessThan(0.05);
    // Easy jog: strings in, still before brass.
    expect(jog!.strings ?? 0).toBeGreaterThan(0.4);
    expect(jog!.brass ?? 0).toBeLessThan(0.05);
    // Tempo / Push: bass and kit well in, brass still reserved for Hard.
    expect(tempo!.bass ?? 0).toBeGreaterThan(0.5);
    expect(tempo!.kit ?? 0).toBeGreaterThan(0.4);
    expect(tempo!.brass ?? 0).toBeLessThan(0.2);
    // Hard / sprint: Drive > 80, brass and then lead.
    expect(sprint!.brass ?? 0).toBeGreaterThan(0.5);
    expect(sprint!.lead ?? 0).toBeGreaterThan(0.2);
  });
});

describe("MusicIntensitySmoother", () => {
  it("settles toward a step change in about 3–5 seconds and ignores tiny jitter", () => {
    expect(MUSIC_INTENSITY_TAU_S).toBeGreaterThanOrEqual(3);
    expect(MUSIC_INTENSITY_TAU_S).toBeLessThanOrEqual(5);

    const s = new MusicIntensitySmoother();
    const target = driveSpeedKmhFromLevel(paceLevelFromRunningKmh(10));
    let v = 0;
    for (let t = 0; t < 1.0; t += 0.2) v = s.update(target, 0.2, 10);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(target * 0.55);

    for (let t = 0; t < 16; t += 0.2) v = s.update(target, 0.2, 10);
    expect(v).toBeGreaterThan(target * 0.95);
    expect(v).toBeLessThan(target + 0.5);

    const held = s.update(target + 0.8, 0.2, 10);
    expect(Math.abs(held - v)).toBeLessThan(0.05);
  });

  it("decays to zero when the runner stops, without chatter", () => {
    const s = new MusicIntensitySmoother();
    for (let i = 0; i < 30; i++) s.update(52, 0.2, 10);
    expect(s.driveSpeedKmh).toBeGreaterThan(20);
    for (let i = 0; i < 25; i++) s.update(0, 0.2, 0.4);
    expect(s.driveSpeedKmh).toBe(0);
  });
});
