/** Device-local in-app inbox: drive summaries + app notifications. */
import { useEffect, useState } from "react";

import type { JourneySummary } from "@/lib/journey/types";
import {
  computeSmiles,
  fmtDistance,
  fmtMoney,
  loadSmilesSettings,
  type SmilesResult,
} from "@/lib/smiles/smiles";
import { getProfile } from "@/lib/sound/profiles";

export interface InboxMessage {
  id: string;
  at: string;
  kind: "drive" | "system";
  title: string;
  body: string;
  journeyId?: string | undefined;
  read: boolean;
}

/** App notifications shown once as system messages. */
export const SYSTEM_MESSAGES: Omit<InboxMessage, "read">[] = [
  {
    id: "sys-smiles-2026-10",
    at: "2026-10-20T12:00:00.000Z",
    kind: "system",
    title: "New: Smiles per Mile",
    body: "After every drive you'll see what the virtual engine would have burned, what you saved and your smile score.",
  },
  {
    id: "sys-sounds-2026-10",
    at: "2026-10-19T12:00:00.000Z",
    kind: "system",
    title: "Sounds updated",
    body: "Racing V10 idle, rally-style idles, turbo flutter and the Superbike over-rev got a big refresh.",
  },
  {
    id: "sys-driveplus",
    at: "2026-10-18T12:00:00.000Z",
    kind: "system",
    title: "Drive+",
    body: "Unlock every Sound Profile and Race mode with Drive+. See Pricing for details.",
  },
];

const KEY = "elcamoso.inbox.v1";
const SEEN_SYS = "elcamoso.inbox.sys.v1";
const EVT = "elcamoso-inbox";
export const PENDING_DRIVE_KEY = "elcamoso.pendingDrive.v1";
export const MIN_SMILES_DISTANCE_M = 200;
export const MIN_SMILES_DURATION_MS = 60_000;

function read(): InboxMessage[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as InboxMessage[]) : [];
  } catch {
    return [];
  }
}
function write(list: InboxMessage[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-60)));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

const BC_CACHE = "elcamoso.inbox.broadcast.v1";
const BC_AT = "elcamoso.inbox.broadcastAt.v1";
/** Fetch admin broadcasts at most hourly (CDN-cached endpoint). */
export async function refreshBroadcast(force = false) {
  try {
    const last = Number(localStorage.getItem(BC_AT) ?? 0);
    if (!force && Date.now() - last < 3600_000) return;
    localStorage.setItem(BC_AT, String(Date.now()));
    const r = await fetch("/api/broadcast");
    if (!r.ok) return;
    const { messages } = (await r.json()) as { messages?: { id: string; at: string; title: string; body: string }[] };
    localStorage.setItem(BC_CACHE, JSON.stringify((messages ?? []).slice(-20)));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* offline */
  }
}
function broadcastSystem(): Omit<InboxMessage, "read">[] {
  try {
    const l = JSON.parse(localStorage.getItem(BC_CACHE) ?? "[]") as { id: string; at: string; title: string; body: string }[];
    return l.map((m) => ({ id: `bc:${m.id}`, at: m.at, kind: "system" as const, title: m.title, body: m.body }));
  } catch {
    return [];
  }
}

/** Merge system notifications (once each) and return all messages, oldest first. */
export function loadInbox(): InboxMessage[] {
  const list = read();
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_SYS) ?? "[]") as string[];
  } catch {
    seen = [];
  }
  const fresh = [...SYSTEM_MESSAGES, ...broadcastSystem()].filter((m) => !seen.includes(m.id));
  if (fresh.length) {
    try {
      localStorage.setItem(SEEN_SYS, JSON.stringify([...seen, ...fresh.map((m) => m.id)]));
    } catch {
      /* ignore */
    }
    const next = [...list, ...fresh.map((m) => ({ ...m, read: false }))];
    write(next);
    return sortInbox(next);
  }
  return sortInbox(list);
}
const sortInbox = (l: InboxMessage[]) => [...l].sort((a, b) => a.at.localeCompare(b.at));

export function markInboxRead() {
  const l = read();
  if (l.some((m) => !m.read)) write(l.map((m) => ({ ...m, read: true })));
}

export function useInboxUnread(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN(loadInbox().filter((m) => !m.read).length);
    f();
    window.addEventListener(EVT, f);
    window.addEventListener("storage", f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener("storage", f);
    };
  }, []);
  return n;
}

export function isSmilesWorthy(j: Pick<JourneySummary, "distanceM" | "durationMs">) {
  return (j.distanceM ?? 0) >= MIN_SMILES_DISTANCE_M && j.durationMs >= MIN_SMILES_DURATION_MS;
}

export function smilesForJourney(j: JourneySummary): SmilesResult {
  const p = getProfile(j.profileId);
  return computeSmiles(
    {
      profileId: j.profileId,
      category: p.category,
      distanceM: j.distanceM ?? 0,
      durationMs: j.durationMs,
      trace: null,
      live: j.smiles,
    },
    loadSmilesSettings(),
  );
}

export function addDriveMessage(j: JourneySummary) {
  if (!isSmilesWorthy(j)) return;
  const list = read();
  if (list.some((m) => m.journeyId === j.id)) return;
  const r = smilesForJourney(j);
  const s = loadSmilesSettings();
  const saved = r.saved > 0 ? `, ${fmtMoney(r.saved, s.currency)} saved` : "";
  write([
    ...list,
    {
      id: `drive-${j.id}`,
      at: new Date(j.createdAt + j.durationMs).toISOString(),
      kind: "drive",
      title: "Your last drive",
      body: `${r.score} smiles${saved} · ${fmtDistance(r.distanceKm, s.units)} with ${getProfile(j.profileId).name}`,
      journeyId: j.id,
      read: false,
    },
  ]);
}

/** Deliver a drive persisted on pagehide (tab closed without STOP). Returns it when delivered. */
export async function deliverPendingDrive(): Promise<JourneySummary | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_DRIVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    localStorage.removeItem(PENDING_DRIVE_KEY);
    const j = JSON.parse(raw) as JourneySummary;
    if (!j?.id) return null;
    const { saveJourney } = await import("@/lib/journey");
    await saveJourney(j);
    addDriveMessage(j);
    return j;
  } catch {
    return null;
  }
}
