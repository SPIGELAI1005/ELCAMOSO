import { describe, expect, it } from "vitest";
import { isRetroArcadeProfileId } from "./retro-arcade-synth";

describe("RetroArcadeSynth", () => {
  describe("isRetroArcadeProfileId", () => {
    it("returns true for retro-arcade", () => {
      expect(isRetroArcadeProfileId("retro-arcade")).toBe(true);
    });

    it("returns false for other profiles", () => {
      expect(isRetroArcadeProfileId("gt-v8")).toBe(false);
      expect(isRetroArcadeProfileId("symphony-viral-mix")).toBe(false);
      expect(isRetroArcadeProfileId("world-space-drive")).toBe(false);
    });
  });

  describe("speed-to-energy mapping", () => {
    const speedToEnergy = (speedKmh: number): number => {
      return Math.max(0, Math.min(1, speedKmh / 220));
    };

    const testSpeeds = [0, 20, 50, 80, 120, 160, 200, 220];

    it("maps 0 km/h to energy 0", () => {
      expect(speedToEnergy(0)).toBeCloseTo(0, 2);
    });

    it("maps 220 km/h to energy 1", () => {
      expect(speedToEnergy(220)).toBeCloseTo(1, 2);
    });

    it("maps intermediate speeds proportionally", () => {
      expect(speedToEnergy(50)).toBeCloseTo(50 / 220, 2);
      expect(speedToEnergy(100)).toBeCloseTo(100 / 220, 2);
      expect(speedToEnergy(150)).toBeCloseTo(150 / 220, 2);
    });

    it("clamps above 220 km/h to 1", () => {
      expect(speedToEnergy(250)).toBe(1);
      expect(speedToEnergy(300)).toBe(1);
    });

    it("clamps below 0 to 0", () => {
      expect(speedToEnergy(-10)).toBe(0);
    });

    it.each(testSpeeds)("provides smooth energy at %i km/h", (speed) => {
      const energy = speedToEnergy(speed);
      expect(energy).toBeGreaterThanOrEqual(0);
      expect(energy).toBeLessThanOrEqual(1);
    });
  });

  describe("energy-to-stem-gains mapping", () => {
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    const energyToStemGains = (energy: number) => {
      const e = clamp01(energy);
      const bellsBase = 0.35;
      const bellsRange = 0.3;
      const bells = bellsBase + e * bellsRange;
      const padsBase = 0.55;
      const padsRange = -0.25;
      const pads = padsBase + e * padsRange;
      const bassThreshold = 0.15;
      const bass = e > bassThreshold ? clamp01((e - bassThreshold) / 0.4) * 0.55 : 0;
      const pluckThreshold = 0.35;
      const plucks = e > pluckThreshold ? clamp01((e - pluckThreshold) / 0.35) * 0.6 : 0;
      const kickThreshold = 0.55;
      const kick = e > kickThreshold ? clamp01((e - kickThreshold) / 0.3) * 0.5 : 0;
      const hihatThreshold = 0.7;
      const hihats = e > hihatThreshold ? clamp01((e - hihatThreshold) / 0.25) * 0.45 : 0;
      return { bells, pads, bass, plucks, kick, hihats };
    };

    it("at energy 0 (stopped/idle): only bells and pads are active", () => {
      const gains = energyToStemGains(0);
      expect(gains.bells).toBeGreaterThan(0);
      expect(gains.pads).toBeGreaterThan(0);
      expect(gains.bass).toBe(0);
      expect(gains.plucks).toBe(0);
      expect(gains.kick).toBe(0);
      expect(gains.hihats).toBe(0);
    });

    it("at energy 0.23 (~50 km/h): bass enters", () => {
      const gains = energyToStemGains(0.23);
      expect(gains.bells).toBeGreaterThan(0);
      expect(gains.pads).toBeGreaterThan(0);
      expect(gains.bass).toBeGreaterThan(0);
      expect(gains.plucks).toBe(0);
      expect(gains.kick).toBe(0);
      expect(gains.hihats).toBe(0);
    });

    it("at energy 0.45 (~100 km/h): plucks enter", () => {
      const gains = energyToStemGains(0.45);
      expect(gains.bells).toBeGreaterThan(0);
      expect(gains.pads).toBeGreaterThan(0);
      expect(gains.bass).toBeGreaterThan(0);
      expect(gains.plucks).toBeGreaterThan(0);
      expect(gains.kick).toBe(0);
      expect(gains.hihats).toBe(0);
    });

    it("at energy 0.68 (~150 km/h): kick enters", () => {
      const gains = energyToStemGains(0.68);
      expect(gains.bells).toBeGreaterThan(0);
      expect(gains.pads).toBeGreaterThan(0);
      expect(gains.bass).toBeGreaterThan(0);
      expect(gains.plucks).toBeGreaterThan(0);
      expect(gains.kick).toBeGreaterThan(0);
      expect(gains.hihats).toBe(0);
    });

    it("at energy 0.91 (~200 km/h): hihats enter", () => {
      const gains = energyToStemGains(0.91);
      expect(gains.bells).toBeGreaterThan(0);
      expect(gains.pads).toBeGreaterThan(0);
      expect(gains.bass).toBeGreaterThan(0);
      expect(gains.plucks).toBeGreaterThan(0);
      expect(gains.kick).toBeGreaterThan(0);
      expect(gains.hihats).toBeGreaterThan(0);
    });

    it("at energy 1.0 (220 km/h): all stems at maximum", () => {
      const gains = energyToStemGains(1);
      expect(gains.bells).toBeCloseTo(0.65, 2);
      expect(gains.pads).toBeCloseTo(0.30, 2);
      expect(gains.bass).toBeCloseTo(0.55, 2);
      expect(gains.plucks).toBeCloseTo(0.6, 2);
      expect(gains.kick).toBeCloseTo(0.5, 2);
      expect(gains.hihats).toBeCloseTo(0.45, 2);
    });

    it("gains are smooth and monotonic with energy", () => {
      const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      let prevGains = energyToStemGains(0);

      for (const e of steps.slice(1)) {
        const gains = energyToStemGains(e);
        expect(gains.bells).toBeGreaterThanOrEqual(prevGains.bells - 0.01);
        expect(gains.bass).toBeGreaterThanOrEqual(prevGains.bass - 0.01);
        expect(gains.plucks).toBeGreaterThanOrEqual(prevGains.plucks - 0.01);
        expect(gains.kick).toBeGreaterThanOrEqual(prevGains.kick - 0.01);
        expect(gains.hihats).toBeGreaterThanOrEqual(prevGains.hihats - 0.01);
        prevGains = gains;
      }
    });

    it("no gain exceeds 1.0 (no clipping)", () => {
      for (let e = 0; e <= 1.0; e += 0.05) {
        const gains = energyToStemGains(e);
        expect(gains.bells).toBeLessThanOrEqual(1);
        expect(gains.pads).toBeLessThanOrEqual(1);
        expect(gains.bass).toBeLessThanOrEqual(1);
        expect(gains.plucks).toBeLessThanOrEqual(1);
        expect(gains.kick).toBeLessThanOrEqual(1);
        expect(gains.hihats).toBeLessThanOrEqual(1);
      }
    });
  });
});
