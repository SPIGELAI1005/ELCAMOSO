import type { SmilesResult } from "@/lib/smiles/smiles";

export const MAX_UNPINNED_CARDS = 10;
export const MAX_PINNED_CARDS = 20;
export const PINNED_FULL_MESSAGE = `You can pin up to ${MAX_PINNED_CARDS} cards. Unpin or delete one first.`;

export interface SmilesCardRecord {
  id: string;
  journeyId: string;
  profileId: string;
  profileName: string;
  score: number;
  distanceKm: number;
  result: SmilesResult;
  pinned: boolean;
  createdAt: number;
}

export type SmilesCardInput = Omit<SmilesCardRecord, "id" | "pinned" | "createdAt">;

/** Newest first; keep all pinned + the newest 10 unpinned. Returns [kept, removedIds]. */
export function pruneCards(cards: SmilesCardRecord[]): [SmilesCardRecord[], string[]] {
  const sorted = [...cards].sort((a, b) => b.createdAt - a.createdAt);
  const kept: SmilesCardRecord[] = [];
  const removed: string[] = [];
  let unpinned = 0;
  for (const c of sorted) {
    if (c.pinned) kept.push(c);
    else if (unpinned < MAX_UNPINNED_CARDS) {
      unpinned++;
      kept.push(c);
    } else removed.push(c.id);
  }
  return [kept, removed];
}

export function upsertCard(
  cards: SmilesCardRecord[],
  input: SmilesCardInput,
  now = Date.now(),
  id = `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
): SmilesCardRecord[] {
  const existing = cards.find((c) => c.journeyId === input.journeyId);
  const next = existing
    ? cards.map((c) => (c.id === existing.id ? { ...c, ...input } : c))
    : [...cards, { ...input, id, pinned: false, createdAt: now }];
  return pruneCards(next)[0];
}

export function canPin(cards: SmilesCardRecord[]): boolean {
  return cards.filter((c) => c.pinned).length < MAX_PINNED_CARDS;
}

/* ---------- guest storage (localStorage) ---------- */
const KEY = "elcamoso.smilesCards.v1";

export function loadLocalCards(): SmilesCardRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SmilesCardRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCards(cards: SmilesCardRecord[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cards));
  } catch {
    /* storage full or unavailable */
  }
}
