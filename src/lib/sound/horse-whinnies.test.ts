import { describe, expect, it } from "vitest";
import { SnortScheduler, CARRIAGE_SNORT_TIMING } from "@/lib/sound/horse-snorts";
import { WhinnyScheduler, WHINNY_TIMING, WHINNY_URLS } from "@/lib/sound/horse-whinnies";

function seq(vals: number[]) {
  let i = 0;
  return () => vals[i++ % vals.length];
}

describe("WhinnyScheduler", () => {
  it("can whinny when pulling away after standing still", () => {
    const s = new WhinnyScheduler(seq([0.1]));
    for (let t = 0; t <= 4; t += 0.1) expect(s.step(t, 0)).toBeNull();
    expect(s.step(4.1, 5)?.reason).toBe("pullaway");
  });

  it("does not whinny on every pull-away (cooldown and chance)", () => {
    const s = new WhinnyScheduler(seq([0.1]));
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const t0 = k * 10;
      for (let t = t0; t < t0 + 5; t += 0.1) if (s.step(t, 0)) n++;
      for (let t = t0 + 5; t < t0 + 10; t += 0.1) if (s.step(t, 5)) n++;
    }
    expect(n).toBe(2); // 60 s of stop-and-go: at most one per 45 s
    const never = new WhinnyScheduler(seq([0.9]));
    for (let t = 0; t <= 4; t += 0.1) never.step(t, 0);
    expect(never.step(4.1, 5)).toBeNull();
  });

  it("whinnies every 45-90 s at steady speed, far less often than snorts", () => {
    const w = new WhinnyScheduler();
    const sn = new SnortScheduler(Math.random, CARRIAGE_SNORT_TIMING);
    const whinnies: number[] = [];
    let snorts = 0;
    for (let t = 0; t < 600; t += 0.05) {
      if (sn.step(t, 20, 0.3)) snorts++;
      if (w.step(t, 20, sn.lastSnortAt)) whinnies.push(t);
    }
    expect(whinnies.length).toBeGreaterThanOrEqual(6);
    expect(whinnies.length).toBeLessThanOrEqual(14);
    for (let i = 1; i < whinnies.length; i++) expect(whinnies[i] - whinnies[i - 1]).toBeGreaterThanOrEqual(WHINNY_TIMING.minGap);
    expect(snorts).toBeGreaterThan(whinnies.length * 2);
  });

  it("never starts within 3 s of a snort, and holds snorts until the whinny ends", () => {
    const w = new WhinnyScheduler(seq([0.1]));
    for (let t = 0; t <= 4; t += 0.1) w.step(t, 0);
    expect(w.step(4.1, 5, 3)).toBeNull();
    const sn = new SnortScheduler(() => 0, CARRIAGE_SNORT_TIMING);
    sn.holdUntil(10);
    for (let t = 0; t < 10.9; t += 0.1) expect(sn.step(t, 0, 0)?.reason ?? null).not.toBe("idle");
  });

  it("picks valid clips and avoids repeating the same one", () => {
    const s = new WhinnyScheduler(seq([0.1, 0.1, 0.1, 0.1]));
    let last = -1;
    for (let t = 0; t < 1000; t += 0.5) {
      const e = s.step(t, 20);
      if (e) {
        expect(e.clip).toBeGreaterThanOrEqual(0);
        expect(e.clip).toBeLessThan(WHINNY_URLS.length);
        expect(e.clip).not.toBe(last);
        last = e.clip;
      }
    }
  });
});
