/**
 * Persist Founders Pack forever-sound picks. Postgres when DATABASE_URL is set
 * and the account id is a UUID; otherwise an in-memory store (tests / local).
 */
import { eq } from "drizzle-orm";

import { persistEntitlementGrantsForAccount } from "@/lib/billing/durable-state.server";
import { getDb } from "@/lib/db/client";
import { founderSoundPicks } from "@/lib/db/schema";
import {
  listAllGrantsForAccount,
  revokeEntitlementGrant,
  upsertEntitlementGrant,
} from "@/lib/entitlements/grants";
import {
  FOUNDER_FOREVER_PICK_LIMIT,
  FOUNDERS_FOREVER_PICK_SOURCE,
  FOUNDERS_LEGACY_FOREVER_SOURCE,
  LEGACY_FOUNDER_FOREVER_PROFILE_IDS,
  isLegacyFounderClaim,
} from "@/lib/founders/founders";
import {
  canConfirmFounderPicks,
  isFounderPickStillValid,
  validFounderPickIds,
} from "@/lib/founders/sound-picks";

export interface FounderSoundPickRecord {
  soundId: string;
  pickedAt: number;
  confirmedAt: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memory = new Map<string, FounderSoundPickRecord[]>();

const dbEnabled = (userId: string) => Boolean(process.env["DATABASE_URL"]) && UUID_RE.test(userId);

export function resetFounderSoundPicksForTests(): void {
  memory.clear();
}

export async function loadFounderSoundPicks(userId: string): Promise<FounderSoundPickRecord[]> {
  if (!dbEnabled(userId)) return [...(memory.get(userId) ?? [])];
  try {
    const rows = await getDb()
      .select({
        soundId: founderSoundPicks.soundId,
        pickedAt: founderSoundPicks.pickedAt,
        confirmedAt: founderSoundPicks.confirmedAt,
      })
      .from(founderSoundPicks)
      .where(eq(founderSoundPicks.accountId, userId));
    return rows.map((row) => ({
      soundId: row.soundId,
      pickedAt: row.pickedAt.getTime(),
      confirmedAt: row.confirmedAt?.getTime() ?? null,
    }));
  } catch (error) {
    console.error(
      "[founders] load sound picks failed",
      error instanceof Error ? error.message : error,
    );
    return [...(memory.get(userId) ?? [])];
  }
}

async function writePicks(userId: string, picks: FounderSoundPickRecord[]): Promise<void> {
  memory.set(userId, picks);
  if (!dbEnabled(userId)) return;
  const db = getDb();
  await db.delete(founderSoundPicks).where(eq(founderSoundPicks.accountId, userId));
  if (!picks.length) return;
  await db.insert(founderSoundPicks).values(
    picks.map((p) => ({
      accountId: userId,
      soundId: p.soundId,
      pickedAt: new Date(p.pickedAt),
      confirmedAt: p.confirmedAt != null ? new Date(p.confirmedAt) : null,
    })),
  );
}

function syncForeverGrants(userId: string, picks: FounderSoundPickRecord[], now: number): void {
  const valid = new Set(
    picks.filter((p) => isFounderPickStillValid(p.soundId, now)).map((p) => p.soundId),
  );
  for (const grant of listAllGrantsForAccount(userId)) {
    if (grant.source !== FOUNDERS_FOREVER_PICK_SOURCE || !grant.profileId) continue;
    if (!valid.has(grant.profileId)) revokeEntitlementGrant(grant.id);
  }
  for (const soundId of valid) {
    upsertEntitlementGrant({
      accountId: userId,
      kind: "grandfathered_profile",
      profileId: soundId,
      entitlement: null,
      expiresAt: null,
      createdAt: now,
      source: FOUNDERS_FOREVER_PICK_SOURCE,
    });
  }
}

/**
 * Save a draft selection. After confirm, only vacant slots (removed or now-free
 * sounds) may be filled; locked picks stay.
 */
export async function saveFounderSoundPicks(
  userId: string,
  soundIds: readonly string[],
  now = Date.now(),
): Promise<FounderSoundPickRecord[]> {
  const current = await loadFounderSoundPicks(userId);
  const locked = current.filter(
    (p) => p.confirmedAt != null && isFounderPickStillValid(p.soundId, now),
  );
  const lockedIds = new Set(locked.map((p) => p.soundId));
  const incoming = validFounderPickIds(soundIds, now).filter((id) => !lockedIds.has(id));
  const slotsLeft = FOUNDER_FOREVER_PICK_LIMIT - locked.length;
  const next = [
    ...locked,
    ...incoming.slice(0, Math.max(0, slotsLeft)).map((soundId) => ({
      soundId,
      pickedAt: now,
      confirmedAt: null as number | null,
    })),
  ];
  await writePicks(userId, next);
  return next;
}

/** Lock the current valid picks. Requires exactly 4 valid sounds. */
export async function confirmFounderSoundPicks(
  userId: string,
  now = Date.now(),
): Promise<FounderSoundPickRecord[]> {
  const current = await loadFounderSoundPicks(userId);
  const ids = current.map((p) => p.soundId);
  if (!canConfirmFounderPicks(ids, now)) {
    throw new Error("Select 4 sounds that are not free for everyone, then confirm.");
  }
  const valid = validFounderPickIds(ids, now);
  const byId = new Map(current.map((p) => [p.soundId, p]));
  const next = valid.map((soundId) => {
    const prev = byId.get(soundId);
    return {
      soundId,
      pickedAt: prev?.pickedAt ?? now,
      confirmedAt: prev?.confirmedAt ?? now,
    };
  });
  await writePicks(userId, next);
  syncForeverGrants(userId, next, now);
  await persistEntitlementGrantsForAccount(userId).catch((error: unknown) => {
    console.error(
      "[founders] persist forever picks failed",
      error instanceof Error ? error.message : error,
    );
  });
  return next;
}

export function ensureLegacyFounderForeverSounds(userId: string, founderAt: number | null): void {
  if (!isLegacyFounderClaim(founderAt)) return;
  for (const profileId of LEGACY_FOUNDER_FOREVER_PROFILE_IDS) {
    upsertEntitlementGrant({
      accountId: userId,
      kind: "grandfathered_profile",
      profileId,
      entitlement: null,
      expiresAt: null,
      createdAt: founderAt ?? Date.now(),
      source: FOUNDERS_LEGACY_FOREVER_SOURCE,
    });
  }
}

/** Vacant confirmed slots: picked sounds that were removed or became free for everyone. */
export function vacantFounderPickCount(
  picks: readonly FounderSoundPickRecord[],
  now = Date.now(),
): number {
  const validConfirmed = picks.filter(
    (p) => p.confirmedAt != null && isFounderPickStillValid(p.soundId, now),
  ).length;
  if (picks.some((p) => p.confirmedAt != null)) {
    return Math.max(0, FOUNDER_FOREVER_PICK_LIMIT - validConfirmed);
  }
  return 0;
}

export async function founderPicksSnapshot(userId: string, now = Date.now()) {
  const picks = await loadFounderSoundPicks(userId);
  const confirmed = picks.some((p) => p.confirmedAt != null);
  return {
    picks,
    soundIds: picks.map((p) => p.soundId),
    confirmed,
    vacant: vacantFounderPickCount(picks, now),
  };
}

/** Test helper: drop a pick's catalog validity by rewriting the stored id. */
export async function corruptFounderPickForTests(
  userId: string,
  fromId: string,
  toId: string,
): Promise<void> {
  const picks = await loadFounderSoundPicks(userId);
  await writePicks(
    userId,
    picks.map((p) => (p.soundId === fromId ? { ...p, soundId: toId } : p)),
  );
}
