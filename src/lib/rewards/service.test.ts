import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isGrantActive,
  listGrantsForAccount,
  resetEntitlementGrantsForTests,
} from "@/lib/entitlements/grants";
import {
  resetSubscriptionStoreForTests,
  setSubscriptionForUser,
} from "@/lib/billing/subscription-store";

import { resolveRewardAudience } from "./audience";
import {
  enableStagingCampaignForTests,
  setActiveCampaignForTests,
  STAGING_SOUND_SPIN_CAMPAIGN,
} from "./campaign-config";
import { setForceFulfilmentFailureForTests } from "./fulfilment";
import { isRewardsEnabled } from "./flag";
import {
  claimSoundSpin,
  getClaimForAccount,
  getSoundSpinStatus,
} from "./service";
import { resetRewardStoreForTests } from "./store";
import { setRewardRandomForTests } from "./weights";
import type { SoundSpinCampaignConfig } from "./types";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = Date.parse("2026-10-15T12:00:00.000Z");

function withRewardsEnv(enabled: boolean) {
  if (enabled) process.env.ELCAMOSO_REWARDS_ENABLED = "1";
  else delete process.env.ELCAMOSO_REWARDS_ENABLED;
}

beforeEach(() => {
  withRewardsEnv(true);
  resetRewardStoreForTests();
  resetEntitlementGrantsForTests();
  resetSubscriptionStoreForTests();
  setRewardRandomForTests(null);
  setForceFulfilmentFailureForTests(false);
  enableStagingCampaignForTests(true);
});

afterEach(() => {
  withRewardsEnv(false);
  setActiveCampaignForTests(null);
  setRewardRandomForTests(null);
  setForceFulfilmentFailureForTests(false);
  resetRewardStoreForTests();
  resetEntitlementGrantsForTests();
  resetSubscriptionStoreForTests();
});

