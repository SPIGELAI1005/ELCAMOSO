/**
 * Server-only Smile rewards ledger. Every call fails soft: without DATABASE_URL or before
 * migration 0010 runs, reads return an empty status and writes award nothing.
 */
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  anonName,
  berlinDay,
  cappedAward,
  emptySmileStatus,
  hasStreak,
  REFERRAL_BONUS,
  REF_CODE_RE,
  shareBonusBase,
  shopItem,
  smileLevel,
  STREAK_BONUS,
  type SmileStatus,
  weekStart,
} from "@/lib/smiles/rewards";
import { SMILES_MIN_DISTANCE_M } from "@/lib/smiles/smiles";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EARN = sql`reason in ('card','share','streak','referral')`;
export const hasRewardsDb = (userId?: string) =>
  Boolean(process.env["DATABASE_URL"]) && (userId == null || UUID_RE.test(userId));

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Exec = Pick<Tx, "execute">;
const rows = async <T>(db: Exec, q: ReturnType<typeof sql>): Promise<T[]> => {
  const r = (await db.execute(q)) as unknown as T[] | { rows: T[] };
  return Array.isArray(r) ? r : r.rows; // postgres-js returns an array, PGlite { rows }
};

function soft<T>(label: string, fallback: T) {
  return (e: unknown): T => {
    console.error(`[smiles] ${label} failed`, e instanceof Error ? e.message : e);
    return fallback;
  };
}

async function isFounder(userId: string): Promise<boolean> {
  try {
    const { loadFounderRecord } = await import("@/lib/founders/founders.server");
    return (await loadFounderRecord(userId)).founderAt != null;
  } catch {
    return false;
  }
}

async function earnedToday(db: Exec, userId: string, now: number): Promise<number> {
  const [r] = await rows<{ n: number }>(
    db,
    sql`select coalesce(sum(amount),0)::int as n from smile_ledger where user_id = ${userId} and ${EARN}
        and reason <> 'referral' and (created_at at time zone 'Europe/Berlin')::date = ${berlinDay(now)}::date`,
  );
  return Number(r?.n ?? 0);
}

async function refreshTotals(db: Exec, userId: string): Promise<void> {
  const [r] = await rows<{ bal: number; earned: number }>(
    db,
    sql`select coalesce(sum(amount),0)::int as bal,
        coalesce(sum(amount) filter (where ${EARN}),0)::int as earned
        from smile_ledger where user_id = ${userId}`,
  );
  await db.execute(
    sql`update users set smile_total = ${Number(r?.bal ?? 0)}, smile_level = ${smileLevel(Number(r?.earned ?? 0)).name}
        where id = ${userId}::uuid`,
  );
}

