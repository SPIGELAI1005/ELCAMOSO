/**
 * Once-per-account, once-per-special congratulations after sign-in (Black Friday Special,
 * then Cyber Monday Special: an account that saw the Black Friday modal sees the Cyber
 * Monday one once).
 * localStorage is a fast cache only; the server column `users.bf_welcome_seen_at`
 * is the source of truth across devices.
 */
import { driveSpecialWindowForCopy, isDriveSpecialActive } from "@/lib/billing/drive-special";

const KEY = "elcamoso.bfWelcome.v1";
const memoryFallback = new Map<string, string>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function readSeen(accountId: string, now: number): string | null {
  const k = seenKey(accountId, now);
  try {
    const fromStorage = storage()?.getItem(k);
    if (fromStorage != null) return fromStorage;
  } catch {
    /* ignore */
  }
  return memoryFallback.get(k) ?? null;
}

function writeSeen(accountId: string, now: number) {
  const k = seenKey(accountId, now);
  memoryFallback.set(k, "1");
  try {
    storage()?.setItem(k, "1");
  } catch {
    /* ignore */
  }
}

/** Black Friday keeps its original key; later specials get their own. */
function seenKey(accountId: string, now: number) {
  const id = driveSpecialWindowForCopy(now).id;
  return id === "black-friday" ? `${KEY}:${accountId}` : `${KEY}.${id}:${accountId}`;
}

export function hasSeenBlackFridayWelcome(accountId: string, now = Date.now()): boolean {
  if (!accountId) return true;
  return readSeen(accountId, now) === "1";
}

export function markBlackFridayWelcomeSeen(accountId: string, now = Date.now()) {
  if (!accountId) return;
  writeSeen(accountId, now);
}

export function shouldShowBlackFridayWelcome(
  accountId: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!accountId) return false;
  if (!isDriveSpecialActive(now)) return false;
  return !hasSeenBlackFridayWelcome(accountId, now);
}

export function resetBlackFridayWelcomeForTests() {
  memoryFallback.clear();
  try {
    const s = storage();
    if (!s) return;
    const remove: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(KEY)) remove.push(k);
    }
    for (const k of remove) s.removeItem(k);
  } catch {
    /* ignore */
  }
}