describe("Sound Spin service", () => {
  it("defaults rewards flag off", () => {
    withRewardsEnv(false);
    expect(isRewardsEnabled()).toBe(false);
    const status = getSoundSpinStatus({ accountId: ACCOUNT, audience: "free", nowMs: NOW });
    expect(status.claimingEnabled).toBe(false);
    const claim = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-key-01",
      nowMs: NOW,
    });
    expect(claim.ok).toBe(false);
    if (!claim.ok) expect(claim.error).toBe("rewards_disabled");
  });

  it("records one claim per account/campaign/period under concurrent requests", async () => {
    setRewardRandomForTests(() => 0);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        Promise.resolve(
          claimSoundSpin({
            accountId: ACCOUNT,
            audience: "free",
            idempotencyKey: `concurrent-${i}-${"x".repeat(8)}`,
            nowMs: NOW,
          }),
        ),
      ),
    );
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(20);
    const ids = new Set(ok.map((r) => (r.ok ? r.claim.claimId : "")));
    expect(ids.size).toBe(1);
    const reused = ok.filter((r) => r.ok && r.reusedExisting);
    expect(reused.length).toBe(19);
  });

  it("returns the same reward for different idempotency keys in the same period (no reroll)", () => {
    setRewardRandomForTests(() => 0);
    const first = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-key-aaaa",
      nowMs: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-key-bbbb",
      nowMs: NOW,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.reusedExisting).toBe(true);
    expect(second.claim.claimId).toBe(first.claim.claimId);
    expect(second.claim.outcome.rewardId).toBe(first.claim.outcome.rewardId);
  });

  it("allows a new claim after the UTC month boundary", () => {
    setRewardRandomForTests(() => 0);
    const oct = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-oct-0001",
      nowMs: Date.parse("2026-10-31T23:59:59.000Z"),
    });
    expect(oct.ok).toBe(true);
    if (!oct.ok) return;
    setRewardRandomForTests(() => 3500);
    const nov = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-nov-0001",
      nowMs: Date.parse("2026-11-01T00:00:00.000Z"),
    });
    expect(nov.ok).toBe(true);
    if (!nov.ok) return;
    expect(nov.reusedExisting).toBe(false);
    expect(nov.claim.periodKey).toBe("2026-11");
    expect(nov.claim.claimId).not.toBe(oct.claim.claimId);
  });

  it("retries fulfilment after interruption without changing the outcome", () => {
    setRewardRandomForTests(() => 0);
    setForceFulfilmentFailureForTests(true);
    const failed = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-fail-0001",
      nowMs: NOW,
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.claim.status).toBe("failed");
    const rewardId = failed.claim.outcome.rewardId;

    const retry = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-fail-retry",
      nowMs: NOW + 1000,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.reusedExisting).toBe(true);
    expect(retry.claim.claimId).toBe(failed.claim.claimId);
    expect(retry.claim.outcome.rewardId).toBe(rewardId);
    expect(retry.claim.status).toBe("fulfilled");
  });

  it("scopes claim reads to the owning account (cross-user denied)", () => {
    setRewardRandomForTests(() => 0);
    const claim = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-scope-0001",
      nowMs: NOW,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(getClaimForAccount(ACCOUNT, claim.claim.claimId, NOW)).not.toBeNull();
    expect(getClaimForAccount(OTHER, claim.claim.claimId, NOW)).toBeNull();
  });

  it("ignores client-tampered reward ids — server selects from pool", () => {
    setRewardRandomForTests(() => 0);
    const claim = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-tamper-01",
      nowMs: NOW,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    // First free-pool milli bucket is free-sound-gt-v8-48h when draw=0
    expect(claim.claim.outcome.rewardId).toBe("free-sound-gt-v8-48h");
    expect(claim.claim.outcome.rewardId).not.toBe("tampered-reward");
  });

  it("grants expire and stop authorizing after accessEndsAtUtc", () => {
    setRewardRandomForTests(() => 0);
    const claim = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-expiry-01",
      nowMs: NOW,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    const grants = listGrantsForAccount(ACCOUNT, NOW + 1000);
    expect(grants.length).toBeGreaterThan(0);
    const ends = Date.parse(claim.claim.outcome.accessEndsAtUtc!);
    expect(grants.every((g) => isGrantActive(g, ends - 1))).toBe(true);
    expect(listGrantsForAccount(ACCOUNT, ends + 1)).toHaveLength(0);
  });

  it("uses paid pool for Drive Plus and avoids full-library as sole paid value", () => {
    setSubscriptionForUser({
      userId: ACCOUNT,
      plan: "DRIVE_PLUS",
      status: "active",
      interval: "month",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2026-11-15T00:00:00.000Z"),
    });
    expect(resolveRewardAudience(ACCOUNT, NOW)).toBe("paid");
    const status = getSoundSpinStatus({
      accountId: ACCOUNT,
      audience: "paid",
      nowMs: NOW,
    });
    expect(status.displayedOdds.every((o) => o.kind !== "full_library_weekend")).toBe(true);
    expect(status.displayedOdds.some((o) => o.kind === "cockpit_theme")).toBe(true);
    expect(status.displayedOdds.some((o) => o.kind === "one_payment_discount")).toBe(true);
  });

  it("disables claiming when pool weights are invalid (no silent worse prize)", () => {
    const bad: SoundSpinCampaignConfig = {
      ...STAGING_SOUND_SPIN_CAMPAIGN,
      enabled: true,
      pools: {
        ...STAGING_SOUND_SPIN_CAMPAIGN.pools,
        free: {
          audience: "free",
          rewards: [
            {
              rewardId: "bad",
              kind: "cockpit_theme",
              weight: -5,
              label: "Bad",
              termsSummary: "Bad",
              themeId: "x",
            },
          ],
        },
      },
    };
    setActiveCampaignForTests(bad);
    const status = getSoundSpinStatus({ accountId: ACCOUNT, audience: "free", nowMs: NOW });
    expect(status.claimingEnabled).toBe(false);
    const claim = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-bad-pool1",
      nowMs: NOW,
    });
    expect(claim.ok).toBe(false);
    if (!claim.ok) expect(claim.error).toBe("pool_invalid");
  });

  it("uses declared inventory fallback instead of a silent worse substitute", () => {
    const limited: SoundSpinCampaignConfig = {
      ...STAGING_SOUND_SPIN_CAMPAIGN,
      enabled: true,
      pools: {
        paid: STAGING_SOUND_SPIN_CAMPAIGN.pools.paid,
        free: {
          audience: "free",
          inventoryFallbackRewardId: "only-fallback",
          rewards: [
            {
              rewardId: "limited",
              kind: "cockpit_theme",
              weight: 100,
              label: "Limited",
              termsSummary: "Limited",
              themeId: "lim",
              inventoryLimit: 0,
            },
            {
              rewardId: "only-fallback",
              kind: "cockpit_theme",
              weight: 0.001,
              label: "Fallback theme",
              termsSummary: "Declared fallback",
              themeId: "fb",
            },
          ],
        },
      },
    };
    setActiveCampaignForTests(limited);
    setRewardRandomForTests(() => 0);
    const claim = claimSoundSpin({
      accountId: ACCOUNT,
      audience: "free",
      idempotencyKey: "idem-inv-0001",
      nowMs: NOW,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.claim.outcome.rewardId).toBe("only-fallback");
  });
});
