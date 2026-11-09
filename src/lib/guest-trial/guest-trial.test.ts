import { beforeEach, describe, expect, it } from "vitest";

import {
  GUEST_TRIAL_DAILY_SECONDS,
  GUEST_TRIAL_DAYS,
  GUEST_TRIAL_END_MS,
  GUEST_TRIAL_START_MS,
  berlinDayKey,
  creditForHeartbeat,
  isGuestTrialProfile,
  isGuestTrialWindow,
} from "@/lib/guest-trial/config";
import {
  applyServerUsage,
  guestRemainingSeconds,
  guestTrialAllows,
  guestTrialGoverns,
  resetGuestTrialForTests,
  tickGuestTrial,
} from "@/lib/guest-trial/client-store";
import {
  createMemoryStore,
  hashGuestIp,
  recordGuestHeartbeat,
} from "@/lib/guest-trial/usage.server";

const SECRET = "test-secret-0123456789";
const IN = Date.parse("2026-11-15T12:00:00+01:00");

describe("guest trial window", () => {
  it("starts 9 Nov 2026 00:00 Berlin and lasts 30 days", () => {
    expect(GUEST_TRIAL_START_MS).toBe(Date.parse("2026-11-09T00:00:00+01:00"));
    expect(GUEST_TRIAL_END_MS - GUEST_TRIAL_START_MS).toBe(GUEST_TRIAL_DAYS * 86_400_000);
    expect(isGuestTrialWindow(Date.parse("2026-11-08T23:59:59+01:00"))).toBe(false);
    expect(isGuestTrialWindow(Date.parse("2026-11-09T00:00:00+01:00"))).toBe(true);
    expect(isGuestTrialWindow(Date.parse("2026-12-08T23:59:59+01:00"))).toBe(true);
    expect(isGuestTrialWindow(Date.parse("2026-12-09T00:00:00+01:00"))).toBe(false);
  });

  it("covers exactly the eleven trial sounds", () => {
    for (const id of [
      "american-muscle-v8",
      "racing-v10",
      "symphony-latino-fiesta",
      "fusion-midnight-boost",
      "genre:waltz",
      "genre:house",
      "wild-west-carriage",
      "romanian-85-carriage",
      "dracula-carriage",
      "police-patrol",
      "gt-v8",
    ])
      expect(isGuestTrialProfile(id)).toBe(true);
    expect(isGuestTrialProfile("symphony-motion-orchestra", "waltz")).toBe(true);
    expect(isGuestTrialProfile("symphony-motion-orchestra", "house")).toBe(true);
    expect(isGuestTrialProfile("symphony-motion-orchestra", "rock")).toBe(false);
    expect(isGuestTrialProfile("symphony-motion-orchestra", null)).toBe(false);
    expect(isGuestTrialProfile("genre:rock")).toBe(false);
    expect(isGuestTrialProfile("traby")).toBe(false);
  });
});

describe("server: 7-minute cap per hashed IP", () => {
  it("never stores the raw IP and caps at 7:00", async () => {
    const store = createMemoryStore();
    let t = IN;
    let r = await recordGuestHeartbeat({
      ip: "203.0.113.7",
      signedIn: false,
      claimedSeconds: 0,
      now: t,
      secret: SECRET,
      store,
    });
    expect(r).toMatchObject({ mode: "guest", remainingSeconds: GUEST_TRIAL_DAILY_SECONDS });
    for (let i = 0; i < 20; i++) {
      t += 30_000;
      r = await recordGuestHeartbeat({
        ip: "203.0.113.7",
        signedIn: false,
        claimedSeconds: 30,
        now: t,
        secret: SECRET,
        store,
      });
    }
    expect(r).toMatchObject({ mode: "guest", usedSeconds: 420, remainingSeconds: 0 });
    const h = hashGuestIp("203.0.113.7", berlinDayKey(t), SECRET);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("203");
    expect(await store.get(h, berlinDayKey(t))).toMatchObject({ usedSeconds: 420 });
  });

  it("does not credit more than wall-clock time", () => {
    expect(creditForHeartbeat(300, IN - 10_000, IN)).toBe(12);
    expect(creditForHeartbeat(300, null, IN)).toBe(40);
    expect(creditForHeartbeat(-5, null, IN)).toBe(0);
  });

  it("resets at Berlin midnight and purges old days", async () => {
    const store = createMemoryStore();
    const before = await recordGuestHeartbeat({
      ip: "198.51.100.1",
      signedIn: false,
      claimedSeconds: 30,
      now: Date.parse("2026-11-15T23:59:30+01:00"),
      secret: SECRET,
      store,
    });
    expect(before).toMatchObject({ mode: "guest", usedSeconds: 30 });
    const after = await recordGuestHeartbeat({
      ip: "198.51.100.1",
      signedIn: false,
      claimedSeconds: 0,
      now: Date.parse("2026-11-16T00:00:01+01:00"),
      secret: SECRET,
      store,
    });
    expect(after).toMatchObject({
      mode: "guest",
      usedSeconds: 0,
      remainingSeconds: 420,
      day: "2026-11-16",
    });
    const oldHash = hashGuestIp("198.51.100.1", "2026-11-15", SECRET);
    expect(await store.get(oldHash, "2026-11-15")).toBeNull();
  });

  it("bypasses signed-in users and does nothing outside the window", async () => {
    const store = createMemoryStore();
    expect(
      await recordGuestHeartbeat({
        ip: "1.2.3.4",
        signedIn: true,
        claimedSeconds: 30,
        now: IN,
        secret: SECRET,
        store,
      }),
    ).toEqual({ mode: "signed_in" });
    expect(
      await recordGuestHeartbeat({
        ip: "1.2.3.4",
        signedIn: false,
        claimedSeconds: 30,
        now: Date.parse("2026-11-05T12:00:00+01:00"),
        secret: SECRET,
        store,
      }),
    ).toEqual({ mode: "inactive" });
    expect(
      await recordGuestHeartbeat({
        ip: "1.2.3.4",
        signedIn: false,
        claimedSeconds: 30,
        now: IN,
        secret: null,
        store,
      }),
    ).toEqual({ mode: "local_only" });
  });
});

