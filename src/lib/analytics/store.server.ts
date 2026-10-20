/**
 * Analytics storage on Vercel Blob (private store via blob-env helper).
 * Raw: analytics/raw/<day>/<rand>.json (one put per client batch).
 * Daily: analytics/daily/<day>.json (compacted once a day is over; raw files then deleted).
 * Broadcast: broadcast/messages.json (overwritten by admin).
 */
import { blobAccess, blobConfigured, resolveBlobAuth } from "@/lib/blob/blob-env.server";

import {
  addBatch,
  dayOf,
  emptyDay,
  sanitizeBatch,
  type AnalyticsBatch,
  type DayAggregate,
} from "./events";

const auth = () => resolveBlobAuth().opts;
export const analyticsConfigured = () => blobConfigured();

const hits = new Map<string, number[]>();
function limited(key: string, max = 30, windowMs = 3600_000) {
  const now = Date.now();
  const l = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  l.push(now);
  hits.set(key, l);
  if (hits.size > 5000) hits.clear();
  return l.length > max;
}

export async function ingestBatch(request: Request) {
  if (!analyticsConfigured()) return { status: 503, body: { error: "Analytics not configured" } };
  const text = (await request.text()).slice(0, 49_000);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  const b = sanitizeBatch(raw);
  if (!b) return { status: 400, body: { error: "Invalid batch" } };
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "?";
  if (limited(`ip:${ip}`) || limited(`d:${b.deviceId}`, 12))
    return { status: 429, body: { error: "Too many batches" } };
  const { put } = await import("@vercel/blob");
  const day = dayOf(Date.now());
  const res = await put(`analytics/raw/${day}/${b.device}.json`, JSON.stringify(b), {
    access: blobAccess(),
    addRandomSuffix: true,
    contentType: "application/json",
    ...auth(),
  });
  return { status: 200, body: { ok: true, events: b.events.length, ref: res.pathname.split("/").pop() } };
}

async function readJson<T>(url: string): Promise<T | null> {
  const { get } = await import("@vercel/blob");
  const g = await get(url, { access: blobAccess(), useCache: false, ...auth() });
  if (!g || !g.stream) return null;
  return (await new Response(g.stream).json()) as T;
}

async function listAll(prefix: string) {
  const { list } = await import("@vercel/blob");
  const out: { url: string; pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}), ...auth() });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && out.length < 10_000);
  return out;
}

/** Load daily aggregates for the last `days` days; compacts finished days. */
export async function loadDays(days = 30): Promise<DayAggregate[]> {
  const { put, del } = await import("@vercel/blob");
  const today = dayOf(Date.now());
  const since = dayOf(Date.now() - (days - 1) * 86400_000);
  const [raws, dailies] = await Promise.all([listAll("analytics/raw/"), listAll("analytics/daily/")]);
  const map = new Map<string, DayAggregate>();
  await Promise.all(
    dailies
      .filter((d) => (d.pathname.split("/").pop() ?? "").slice(0, 10) >= since)
      .map(async (d) => {
        const a = await readJson<DayAggregate>(d.url).catch(() => null);
        if (a) map.set(a.day, a);
      }),
  );
  const byDay = new Map<string, typeof raws>();
  for (const r of raws) {
    const day = r.pathname.split("/")[2] ?? "";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r);
  }
  for (const [day, files] of byDay) {
    const agg = new Map<string, DayAggregate>();
    if (map.has(day)) agg.set(day, map.get(day)!);
    const batches = await Promise.all(files.map((f) => readJson<AnalyticsBatch>(f.url).catch(() => null)));
    for (const b of batches) if (b) addBatch(agg, b);
    for (const [d, a] of agg) map.set(d, mergeInto(map.get(d), a, d === day));
    if (day < today && batches.every(Boolean)) {
      // Compact: one daily file, raw files removed (keeps future reads cheap).
      const a = map.get(day) ?? emptyDay(day);
      await put(`analytics/daily/${day}.json`, JSON.stringify(a), {
        access: blobAccess(),
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        ...auth(),
      }).catch(() => undefined);
      await del(files.map((f) => f.url), { ...auth() }).catch(() => undefined);
    }
  }
  return [...map.values()].filter((a) => a.day >= since).sort((a, b) => a.day.localeCompare(b.day));
}

function mergeInto(prev: DayAggregate | undefined, next: DayAggregate, replace: boolean) {
  return replace || !prev ? next : next;
}

/** Delete test events by recomputing nothing: test events are counted separately (a.test) and never mixed in. */

/* ---------------- broadcast ---------------- */
export interface BroadcastMessage {
  id: string;
  at: string;
  title: string;
  body: string;
}
const BROADCAST = "broadcast/messages.json";

export async function readBroadcast(): Promise<BroadcastMessage[]> {
  if (!analyticsConfigured()) return [];
  const files = await listAll("broadcast/");
  const f = files.find((x) => x.pathname === BROADCAST);
  if (!f) return [];
  return (await readJson<BroadcastMessage[]>(f.url).catch(() => null)) ?? [];
}

export async function writeBroadcast(list: BroadcastMessage[]) {
  const { put } = await import("@vercel/blob");
  await put(BROADCAST, JSON.stringify(list.slice(-20)), {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...auth(),
  });
}
