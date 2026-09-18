import type { JourneyInterpretationV1, JourneyTraceChunkV1, JourneyTraceV1 } from "./types";
import { assertTracePrivacy } from "./sampler";

const DB = "elcamoso-journey-traces";
const DB_VERSION = 1;
const TRACE_STORE = "traces";
const CHUNK_STORE = "chunks";
const INTERP_STORE = "interpretations";
const META_STORE = "meta";
const MAX_TRACES = 30;
const ACTIVE_KEY = "active-journey-id";

export interface JourneyRepository {
  createJourney(trace: JourneyTraceV1): Promise<void>;
  appendChunk(chunk: JourneyTraceChunkV1): Promise<void>;
  finalizeJourney(trace: JourneyTraceV1): Promise<void>;
  loadJourney(id: string): Promise<JourneyTraceV1 | null>;
  listJourneys(): Promise<JourneyTraceV1[]>;
  deleteJourney(id: string): Promise<void>;
  cleanupIncompleteJourney(id: string): Promise<void>;
  getActiveJourneyId(): Promise<string | null>;
  setActiveJourneyId(id: string | null): Promise<void>;
  saveInterpretation(interp: JourneyInterpretationV1): Promise<void>;
  listInterpretations(journeyId: string): Promise<JourneyInterpretationV1[]>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TRACE_STORE)) {
        db.createObjectStore(TRACE_STORE, { keyPath: "journeyId" });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, {
          keyPath: ["journeyId", "chunkIndex"],
        });
        store.createIndex("byJourney", "journeyId", { unique: false });
      }
      if (!db.objectStoreNames.contains(INTERP_STORE)) {
        const store = db.createObjectStore(INTERP_STORE, { keyPath: "id" });
        store.createIndex("byJourney", "journeyId", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const s = tx.objectStore(store);
    const req = fn(s);
    tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    tx.onerror = () => reject(tx.error);
    if (req) {
      req.onerror = () => reject(req.error);
    }
  });
}

class IndexedDbJourneyRepository implements JourneyRepository {
  async createJourney(trace: JourneyTraceV1): Promise<void> {
    if (!assertTracePrivacy(trace)) throw new Error("JourneyTrace rejected: privacy fields");
    const recording: JourneyTraceV1 = { ...trace, status: "recording", endedAt: null };
    await withStore(TRACE_STORE, "readwrite", (s) => s.put(recording));
    await this.setActiveJourneyId(trace.journeyId);
  }

  async appendChunk(chunk: JourneyTraceChunkV1): Promise<void> {
    await withStore(CHUNK_STORE, "readwrite", (s) => s.put(chunk));
    // Merge into working trace for crash recovery
    const existing = await this.loadJourney(chunk.journeyId);
    if (!existing) return;
    const mergedSamples = existing.samples.concat(chunk.samples);
    // Deduplicate by t
    const byT = new Map<number, (typeof mergedSamples)[0]>();
    for (const s of mergedSamples) byT.set(s.t, s);
    const samples = [...byT.values()].sort((a, b) => a.t - b.t);
    const next: JourneyTraceV1 = {
      ...existing,
      samples,
      semanticEvents: existing.semanticEvents.concat(chunk.events).slice(0, 400),
      gaps: existing.gaps.concat(chunk.gaps),
      durationMs: Math.max(existing.durationMs, samples[samples.length - 1]?.t ?? 0),
    };
    if (!assertTracePrivacy(next)) return;
    await withStore(TRACE_STORE, "readwrite", (s) => s.put(next));
  }

  async finalizeJourney(trace: JourneyTraceV1): Promise<void> {
    if (!assertTracePrivacy(trace)) throw new Error("JourneyTrace rejected: privacy fields");
    const complete: JourneyTraceV1 = {
      ...trace,
      status: trace.status === "incomplete" ? "incomplete" : "complete",
      endedAt: trace.endedAt ?? Date.now(),
    };
    await withStore(TRACE_STORE, "readwrite", (s) => s.put(complete));
    await this.setActiveJourneyId(null);
    await this.trimOld();
  }

  async loadJourney(id: string): Promise<JourneyTraceV1 | null> {
    try {
      const row = await withStore<JourneyTraceV1>(TRACE_STORE, "readonly", (s) => s.get(id));
      return (row as JourneyTraceV1 | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async listJourneys(): Promise<JourneyTraceV1[]> {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(TRACE_STORE, "readonly");
        const req = tx.objectStore(TRACE_STORE).getAll();
        req.onsuccess = () => {
          const rows = (req.result as JourneyTraceV1[]).sort((a, b) => b.startedAt - a.startedAt);
          resolve(rows);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async deleteJourney(id: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([TRACE_STORE, CHUNK_STORE, INTERP_STORE], "readwrite");
      tx.objectStore(TRACE_STORE).delete(id);
      const chunkIdx = tx.objectStore(CHUNK_STORE).index("byJourney");
      const range = IDBKeyRange.only(id);
      chunkIdx.openCursor(range).onsuccess = (ev) => {
        const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      const interpIdx = tx.objectStore(INTERP_STORE).index("byJourney");
      interpIdx.openCursor(range).onsuccess = (ev) => {
        const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const active = await this.getActiveJourneyId();
    if (active === id) await this.setActiveJourneyId(null);
  }

  async cleanupIncompleteJourney(id: string): Promise<void> {
    await this.deleteJourney(id);
  }

  async getActiveJourneyId(): Promise<string | null> {
    try {
      const row = await withStore<{ key: string; value: string | null }>(
        META_STORE,
        "readonly",
        (s) => s.get(ACTIVE_KEY),
      );
      return (row as { value?: string | null } | undefined)?.value ?? null;
    } catch {
      return null;
    }
  }

  async setActiveJourneyId(id: string | null): Promise<void> {
    try {
      await withStore(META_STORE, "readwrite", (s) => s.put({ key: ACTIVE_KEY, value: id }));
    } catch {
      /* ignore */
    }
  }

  async saveInterpretation(interp: JourneyInterpretationV1): Promise<void> {
    await withStore(INTERP_STORE, "readwrite", (s) => s.put(interp));
  }

  async listInterpretations(journeyId: string): Promise<JourneyInterpretationV1[]> {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(INTERP_STORE, "readonly");
        const idx = tx.objectStore(INTERP_STORE).index("byJourney");
        const req = idx.getAll(journeyId);
        req.onsuccess = () => resolve(req.result as JourneyInterpretationV1[]);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  private async trimOld() {
    const all = await this.listJourneys();
    const complete = all.filter((t) => t.status === "complete" || t.status === "incomplete");
    if (complete.length <= MAX_TRACES) return;
    const extra = complete
      .sort((a, b) => a.startedAt - b.startedAt)
      .slice(0, complete.length - MAX_TRACES);
    for (const t of extra) await this.deleteJourney(t.journeyId);
  }
}

let singleton: JourneyRepository | null = null;

export function getJourneyRepository(): JourneyRepository {
  if (!singleton) singleton = new IndexedDbJourneyRepository();
  return singleton;
}

/** Test helper */
export function __setJourneyRepositoryForTests(repo: JourneyRepository | null) {
  singleton = repo;
}