describe("client: guest access", () => {
  beforeEach(() => resetGuestTrialForTests());

  it("allows trial sounds for guests until 7 minutes are used", () => {
    expect(guestTrialAllows("symphony-latino-fiesta", false, IN, null)).toBe(true);
    tickGuestTrial(419, IN);
    expect(guestRemainingSeconds(IN)).toBe(1);
    expect(guestTrialAllows("symphony-latino-fiesta", false, IN, null)).toBe(true);
    tickGuestTrial(1, IN);
    expect(guestTrialAllows("symphony-latino-fiesta", false, IN, null)).toBe(false);
  });

  it("server count wins when stricter than the local counter", () => {
    tickGuestTrial(10, IN);
    applyServerUsage({ mode: "guest", usedSeconds: 400, day: berlinDayKey(IN) }, 10);
    expect(guestRemainingSeconds(IN)).toBe(20);
  });

  it("resets locally on a new Berlin day", () => {
    tickGuestTrial(420, IN);
    expect(guestRemainingSeconds(IN)).toBe(0);
    expect(guestRemainingSeconds(IN + 86_400_000)).toBe(420);
  });

  it("logged-in users never go through the trial; outside the window guests are unchanged", () => {
    expect(guestTrialAllows("symphony-latino-fiesta", true, IN, null)).toBe(false);
    expect(
      guestTrialAllows(
        "symphony-latino-fiesta",
        false,
        Date.parse("2026-12-10T12:00:00+01:00"),
        null,
      ),
    ).toBe(false);
    expect(guestTrialAllows("traby", false, IN, null)).toBe(false);
  });

  it("V8 and V10 share the same 7 minutes for guests in the window", () => {
    expect(guestTrialGoverns("american-muscle-v8", false, IN, null)).toBe(true);
    expect(guestTrialGoverns("racing-v10", false, IN, null)).toBe(true);
    tickGuestTrial(300, IN); // e.g. 5 min on V8
    tickGuestTrial(120, IN); // then 2 min on Latino
    for (const id of ["american-muscle-v8", "racing-v10", "symphony-latino-fiesta"]) {
      expect(guestTrialAllows(id, false, IN, null)).toBe(false);
    }
    // During Black Friday, Midnight Dark Rave uses its own 15-minute guest rule.
    expect(guestTrialGoverns("fusion-midnight-boost", false, IN, null)).toBe(false);
    expect(guestTrialAllows("symphony-motion-orchestra", false, IN, "waltz")).toBe(false);
    expect(guestTrialAllows("symphony-motion-orchestra", false, IN, "house")).toBe(false);
  });

  it("V8 / V10 are not governed by the trial outside the window or when signed in", () => {
    const OUT = Date.parse("2026-12-10T12:00:00+01:00");
    expect(guestTrialGoverns("american-muscle-v8", false, OUT, null)).toBe(false);
    expect(guestTrialGoverns("racing-v10", true, IN, null)).toBe(false);
    expect(guestTrialGoverns("symphony-motion-orchestra", false, IN, null)).toBe(false); // Auto DJ
  });

  it("carriages and Police Patrol share the same 7 minutes", () => {
    const ids = ["wild-west-carriage", "romanian-85-carriage", "dracula-carriage", "police-patrol"];
    for (const id of ids) {
      expect(guestTrialGoverns(id, false, IN, null)).toBe(true);
      expect(guestTrialAllows(id, false, IN, null)).toBe(true);
      expect(guestTrialGoverns(id, true, IN, null)).toBe(false);
    }
    tickGuestTrial(420, IN);
    for (const id of ids) expect(guestTrialAllows(id, false, IN, null)).toBe(false);
    expect(guestTrialGoverns("gt-v8", false, IN, null)).toBe(true);
    expect(guestTrialAllows("gt-v8", false, IN, null)).toBe(false);
    expect(guestTrialGoverns("gt-v8", true, IN, null)).toBe(false);
  });
});
