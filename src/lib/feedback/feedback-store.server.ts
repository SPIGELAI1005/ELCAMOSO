import { validateFeedback, type FeedbackRecord } from "./feedback-core";

const PREFIX = "feedback/";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

/** Best-effort per-instance rate limit (serverless instances do not share memory). */
export function rateLimited(key: string, now = Date.now()): boolean {
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const token = () => process.env["BLOB_READ_WRITE_TOKEN"]?.trim();
export const feedbackConfigured = () => Boolean(token());

export async function submitFeedback(request: Request) {
  if (!feedbackConfigured())
    return { status: 503, body: { error: "Feedback is not available right now." } };
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 8000) return { status: 413, body: { error: "Too large." } };
  let raw: unknown;
  try {
    raw = JSON.parse((await request.text()).slice(0, 8000));
  } catch {
    return { status: 400, body: { error: "Invalid request." } };
  }
  const v = validateFeedback(raw);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (rateLimited(`ip:${ip}`) || rateLimited(`c:${v.value.clientId}`))
    return { status: 429, body: { error: "Too many messages. Please try again later." } };
  const now = new Date();
  const id = `${now.getTime().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  // Spam is silently accepted (so bots learn nothing) but not stored.
  if (v.spam) return { status: 200, body: { ok: true, id, at: now.toISOString() } };
  const record: FeedbackRecord = {
    id,
    at: now.toISOString(),
    ...v.value,
    context: v.value.context ?? {},
    userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? undefined,
    status: v.value.message.startsWith("[TEST]") ? "test" : "new",
  };
  const { put } = await import("@vercel/blob");
  await put(`${PREFIX}${now.toISOString().slice(0, 10)}/${id}.json`, JSON.stringify(record), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
    token: token() ?? "",
  });
  return { status: 200, body: { ok: true, id, at: record.at } };
}

export async function listFeedback(limit = 200) {
  const { list } = await import("@vercel/blob");
  const blobs: { url: string; pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: PREFIX, ...(cursor ? { cursor } : {}), limit: 1000, token: token() ?? "" });
    blobs.push(...res.blobs);
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor && blobs.length < 5000);
  blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  const items = await Promise.all(
    blobs.slice(0, limit).map(async (b) => {
      try {
        const r = await fetch(b.url, { cache: "no-store" });
        return { ...((await r.json()) as FeedbackRecord), blobUrl: b.url };
      } catch {
        return null;
      }
    }),
  );
  return { total: blobs.length, items: items.filter(Boolean) };
}

export async function deleteFeedback(blobUrl: string) {
  if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\/feedback\//i.test(blobUrl))
    throw new Error("Not a feedback blob");
  const { del } = await import("@vercel/blob");
  await del(blobUrl, { token: token() ?? "" });
}
