import { describe, expect, it } from "vitest";
import { SCARE_CREDITS, SCARE_KINDS, SCARE_SOURCES, SCARE_URLS, planNextScare, renderScare } from "./jump-scares";

function lcg(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

describe("jump scares", () => {
  it("covers laugh, scream, whistle, crows, owl, wolf with CC0 recordings", () => {
    expect([...SCARE_KINDS].sort()).toEqual(["crows", "laugh", "owl", "scream", "whistle", "wolf"]);
    for (const k of SCARE_KINDS) {
      expect(SCARE_SOURCES[k]).toMatch(/CC0/);
      expect(SCARE_URLS[k]).toMatch(/^\/sample-packs\/recorded\/scares-v1\/.+\.m4a$/);
    }
    for (const c of SCARE_CREDITS) expect(c.licence).toBe("CC0 1.0");
  });
  it("plans random, non-repeating scares with a quiet/loud mix and bounded gaps", () => {
    const rnd = lcg(7);
    let last = null as ReturnType<typeof planNextScare> | null;
    let t = 0, loud = 0, quiet = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const p = planNextScare(t, last?.kind ?? null, rnd, 0.5);
      if (last) expect(p.kind).not.toBe(last.kind);
      const gap = p.at - t;
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(20);
      if (p.loud) loud++; else quiet++;
      expect(p.level).toBeLessThanOrEqual(1.2);
      seen.add(p.kind); last = p; t = p.at;
    }
    expect(seen.size).toBe(6);
    expect(loud).toBeGreaterThan(100);
    expect(quiet).toBeGreaterThan(100);
  });
  it("renders every voice finite, audible and under 0.9 peak", () => {
    for (const k of SCARE_KINDS) {
      const b = renderScare(k, 24000);
      let peak = 0;
      for (const v of b) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); }
      expect(peak).toBeGreaterThan(0.3);
      expect(peak).toBeLessThanOrEqual(0.9001);
    }
  });
});
