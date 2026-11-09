/**
 * Once-per-account Black Friday congratulations after sign-in.
 * localStorage is a fast cache only; the server column `users.bf_welcome_seen_at`
 * is the source of truth across devices.
 */
import { isDriveSpecialActive } from "@/lib/billing/drive-special";

const KEY = "elcamoso.bfWelcome.v1";
const memoryFallback = new Map<string, string>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function readSeen(accountId: string): string | null {
  const k = seenKey(accountId);
  try {
    const fromStorage = storage()?.getItem(k);
    if (fromStorage != null) return fromStorage;
  } catch {
    /* ignore */
  }
  return memoryFallback.get(k) ?? null;
}

function writeSeen(accountId: string) {
  const k = seenKey(accountId);
  memoryFallback.set(k, "1");
  try {
    storage()?.setItem(k, "1");
  } catch {
    /* ignore */
  }
}

function seenKey(accountId: string) {
  return `${KEY}:${accountId}`;
}

export function hasSeenBlackFridayWelcome(accountId: string): boolean {
  if (!accountId) return true;
  return readSeen(accountId) === "1";
}

export function markBlackFridayWelcomeSeen(accountId: string) {
  if (!accountId) return;
  writeSeen(accountId);
}

export function shouldShowBlackFridayWelcome(
  accountId: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!accountId) return false;
  if (!isDriveSpecialActive(now)) return false;
  return !hasSeenBlackFridayWelcome(accountId);
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