async function lockUser(tx: Exec, userId: string) {
  await tx.execute(sql`insert into users (id) values (${userId}::uuid) on conflict do nothing`);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"smiles:" + userId}))`);
}

async function insertEntry(
  tx: Exec,
  e: { userId: string; amount: number; reason: string; ref: string; sound?: string | null; country?: string | null },
): Promise<boolean> {
  const r = await rows<{ id: string }>(
    tx,
    sql`insert into smile_ledger (user_id, amount, reason, ref, sound, country)
        values (${e.userId}, ${e.amount}, ${e.reason}, ${e.ref}, ${e.sound ?? null}, ${e.country ?? null})
        on conflict do nothing returning id`,
  );
  return r.length > 0;
}

function randomCode(): string {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export async function getSmileStatus(userId: string, now = Date.now()): Promise<SmileStatus> {
  if (!hasRewardsDb(userId)) return emptySmileStatus();
  try {
    const db = getDb();
    await db.execute(sql`insert into users (id) values (${userId}::uuid) on conflict do nothing`);
    const [u] = await rows<{ handle: string | null; code: string | null }>(
      db,
      sql`select smile_handle as handle, smile_ref_code as code from users where id = ${userId}::uuid`,
    );
    let code = u?.code ?? null;
    if (u && !code) {
      code = randomCode();
      await db
        .execute(sql`update users set smile_ref_code = ${code} where id = ${userId}::uuid and smile_ref_code is null`)
        .catch(() => (code = null));
    }
    const [r] = await rows<{ bal: number; earned: number }>(
      db,
      sql`select coalesce(sum(amount),0)::int as bal,
          coalesce(sum(amount) filter (where ${EARN}),0)::int as earned
          from smile_ledger where user_id = ${userId}`,
    );
    const owned = await rows<{ ref: string }>(
      db,
      sql`select ref from smile_ledger where user_id = ${userId} and reason = 'redeem' and ref like 'theme-%'`,
    );
    const earned = Number(r?.earned ?? 0);
    let activeTheme: string | null = null;
    try {
      const [t] = await rows<{ t: string | null }>(db, sql`select smile_theme as t from users where id = ${userId}::uuid`);
      activeTheme = t?.t ?? null;
    } catch {
      /* migration 0011 not applied yet: client falls back to localStorage */
    }
    return {
      available: true,
      balance: Number(r?.bal ?? 0),
      earned,
      level: smileLevel(earned),
      earnedToday: await earnedToday(db, userId, now),
      refCode: code,
      handle: u?.handle ?? null,
      owned: owned.map((o) => o.ref),
      activeTheme,
    };
  } catch (e) {
    return soft("status", emptySmileStatus())(e);
  }
}

export interface AwardResult {
  awarded: number;
  streak: number;
  status: SmileStatus;
}

/** Award a saved, valid Smiles card once per journey. Too-short drives earn nothing. */
export async function awardCard(
  userId: string,
  card: { journeyId: string; score: number; distanceKm: number; sound: string; country: string | null },
  now = Date.now(),
): Promise<AwardResult> {
  const none = async () => ({ awarded: 0, streak: 0, status: await getSmileStatus(userId, now) });
  if (!hasRewardsDb(userId)) return { awarded: 0, streak: 0, status: emptySmileStatus() };
  if (card.distanceKm * 1000 < SMILES_MIN_DISTANCE_M || card.score <= 0) return none();
  const founder = await isFounder(userId);
  try {
    const out = await getDb().transaction(async (tx) => {
      await lockUser(tx, userId);
      const already = await rows<{ id: string }>(
        tx,
        sql`select id from smile_ledger where user_id = ${userId} and reason = 'card' and ref = ${card.journeyId}`,
      );
      if (already.length) return { awarded: 0, streak: 0 };
      let today = await earnedToday(tx, userId, now);
      const amount = cappedAward(card.score, today, founder);
      // Record the card even at 0 so streak days count and the journey is never paid twice.
      await insertEntry(tx, { userId, amount, reason: "card", ref: card.journeyId, sound: card.sound, country: card.country });
      today += amount;
      let streak = 0;
      const days = await rows<{ d: string }>(
        tx,
        sql`select distinct to_char((created_at at time zone 'Europe/Berlin')::date,'YYYY-MM-DD') as d
            from smile_ledger where user_id = ${userId} and reason = 'card' and created_at > now() - interval '8 days'`,
      );
      const todayKey = berlinDay(now);
      if (hasStreak(days.map((d) => d.d), todayKey)) {
        const recent = await rows<{ id: string }>(
          tx,
          sql`select id from smile_ledger where user_id = ${userId} and reason = 'streak' and created_at > now() - interval '6 days'`,
        );
        const bonus = recent.length ? 0 : cappedAward(STREAK_BONUS, today, founder);
        if (bonus > 0 && (await insertEntry(tx, { userId, amount: bonus, reason: "streak", ref: todayKey, sound: card.sound, country: card.country })))
          streak = bonus;
      }
      await refreshTotals(tx, userId);
      return { awarded: amount, streak };
    });
    return { ...out, status: await getSmileStatus(userId, now) };
  } catch (e) {
    return soft("award", { awarded: 0, streak: 0, status: emptySmileStatus() })(e);
  }
}

/** +25% of a saved card's smiles for sharing it, max once per Berlin day. */
export async function awardShare(userId: string, journeyId: string, now = Date.now()): Promise<AwardResult> {
  if (!hasRewardsDb(userId)) return { awarded: 0, streak: 0, status: emptySmileStatus() };
  const founder = await isFounder(userId);
  try {
    const awarded = await getDb().transaction(async (tx) => {
      await lockUser(tx, userId);
      const [c] = await rows<{ amount: number; sound: string | null; country: string | null }>(
        tx,
        sql`select amount, sound, country from smile_ledger where user_id = ${userId} and reason = 'card' and ref = ${journeyId}`,
      );
      const [card] = await rows<{ score: number }>(
        tx,
        sql`select score from smiles_cards where user_id = ${userId} and journey_id = ${journeyId}`,
      );
      if (!c || !card) return 0;
      const amount = cappedAward(shareBonusBase(card.score), await earnedToday(tx, userId, now), founder);
      if (amount <= 0) return 0;
      const ok = await insertEntry(tx, { userId, amount, reason: "share", ref: berlinDay(now), sound: c.sound, country: c.country });
      if (ok) await refreshTotals(tx, userId);
      return ok ? amount : 0;
    });
    return { awarded, streak: 0, status: await getSmileStatus(userId, now) };
  } catch (e) {
    return soft("share", { awarded: 0, streak: 0, status: emptySmileStatus() })(e);
  }
}

/** New account arrived via ?ref=code: +100 to the referrer, once per new account. */
export async function applyReferral(userId: string, code: string): Promise<boolean> {
  if (!hasRewardsDb(userId) || !REF_CODE_RE.test(code)) return false;
  try {
    return await getDb().transaction(async (tx) => {
      const [me] = await rows<{ by: string | null; fresh: boolean }>(
        tx,
        sql`select smile_referred_by as by, created_at > now() - interval '3 days' as fresh from users where id = ${userId}::uuid`,
      );
      if (!me || me.by || !me.fresh) return false;
      const [ref] = await rows<{ id: string }>(tx, sql`select id::text as id from users where smile_ref_code = ${code}`);
      if (!ref || ref.id === userId) return false;
      await tx.execute(sql`update users set smile_referred_by = ${ref.id} where id = ${userId}::uuid`);
      await lockUser(tx, ref.id);
      const amount = cappedAward(REFERRAL_BONUS, 0, await isFounder(ref.id));
      const ok = await insertEntry(tx, { userId: ref.id, amount, reason: "referral", ref: userId });
      if (ok) await refreshTotals(tx, ref.id);
      return ok;
    });
  } catch (e) {
    return soft("referral", false)(e);
  }
}

export type RedeemResult = { ok: true; status: SmileStatus } | { ok: false; error: string };

export async function redeemItem(userId: string, itemId: string, now = Date.now()): Promise<RedeemResult> {
  const item = shopItem(itemId);
  if (!item || item.soon) return { ok: false, error: "Not in the shop yet." };
  if (!hasRewardsDb(userId)) return { ok: false, error: "Smile Shop is warming up. Try again soon." };
  try {
    const res = await getDb().transaction(async (tx) => {
      await lockUser(tx, userId);
      const [b] = await rows<{ bal: number }>(
        tx,
        sql`select coalesce(sum(amount),0)::int as bal from smile_ledger where user_id = ${userId}`,
      );
      if (Number(b?.bal ?? 0) < item.cost) return "Not enough smiles yet. Go drive!";
      const ref = item.kind === "theme" ? item.id : `${item.id}:${now}`;
      if (!(await insertEntry(tx, { userId, amount: -item.cost, reason: "redeem", ref }))) return "Already yours.";
      await refreshTotals(tx, userId);
      return null;
    });
    if (res) return { ok: false, error: res };
    if (item.kind === "drive_plus_trial") {
      // After commit: the pool has one connection, so never nest it inside the transaction.
      const { grantSmileDrivePlus } = await import("@/lib/accounts/accounts.server");
      await grantSmileDrivePlus(userId, 3);
    }
    return { ok: true, status: await getSmileStatus(userId, now) };
  } catch (e) {
    return soft<RedeemResult>("redeem", { ok: false, error: "Could not redeem right now." })(e);
  }
}

export async function setSmileHandle(userId: string, handle: string | null): Promise<boolean> {
  if (!hasRewardsDb(userId)) return false;
  try {
    await getDb().execute(sql`update users set smile_handle = ${handle} where id = ${userId}::uuid`);
    return true;
  } catch (e) {
    return soft("handle", false)(e);
  }
}

export interface BoardRow {
  name: string;
  smiles: number;
  me: boolean;
}
export interface BoardGroup {
  key: string;
  rows: BoardRow[];
}
export interface Leaderboard {
  weekOf: string;
  byCountry: BoardGroup[];
  bySound: BoardGroup[];
}

/** Weekly (Monday, Berlin) leaderboard. Shows handles or anonymous names, never emails. */
export async function getLeaderboard(viewerId: string | null, now = Date.now()): Promise<Leaderboard> {
  const weekOf = weekStart(now);
  const empty = { weekOf, byCountry: [], bySound: [] };
  if (!hasRewardsDb()) return empty;
  try {
    const db = getDb();
    const since = sql`(l.created_at at time zone 'Europe/Berlin')::date >= ${weekOf}::date`;
    const load = async (col: "country" | "sound") => {
      const data = await rows<{ k: string; uid: string; handle: string | null; n: number }>(
        db,
        sql`select coalesce(l.${sql.raw(col)}, '—') as k, l.user_id as uid, u.smile_handle as handle, sum(l.amount)::int as n
            from smile_ledger l left join users u on u.id::text = l.user_id
            where ${EARN} and ${since}
            group by 1, 2, 3 order by n desc limit 200`,
      );
      const groups = new Map<string, BoardRow[]>();
      for (const d of data) {
        const g = groups.get(d.k) ?? [];
        if (g.length < 5) g.push({ name: d.handle || anonName(d.uid), smiles: Number(d.n), me: d.uid === viewerId });
        groups.set(d.k, g);
      }
      return [...groups.entries()]
        .map(([key, r]) => ({ key, rows: r }))
        .sort((a, b) => (b.rows[0]?.smiles ?? 0) - (a.rows[0]?.smiles ?? 0))
        .slice(0, 6);
    };
    return { weekOf, byCountry: await load("country"), bySound: await load("sound") };
  } catch (e) {
    return soft<Leaderboard>("leaderboard", empty)(e);
  }
}

/** Store the active card theme; only owned themes (or default). False if not stored. */
export async function setSmileTheme(userId: string, themeId: string): Promise<boolean> {
  if (!hasRewardsDb(userId)) return false;
  try {
    const db = getDb();
    if (themeId !== "default") {
      const own = await rows<{ id: string }>(
        db,
        sql`select id from smile_ledger where user_id = ${userId} and reason = 'redeem' and ref = ${themeId}`,
      );
      if (!own.length) return false;
    }
    await db.execute(sql`update users set smile_theme = ${themeId} where id = ${userId}::uuid`);
    return true;
  } catch (e) {
    return soft("theme", false)(e);
  }
}
