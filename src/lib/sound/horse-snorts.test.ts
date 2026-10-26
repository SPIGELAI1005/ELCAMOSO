import { describe, expect, it } from "vitest";
import { isHorseSnortProfile, SnortScheduler } from "./horse-snorts";

const run = (s: SnortScheduler, from: number, to: number, kmh: number, thr: number, dt = 0.1) => {
  const out: { t: number; reason: string }[] = [];
  for (let t = from; t < to - 1e-9; t += dt) {
    const e = s.step(t, kmh, thr);
    if (e) out.push({ t, reason: e.reason });
  }
  return out;
};

describe("horse snorts", () => {
  it("only horse profiles snort", () => {
    expect(isHorseSnortProfile("wild-west-carriage")).toBe(true);
    expect(isHorseSnortProfile("romanian-85-carriage")).toBe(true);
    expect(isHorseSnortProfile("horse-gallop")).toBe(true);
    for (const id of ["american-muscle-v8", "gt-v8", "racing-v10", null])
      expect(isHorseSnortProfile(id)).toBe(false);
  });

  it("idle snorts at random 15-40 s gaps, never closer", () => {
    const s = new SnortScheduler();
    const ev = run(s, 0, 600, 0, 0);
    expect(ev.length).toBeGreaterThan(10);
    for (let i = 1; i < ev.length; i++) {
      const gap = ev[i]!.t - ev[i - 1]!.t;
      expect(gap).toBeGreaterThanOrEqual(15 - 0.2);
      expect(gap).toBeLessThanOrEqual(40 + 0.2);
    }
    const gaps = ev.slice(1).map((e, i) => +(e.t - ev[i]!.t).toFixed(1));
    expect(new Set(gaps).size).toBeGreaterThan(3);
  });

  it("hard acceleration snorts once, respects 8 s cooldown and the 6 s global gap", () => {
    const s = new SnortScheduler(() => 0.5);
    expect(s.step(0, 10, 0)).toBeNull();
    expect(s.step(0.1, 10, 1)?.reason).toBe("accel");
    expect(s.step(0.2, 10, 1)).toBeNull();
    s.step(3, 10, 0);
    expect(s.step(3.1, 10, 1)).toBeNull();
    s.step(9, 10, 0);
    expect(s.step(9.1, 12, 1)?.reason).toBe("accel");
  });

  it("settling snort after a quick stop, once, with cooldown", () => {
    const s = new SnortScheduler(() => 0.5);
    s.step(0, 20, 0.3);
    s.step(1, 10, 0);
    expect(s.step(2, 1, 0)?.reason).toBe("settle");
    expect(s.step(2.1, 0, 0)).toBeNull();
    s.step(4, 20, 0.3);
    expect(s.step(5, 0, 0)).toBeNull(); // within 12 s cooldown
    s.step(20, 20, 0.3);
    expect(s.step(21, 0, 0)?.reason).toBe("settle");
  });

  it("pitch within ±5%", () => {
    for (const r of [0, 0.999]) {
      const s = new SnortScheduler(() => r);
      s.step(0, 10, 0);
      const e = s.step(0.1, 10, 1)!;
      expect(Math.abs(e.rate - 1)).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });
});

describe("cruise snorts", () => {
  it("brrr after 10-15 s of steady speed, then every 10-15 s, idle clip", () => {
    const s = new SnortScheduler();
    const out: { t: number; reason: string; clip: string }[] = [];
    for (let t = 0; t < 120; t += 0.1) {
      const e = s.step(t, 60 + Math.sin(t) * 2, 0.3);
      if (e) out.push({ t, reason: e.reason, clip: e.clip });
    }
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(out[0]!.t).toBeGreaterThanOrEqual(10 - 0.2);
    expect(out[0]!.t).toBeLessThanOrEqual(15 + 0.2);
    for (const e of out) expect(e).toMatchObject({ reason: "cruise", clip: "idle" });
    for (let i = 1; i < out.length; i++) {
      const gap = out[i]!.t - out[i - 1]!.t;
      expect(gap).toBeGreaterThanOrEqual(10 - 0.2);
      expect(gap).toBeLessThanOrEqual(15 + 0.2);
    }
  });

  it("no cruise snort while speed keeps changing", () => {
    const s = new SnortScheduler(() => 0.5);
    for (let t = 0; t < 60; t += 0.1) {
      const e = s.step(t, 10 + t * 1.5, 0.5);
      expect(e?.reason).not.toBe("cruise");
    }
  });
});
