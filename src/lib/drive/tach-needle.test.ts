import { describe, expect, it } from "vitest";
import { TachNeedleAnimator, type TachNeedleFrame } from "./tach-needle";

function fakeScheduler() {
  let t = 0;
  let id = 0;
  const queue = new Map<number, (now: number) => void>();
  return {
    request(cb: (now: number) => void) {
      id += 1;
      queue.set(id, cb);
      return id;
    },
    cancel(h: number) {
      queue.delete(h);
    },
    now: () => t,
    advance(ms: number, stepMs = 16) {
      for (let el = 0; el < ms; el += stepMs) {
        t += stepMs;
        const due = [...queue.entries()];
        queue.clear();
        for (const [, cb] of due) cb(t);
      }
    },
  };
}

describe("TachNeedleAnimator", () => {
  it("plays the intro then tracks live rpm", () => {
    const s = fakeScheduler();
    let last: TachNeedleFrame = { visual: 0, intro: true };
    const a = new TachNeedleAnimator(s, (f) => (last = f), { target: 0, reducedMotion: false });
    a.playIntro(900);
    s.advance(1000);
    expect(last.intro).toBe(false);
    a.setTarget(0.6);
    s.advance(800);
    expect(last.visual).toBeCloseTo(0.6, 2);
  });

  // Regression: George's test drive (Race default). The intro replayed after it had
  // finished (profile/mode key settling late on first Start Drive); the old two-effect
  // version cancelled the new intro frame, left intro=true and froze the needle until
  // a mode switch replayed the intro again.
  it("does not freeze when the intro replays after it finished while rpm updates", () => {
    const s = fakeScheduler();
    let last: TachNeedleFrame = { visual: 0, intro: true };
    const a = new TachNeedleAnimator(s, (f) => (last = f), { target: 0, reducedMotion: false });
    a.playIntro(900);
    s.advance(1200);
    expect(last.intro).toBe(false);

    // Late key change (e.g. fallback profile -> Racing V10 / Race) + immediate rpm update.
    a.playIntro(900);
    a.setTarget(0.2);
    s.advance(1000);
    expect(last.intro).toBe(false);

    a.setTarget(0.75);
    s.advance(800);
    expect(last.visual).toBeCloseTo(0.75, 2);
    a.setTarget(0.1);
    s.advance(800);
    expect(last.visual).toBeCloseTo(0.1, 2);
  });

  it("replays the intro mid-intro without stalling", () => {
    const s = fakeScheduler();
    let last: TachNeedleFrame = { visual: 0, intro: true };
    const a = new TachNeedleAnimator(s, (f) => (last = f), { target: 0.1, reducedMotion: false });
    a.playIntro(900);
    s.advance(300);
    a.playIntro(900);
    a.setTarget(0.4);
    s.advance(1500);
    expect(last.intro).toBe(false);
    expect(last.visual).toBeCloseTo(0.4, 2);
  });

  it("reduced motion follows the target directly", () => {
    const s = fakeScheduler();
    let last: TachNeedleFrame = { visual: 0, intro: false };
    const a = new TachNeedleAnimator(s, (f) => (last = f), { target: 0, reducedMotion: true });
    a.playIntro(900);
    a.setTarget(0.5);
    expect(last).toEqual({ visual: 0.5, intro: false });
  });
});
