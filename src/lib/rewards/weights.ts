import { randomInt } from "node:crypto";

import type { WeightedRewardDefinition } from "./types";

export type WeightedRandomFn = (maxExclusive: number) => number;

/**
 * Production RNG: cryptographic uniform integer in [0, maxExclusive).
 * Tests may inject a deterministic function via `setRewardRandomForTests`.
 */
let injectedRandom: WeightedRandomFn | null = null;

export function setRewardRandomForTests(fn: WeightedRandomFn | null): void {
  injectedRandom = fn;
}

function drawUniform(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("drawUniform requires positive integer maxExclusive");
  }
  if (injectedRandom) return injectedRandom(maxExclusive);
  return randomInt(maxExclusive);
}

export interface ValidatedPool {
  rewards: WeightedRewardDefinition[];
  /** Integer milliwights for precise selection (weight * 1000 rounded). */
  cumulativeMilli: number[];
  totalMilli: number;
}

/**
 * Validate finite nonnegative weights and build a normalized selection table.
 * Rejects NaN, Infinity, negatives, and empty/zero-total pools.
 */
export function validateAndBuildPool(
  rewards: WeightedRewardDefinition[],
): { ok: true; pool: ValidatedPool } | { ok: false; reason: string } {
  if (!Array.isArray(rewards) || rewards.length === 0) {
    return { ok: false, reason: "Pool has no rewards" };
  }

  const seen = new Set<string>();
  let totalMilli = 0;
  const cumulativeMilli: number[] = [];

  for (const reward of rewards) {
    if (!reward.rewardId || typeof reward.rewardId !== "string") {
      return { ok: false, reason: "Reward missing rewardId" };
    }
    if (seen.has(reward.rewardId)) {
      return { ok: false, reason: `Duplicate rewardId ${reward.rewardId}` };
    }
    seen.add(reward.rewardId);

    const w = reward.weight;
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0) {
      return {
        ok: false,
        reason: `Invalid weight for ${reward.rewardId}: must be finite and nonnegative`,
      };
    }
    const milli = Math.round(w * 1000);
    if (milli < 0) {
      return { ok: false, reason: `Invalid milliwight for ${reward.rewardId}` };
    }
    totalMilli += milli;
    cumulativeMilli.push(totalMilli);
  }

  if (totalMilli <= 0) {
    return { ok: false, reason: "Pool total weight must be > 0" };
  }

  return {
    ok: true,
    pool: { rewards, cumulativeMilli, totalMilli },
  };
}

export function selectWeightedReward(
  pool: ValidatedPool,
  random: WeightedRandomFn = drawUniform,
): WeightedRewardDefinition {
  const draw = random(pool.totalMilli);
  if (!Number.isInteger(draw) || draw < 0 || draw >= pool.totalMilli) {
    throw new Error("RNG returned out-of-range value");
  }
  for (let i = 0; i < pool.cumulativeMilli.length; i++) {
    if (draw < pool.cumulativeMilli[i]!) {
      return pool.rewards[i]!;
    }
  }
  return pool.rewards[pool.rewards.length - 1]!;
}

export function probabilityPercents(pool: ValidatedPool): number[] {
  return pool.rewards.map((r) => {
    const milli = Math.round(r.weight * 1000);
    return Math.round((milli / pool.totalMilli) * 10000) / 100;
  });
}
