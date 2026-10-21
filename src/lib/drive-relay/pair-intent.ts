import { sanitizeReturnTo } from "@/lib/account/return-to";

/** Remembers a scanned /pair link across login (magic links may open a new tab). */
const KEY = "elcamoso.pendingPair";
const TTL_MS = 30 * 60 * 1000;

export function isPairPath(path: string): boolean {
  return /^\/pair\/[A-Za-z0-9_-]+(\?.*)?$/.test(path);
}

export function savePendingPair(path: string): void {
  if (typeof window === "undefined" || !isPairPath(path)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function clearPendingPair(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Returns a same-origin /pair path if one is pending and fresh, and clears it. */
export function takePendingPair(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof parsed.path !== "string" || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) return null;
    const safe = sanitizeReturnTo(parsed.path);
    return safe === parsed.path && isPairPath(safe) ? safe : null;
  } catch {
    return null;
  }
}
