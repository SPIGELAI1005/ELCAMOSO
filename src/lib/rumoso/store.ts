/**
 * Persist recent runs locally (IndexedDB, with a localStorage fallback).
 * No database migration, no server write.
 */
import { downsample } from "./track";
import type { StoredRun, StoredRunSummary } from "./types";

const DB_NAME = "elcamoso-rumoso";
const STORE = "runs";
const LS_KEY = "elcamoso.rumoso.runs";
const MAX_RUNS = 20;
const MAX_POINTS = 1800;
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("startedAt", "startedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function compact(run: StoredRun): StoredRun {
  return { ...run, points: downsample(run.points, MAX_POINTS) };
}

export async function saveRun(run: StoredRun): Promise<void> {
  const packed = compact(run);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(packed);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await trimRuns();
    db.close();
  } catch {
    saveToLocalStorage(packed);
  }
}

export async function listRuns(limit = MAX_RUNS): Promise<StoredRunSummary[]> {
  try {
    const db = await openDb();
    const rows = await new Promise<StoredRun[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredRun[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .slice(0, limit)
      .map(toSummary);
  } catch {
    return readLocalStorage().map(toSummary).slice(0, limit);
  }
}

export async function getRun(id: string): Promise<StoredRun | null> {
  try {
    const db = await openDb();
    const row = await new Promise<StoredRun | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as StoredRun | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row ?? null;
  } catch {
    return readLocalStorage().find((r) => r.id === id) ?? null;
  }
}

export async function deleteRun(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const next = readLocalStorage().filter((r) => r.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }
}

async function trimRuns(): Promise<void> {
  const all = await listRuns(1000);
  if (all.length <= MAX_RUNS) return;
  for (const extra of all.slice(MAX_RUNS)) await deleteRun(extra.id);
}

function toSummary(run: StoredRun): StoredRunSummary {
  return {
    id: run.id,
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    distanceM: run.distanceM,
    avgPaceSecPerKm: run.avgPaceSecPerKm,
    avgEffort: run.avgEffort,
  };
}

function readLocalStorage(): StoredRun[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(run: StoredRun): void {
  const all = [run, ...readLocalStorage().filter((r) => r.id !== run.id)].slice(0, MAX_RUNS);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
