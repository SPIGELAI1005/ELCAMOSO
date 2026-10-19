import { describe, expect, it } from "vitest";
import { ACOUSTIC_ENGINE_BY_PROFILE } from "@/lib/sound/realism/v2/acoustic-engine";
import { getBassEnhancerConfig } from "@/lib/sound/dsp/bass-enhancer";
import { combustionTopologyForProfile } from "@/lib/sound/realism/v2/combustion-topology";

const ALIVE_IDLE = ["racing-v10", "f1-v10", "race-car", "flat-six-sport", "turbo-inline-6", "rally-car", "motorcycle-superbike"];
const PETROL = ["race-car", "flat-six-sport", "turbo-inline-6", "rally-car"];
const UNTOUCHED = ["american-muscle-v8", "gt-v8", "big-twin"];

describe("idleLife (alive idle)", () => {
  it("is set only on the V10s, the petrol cars and the superbike, within ±50-150 rpm wander", () => {
    for (const [id, cfg] of Object.entries(ACOUSTIC_ENGINE_BY_PROFILE)) {
      if (ALIVE_IDLE.includes(id)) {
        expect(cfg.idleLife, id).toBeDefined();
        expect(cfg.idleLife!.wanderRpm).toBeGreaterThanOrEqual(50);
        expect(cfg.idleLife!.wanderRpm).toBeLessThanOrEqual(150);
        expect(cfg.idleLife!.blipEveryS[0]).toBeGreaterThanOrEqual(3);
      } else {
        expect(cfg.idleLife, id).toBeUndefined();
      }
    }
  });
});

describe("petrol car states (gentle/hard, turbo flutter, performance exhaust)", () => {
  it("gives every petrol car gentle-vs-hard character, pops and an organic crank without ticks", () => {
    for (const id of PETROL) {
      const cfg = ACOUSTIC_ENGINE_BY_PROFILE[id]!;
      expect(cfg.accelCharacter?.hardGainDb, id).toBeGreaterThan(0);
      expect(cfg.accelCharacter!.gentleGainDb).toBeLessThanOrEqual(0);
      expect(cfg.liftPops, id).toBeDefined();
      const t = combustionTopologyForProfile(id);
      expect(t?.organic?.crankJitter, id).toBeGreaterThan(0);
      expect(t?.organic?.valvetrain, id).toBeUndefined();
    }
  });
  it("puts Supra-style flutter only on the turbo engines", () => {
    for (const [id, cfg] of Object.entries(ACOUSTIC_ENGINE_BY_PROFILE)) {
      if (cfg.turboFlutter) expect(cfg.forcedInduction, id).toBe(true);
    }
    expect(ACOUSTIC_ENGINE_BY_PROFILE["turbo-inline-6"]!.turboFlutter).toBeDefined();
    expect(ACOUSTIC_ENGINE_BY_PROFILE["rally-car"]!.turboFlutter).toBeDefined();
  });
  it("settles the turbo whistle (1-2 s) on every forced-induction engine and nowhere else", () => {
    for (const [id, cfg] of Object.entries(ACOUSTIC_ENGINE_BY_PROFILE)) {
      if (cfg.whistleSettle) {
        expect(cfg.forcedInduction, id).toBe(true);
        expect(cfg.whistleSettle.holdS + cfg.whistleSettle.tauS * 1.5).toBeLessThanOrEqual(2);
        expect(cfg.whistleSettle.floor).toBeGreaterThan(0);
        expect(cfg.whistleSettle.floor).toBeLessThan(0.5);
      }
      if (cfg.forcedInduction) expect(cfg.whistleSettle, id).toBeDefined();
      if (cfg.idleLife?.turboHiss) expect(cfg.forcedInduction, id).toBe(true);
      if (cfg.idleLife?.breathDb !== undefined) expect(cfg.idleLife.breathDb).toBeLessThanOrEqual(2);
    }
  });
  it("leaves the American V8, GT V8 and Big Twin configs alone", () => {
    for (const id of UNTOUCHED) {
      const cfg = ACOUSTIC_ENGINE_BY_PROFILE[id]!;
      expect(cfg.accelCharacter, id).toBeUndefined();
      expect(cfg.turboFlutter, id).toBeUndefined();
      expect(cfg.idleLife, id).toBeUndefined();
      expect(cfg.whistleSettle, id).toBeUndefined();
      expect(cfg.quickshifter, id).toBeUndefined();
      expect(combustionTopologyForProfile(id)?.organic, id).toBeUndefined();
    }
  });
});

describe("superbike (quickshifter, auto-blipper, thunder)", () => {
  it("has a quickshifter cut/crack and downshift blip only on the superbike", () => {
    for (const [id, cfg] of Object.entries(ACOUSTIC_ENGINE_BY_PROFILE)) {
      if (id === "motorcycle-superbike") continue;
      expect(cfg.quickshifter, id).toBeUndefined();
    }
    const q = ACOUSTIC_ENGINE_BY_PROFILE["motorcycle-superbike"]!.quickshifter!;
    expect(q.cutGain).toBeGreaterThan(0.2);
    expect(q.cutGain).toBeLessThan(1);
    expect(q.blipRpmFrac).toBeLessThanOrEqual(0.2);
    expect(ACOUSTIC_ENGINE_BY_PROFILE["motorcycle-superbike"]!.liftPops).toBeDefined();
    const t = combustionTopologyForProfile("motorcycle-superbike");
    expect(t?.organic?.valvetrain).toBeUndefined();
  });
  it("gives the superbike decel thunder and leaves the Big Twin bass chain alone", () => {
    expect(getBassEnhancerConfig("motorcycle-superbike")?.decelOnly).toBe(true);
    expect(getBassEnhancerConfig("big-twin")).toBeNull();
  });
});
