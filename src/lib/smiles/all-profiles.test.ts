import { describe, expect, it } from "vitest";
import { computeDriveState, IDLE_STATE } from "@/lib/drive/model";
import { resolveDrivetrain, withPersonalityTransmission } from "@/lib/drive/drivetrain-resolve";
import type { JourneySmilesLive } from "@/lib/journey/types";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { computeSmiles, defaultSmilesSettings } from "./smiles";

/** Mirrors DriveSession.noteLiveSmiles over a scripted 10-minute spirited drive. */
function simulate(profileId: string) {
  const base = SOUND_PROFILES.find((p) => p.id === profileId)!;
  const profile = withPersonalityTransmission(base);
  const redline = resolveDrivetrain(base).personality.engine.redlineRpm;
  const m: JourneySmilesLive = {
    nearRedlineMs: 0,
    raceModeMs: 0,
    peakRpmFrac: 0,
    launches: 0,
    hardMs: 0,
    movingMs: 0,
  };
  let prev = IDLE_STATE;
  let speed = 0;
  let distanceM = 0;
  let inLaunch = false;
  let prevKmh = 0;
  const dt = 0.1;
  for (let t = 0; t < 600; t += dt) {
    const phase = t % 60;
    const acc = phase < 8 ? 3.2 : phase < 40 ? 0.2 : phase < 50 ? -2 : 0;
    speed = Math.max(0, speed + acc * dt);
    distanceM += speed * dt;
    const s = computeDriveState({ speed, acceleration: acc, previous: prev, profile, dt });
    prev = s;
    const kmh = speed * 3.6;
    const ms = dt * 1000;
    if (kmh > 4) m.movingMs += ms;
    if (acc > 2.2) m.hardMs += ms;
    if (!inLaunch && prevKmh < 25 && acc > 2.5) {
      m.launches++;
      inLaunch = true;
    } else if (inLaunch && acc < 1) inLaunch = false;
    prevKmh = kmh;
    const frac = redline > 0 ? s.rpm / redline : 0;
    if (frac >= 0.85) m.nearRedlineMs += ms;
    if (frac > m.peakRpmFrac) m.peakRpmFrac = Math.min(1.5, frac);
  }
  return computeSmiles(
    { profileId, category: base.category, distanceM, durationMs: 600_000, trace: null, live: m },
    defaultSmilesSettings(),
  );
}

describe("Smiles are calculated for every sound profile", () => {
  it("has profiles", () => expect(SOUND_PROFILES.length).toBeGreaterThan(20));
  for (const p of SOUND_PROFILES) {
    it(`${p.id} (${p.category}, ${p.drivetrainMode ?? "default"}) earns smiles`, () => {
      const r = simulate(p.id);
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).toBeGreaterThan(20);
      expect(Number.isFinite(r.smilesPerMile)).toBe(true);
      expect(r.smilesPerMile).toBeGreaterThan(0);
      expect(r.distanceKm).toBeGreaterThan(1);
    });
  }
  it("rpm-less drives score from motion, not zero", () => {
    const live: JourneySmilesLive = {
      nearRedlineMs: 0,
      raceModeMs: 0,
      peakRpmFrac: 0,
      launches: 0,
      hardMs: 60_000,
      movingMs: 400_000,
    };
    const r = computeSmiles(
      { profileId: "x", distanceM: 5000, durationMs: 500_000, trace: null, live },
      defaultSmilesSettings(),
    );
    expect(r.score).toBe(60);
  });
  it("calm drive stays calm (no free smiles)", () => {
    const live: JourneySmilesLive = {
      nearRedlineMs: 0,
      raceModeMs: 0,
      peakRpmFrac: 0,
      launches: 0,
      hardMs: 0,
      movingMs: 400_000,
    };
    const r = computeSmiles(
      { profileId: "x", distanceM: 5000, durationMs: 500_000, trace: null, live },
      defaultSmilesSettings(),
    );
    expect(r.score).toBe(0);
  });
});
