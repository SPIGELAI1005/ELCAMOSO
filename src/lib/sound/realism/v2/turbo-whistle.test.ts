import { describe, expect, it } from "vitest";
import {
  followTurboSpool,
  turboBoostWant,
  turboWhistleGain,
  turboWhistleHz,
} from "./turbo-whistle";

// The inline maths the hybrid synth used before the extraction (must stay bit-identical).
function oldBoostWant(rpm: number, load: number, demand: number, ptBoost: number) {
  const rpmSpool = Math.min(1, Math.max(0, (rpm - 1400) / 2600));
  const loadSpool = Math.min(1, Math.max(0, (Math.max(load, demand) - 0.08) / 0.3));
  return Math.max(ptBoost, rpmSpool * loadSpool * 0.9);
}

describe("turbo whistle maths (shared by hybrid synth and Private Jet take-off)", () => {
  it("matches the previous inline formulas exactly", () => {
    for (const rpm of [700, 1400, 2500, 4000, 6500])
      for (const load of [0, 0.1, 0.3, 0.9])
        for (const demand of [0, 0.2, 1])
          for (const b of [0, 0.4])
            expect(turboBoostWant(rpm, load, demand, b)).toBe(oldBoostWant(rpm, load, demand, b));
    let spool = 0;
    let old = 0;
    for (let i = 0; i < 200; i++) {
      const want = i < 100 ? 0.8 : 0.1;
      spool = followTurboSpool(spool, want, 1 / 60, 0.7, 0.45);
      const tau = want >= old ? 0.7 : 0.45;
      old += (want - old) * (1 - Math.exp(-(1 / 60) / Math.max(0.04, tau)));
      expect(spool).toBe(old);
    }
    expect(turboWhistleGain(0.5, 0.3)).toBe(
      Math.pow(0.5, 1.5) * (0.5 + Math.min(1, 0.6) * 0.5) * 0.05,
    );
    expect(turboWhistleGain(0.05, 1)).toBe(0.0001);
    expect(turboWhistleHz(0.5, 0.5, { baseHz: 2800, spanHz: 3200 })).toBe(
      2800 + 0.5 * 3200 + 0.5 * 700,
    );
    expect(turboWhistleHz(0.5, 0.5)).toBe(2200 + 0.5 * 3400 + 0.5 * 700);
  });
});
