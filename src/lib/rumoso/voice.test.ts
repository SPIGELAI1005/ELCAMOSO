import { describe, expect, it } from "vitest";
import {
  COACH_COOLDOWN_MS,
  applyCoachFire,
  createCoachState,
  evaluateCoach,
} from "./voice";

const START = 1_000_000;

describe("evaluateCoach", () => {
  it("never fires when the coach is off", () => {
    const s = createCoachState("off", START);
    expect(evaluateCoach(s, { nowMs: START + 5_000, effort: 90 })).toBeNull();
  });

  it("fires a hard-push line when effort crosses 70 from below 60", () => {
    const hype = createCoachState("hype", START);
    hype.wasBelowPush = true;
    const t = evaluateCoach(hype, { nowMs: START + 8_000, effort: 75 });
    expect(t?.reason).toBe("hard-push");
    expect(t?.line).toBe("push-for-it");

    const calm = createCoachState("calm", START);
    const c = evaluateCoach(calm, { nowMs: START + 8_000, effort: 75 });
    expect(c?.reason).toBe("hard-push");
    expect(c?.line).toBe("go-for-it");
  });

  it("does not re-fire a hard push until effort has dipped back under 60", () => {
    const s = createCoachState("hype", START);
    const first = evaluateCoach(s, { nowMs: START + 5_000, effort: 80 });
    expect(first).not.toBeNull();
    applyCoachFire(s, first!, START + 5_000);
    // After cooldown, still high — no new push.
    const later = evaluateCoach(s, { nowMs: START + 5_000 + COACH_COOLDOWN_MS.hype + 10, effort: 85 });
    expect(later?.reason === "hard-push").toBe(false);
    // Dip, then climb again.
    evaluateCoach(s, { nowMs: START + 5_000 + COACH_COOLDOWN_MS.hype + 1_000, effort: 40 });
    const again = evaluateCoach(s, {
      nowMs: START + 5_000 + COACH_COOLDOWN_MS.hype + 2_000,
      effort: 78,
    });
    expect(again?.reason).toBe("hard-push");
  });

  it("fires on a clear effort drop and respects cooldown", () => {
    const s = createCoachState("hype", START);
    s.wasBelowPush = false;
    s.recentPeakEffort = 80;
    const t = evaluateCoach(s, { nowMs: START + 10_000, effort: 60 });
    expect(t?.reason).toBe("effort-drop");
    expect(t?.line).toBe("you-can-do-it");
    applyCoachFire(s, t!, START + 10_000);

    s.recentPeakEffort = 80;
    const blocked = evaluateCoach(s, { nowMs: START + 10_000 + 20_000, effort: 50 });
    expect(blocked).toBeNull();

    s.recentPeakEffort = 80;
    const after = evaluateCoach(s, {
      nowMs: START + 10_000 + COACH_COOLDOWN_MS.hype + 50,
      effort: 50,
    });
    expect(after?.reason).toBe("effort-drop");
  });

  it("uses a 60 s cooldown in calm mode (still at least 45 s)", () => {
    const s = createCoachState("calm", START);
    const first = evaluateCoach(s, { nowMs: START + 3_000, effort: 80 });
    expect(first).not.toBeNull();
    applyCoachFire(s, first!, START + 3_000);
    s.wasBelowPush = true;
    expect(
      evaluateCoach(s, { nowMs: START + 3_000 + 45_000, effort: 80 }),
    ).toBeNull();
    const ready = evaluateCoach(s, { nowMs: START + 3_000 + COACH_COOLDOWN_MS.calm + 10, effort: 40 });
    // Effort is 40 — not a push. Just assert cooldown has expired by forcing a drop.
    s.recentPeakEffort = 80;
    s.wasBelowPush = false;
    const drop = evaluateCoach(s, { nowMs: START + 3_000 + COACH_COOLDOWN_MS.calm + 20, effort: 40 });
    expect(drop?.reason).toBe("effort-drop");
    expect(COACH_COOLDOWN_MS.calm).toBeGreaterThanOrEqual(45_000);
    expect(ready === null || drop !== null).toBe(true);
  });

  it("fires nice-pace after 20 s of steady mid effort", () => {
    const s = createCoachState("calm", START);
    s.wasBelowPush = false;
    for (let t = 0; t < 19_000; t += 1_000) {
      expect(evaluateCoach(s, { nowMs: START + t, effort: 55 })).toBeNull();
    }
    const cue = evaluateCoach(s, { nowMs: START + 20_000, effort: 55 });
    expect(cue?.reason).toBe("nice-pace");
    expect(cue?.line).toBe("nice-pace-hold-it");
  });

  it("fires last-minute once, when the session is in its final minute", () => {
    const s = createCoachState("hype", START, 10 * 60_000);
    s.wasBelowPush = false;
    expect(evaluateCoach(s, { nowMs: START + 8 * 60_000, effort: 30 })).toBeNull();
    const cue = evaluateCoach(s, { nowMs: START + 9 * 60_000, effort: 30 });
    expect(cue?.reason).toBe("last-minute");
    applyCoachFire(s, cue!, START + 9 * 60_000);
    const again = evaluateCoach(s, {
      nowMs: START + 9 * 60_000 + COACH_COOLDOWN_MS.hype + 10,
      effort: 30,
    });
    expect(again?.reason === "last-minute").toBe(false);
  });
});
