import { beforeEach, describe, expect, it } from "vitest";

import { DRIVE_SPECIAL_DAILY_SECONDS } from "@/lib/billing/drive-special";
import { berlinDayKey, creditForHeartbeat } from "@/lib/guest-trial/config";
import {
  applyDriveSpecialServerUsage,
  driveSpecialCapAllows,
  driveSpecialCapGoverns,
  driveSpecialRemainingSeconds,
  resetDriveSpecialCapForTests,
  tickDriveSpecialCap,
} from "@/lib/drive-special-cap/client-store";
import {
  createMemoryDriveSpecialStore,
  recordDriveSpecialHeartbeat,
} from "@/lib/drive-special-cap/usage.server";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";

const IN = Date.parse("2026-11-15T12:00:00+01:00");
const freeUser = { ...DEFAULT_ENTITLEMENT_USER, accountId: "acc-special" };
const musicBuyer = { ...DEFAULT_ENTITLEMENT_USER, accountId: "acc-paid", plan: "DRIVE_MUSIC" as const };
const founder = {
  ...DEFAULT_ENTITLEMENT_USER,
  accountId: "acc-founder",
  founderDrivePlusActive: true,
};

describe("server: 30-minute cap per account id", () => {
  it("caps at 30:00 and keys by account, not IP", async () => {
    const store = createMemoryDriveSpecialStore();
    let t = IN;
    let r = await recordDriveSpecialHeartbeat({
      account: freeUser,
      claimedSeconds: 0,
      now: t,
      store,
    });
    expect(r).toMatchObject({ mode: "capped", remainingSeconds: DRIVE_SPECIAL_DAILY_SECONDS });
    const beat = 30;
    const beats = DRIVE_SPECIAL_DAILY_SECONDS / beat;
    for (let i = 0; i < beats; i++) {
      t += beat * 1000;
      r = await recordDriveSpecialHeartbeat({
        account: freeUser,
        claimedSeconds: beat,
        now: t,
        store,
      });
    }
    expect(r).toMatchObject({
      mode: "capped",
      usedSeconds: DRIVE_SPECIAL_DAILY_SECONDS,
      remainingSeconds: 0,
    });
    expect(await store.get("acc-special", berlinDayKey(t))).toMatchObject({
      usedSeconds: DRIVE_SPECIAL_DAILY_SECONDS,
    });
  });

  it("does not credit more than wall-clock time", () => {
    expect(creditForHeartbeat(300, IN - 10_000, IN)).toBe(12);
  });

  it("resets at Berlin midnight and purges old days", async () => {
    const store = createMemoryDriveSpecialStore();
    const before = await recordDriveSpecialHeartbeat({
      account: freeUser,
      claimedSeconds: 30,
      now: Date.parse("2026-11-15T23:59:30+01:00"),
      store,
    });
    expect(before).toMatchObject({ mode: "capped", usedSeconds: 30 });
    const after = await recordDriveSpecialHeartbeat({
      account: freeUser,
      claimedSeconds: 0,
      now: Date.parse("2026-11-16T00:00:01+01:00"),
      store,
    });
    expect(after).toMatchObject({
      mode: "capped",
      usedSeconds: 0,
      remainingSeconds: DRIVE_SPECIAL_DAILY_SECONDS,
      day: "2026-11-16",
    });
    expect(await store.get("acc-special", "2026-11-15")).toBeNull();
  });

  it("skips signed-out, inactive window, and anyone who already owns the music", async () => {
    const store = createMemoryDriveSpecialStore();
    expect(
      await recordDriveSpecialHeartbeat({
        account: { ...freeUser, accountId: null },
        claimedSeconds: 30,
        now: IN,
        store,
      }),
    ).toEqual({ mode: "signed_out" });
    expect(
      await recordDriveSpecialHeartbeat({
        account: freeUser,
        claimedSeconds: 30,
        now: Date.parse("2026-11-05T12:00:00+01:00"),
        store,
      }),
    ).toEqual({ mode: "inactive" });
    expect(
      await recordDriveSpecialHeartbeat({
        account: musicBuyer,
        claimedSeconds: 30,
        now: IN,
        store,
      }),
    ).toEqual({ mode: "uncapped" });
    expect(
      await recordDriveSpecialHeartbeat({
        account: founder,
        claimedSeconds: 30,
        now: IN,
        store,
      }),
    ).toEqual({ mode: "uncapped" });
  });
});

describe("client: special cap access", () => {
  beforeEach(() => resetDriveSpecialCapForTests());

  it("allows music profiles until 30 minutes are used", () => {
    const user = { accountId: "acc-special", plan: "FREE" as const };
    expect(driveSpecialCapAllows("fusion-road-anthem", user, IN)).toBe(true);
    tickDriveSpecialCap("acc-special", DRIVE_SPECIAL_DAILY_SECONDS - 1, IN);
    expect(driveSpecialRemainingSeconds("acc-special", IN)).toBe(1);
    tickDriveSpecialCap("acc-special", 1, IN);
    expect(driveSpecialCapAllows("fusion-road-anthem", user, IN)).toBe(false);
  });

  it("does not govern engine sounds, free Latino, or purchased music profiles", () => {
    const user = { accountId: "acc-special", plan: "FREE" as const };
    expect(driveSpecialCapGoverns("police-patrol", user, IN)).toBe(false);
    expect(driveSpecialCapGoverns("symphony-latino-fiesta", user, IN)).toBe(false);
    expect(
      driveSpecialCapGoverns("fusion-road-anthem", {
        ...user,
        grantedProfileIds: ["fusion-road-anthem"],
      }, IN),
    ).toBe(false);
  });

  it("server count wins when stricter than the local counter", () => {
    tickDriveSpecialCap("acc-special", 10, IN);
    applyDriveSpecialServerUsage(
      { mode: "capped", usedSeconds: DRIVE_SPECIAL_DAILY_SECONDS - 20, day: berlinDayKey(IN) },
      10,
    );
    expect(driveSpecialRemainingSeconds("acc-special", IN)).toBe(20);
  });
});
