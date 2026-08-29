import type { DriveState } from "@/lib/drive/model";

const DB = "elcamoso-traces";
const STORE = "traces";
const MAX_TRACES = 12;
const SAMPLE_MS = 100;

export interface DriveTrace {
  id: string;
  startedAt: number;
  durationMs: number;
  profileId: string;
  samples: DriveState[];
  /** compact stats for the coach, no raw GPS */
  aggregates: TraceAggregates;
}

export interface TraceAggregates {
  sampleCount: number;
  meanSpeedMps: number;
  maxSpeedMps: number;
  throttleShare: number;
  regenShare: number;
  durationMs: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function emptyAggregates(): TraceAggregates {
  return {
    sampleCount: 0,
    meanSpeedMps: 0,
    maxSpeedMps: 0,
    throttleShare: 0,
    regenShare: 0,
    durationMs: 0,
  };
}

export function summarise(samples: DriveState[], durationMs: number): TraceAggregates {
  if (!samples.length) return { ...emptyAggregates(), durationMs };
  let speed = 0;
  let max = 0;
  let throttle = 0;
  let regen = 0;
  for (const s of samples) {
    speed += s.speed;
    if (s.speed > max) max = s.speed;
    if (s.throttle > 0.2) throttle += 1;
    if (s.regen > 0.2) regen += 1;
  }
  const n = samples.length;
  return {
    sampleCount: n,
    meanSpeedMps: speed / n,
    maxSpeedMps: max,
    throttleShare: throttle / n,
    regenShare: regen / n,
    durationMs,
  };
}

export class TraceRecorder {
  private samples: DriveState[] = [];
  private last = 0;
  private startedAt = 0;
  private profileId = "";

  start(profileId: string) {
    this.samples = [];
    this.last = 0;
    this.startedAt = Date.now();
    this.profileId = profileId;
  }

  push(state: DriveState) {
    const now = performance.now();
    if (now - this.last < SAMPLE_MS) return;
    this.last = now;
    this.samples.push({ ...state });
    if (this.samples.length > 18000) this.samples.shift();
  }

  snapshot(): DriveTrace | null {
    if (this.samples.length < 8) return null;
    const durationMs = Date.now() - this.startedAt;
    return {
      id: `trace-${this.startedAt}`,
      startedAt: this.startedAt,
      durationMs,
      profileId: this.profileId,
      samples: this.samples,
      aggregates: summarise(this.samples, durationMs),
    };
  }
}

export async function saveTrace(trace: DriveTrace): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(trace);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const all = await listTraces();
  if (all.length > MAX_TRACES) {
    const extra = all.sort((a, b) => a.startedAt - b.startedAt).slice(0, all.length - MAX_TRACES);
    const db2 = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db2.transaction(STORE, "readwrite");
      extra.forEach((t) => tx.objectStore(STORE).delete(t.id));
      tx.oncomplete = () => resolve();
    });
  }
}

export async function listTraces(): Promise<DriveTrace[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as DriveTrace[]).sort((a, b) => b.startedAt - a.startedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getTrace(id: string): Promise<DriveTrace | null> {
  const all = await listTraces();
  return all.find((t) => t.id === id) ?? null;
}
