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

  /** Writes are serialized so a chunk can never overwrite a newer one (or the final trace). */
  private writeQueue: Promise<unknown> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(fn, fn);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  appendChunk(chunk: JourneyTraceChunkV1): Promise<void> {
    // Only the chunk is written (cheap, constant size). The working trace is rebuilt from
    // chunks on load, so a crash / tab kill loses at most the last few seconds.
    return this.enqueue(async () => {
      if (!assertTracePrivacy({ samples: chunk.samples } as unknown as JourneyTraceV1)) return;
      await withStore(CHUNK_STORE, "readwrite", (s) => s.put(chunk));
    });
  }

  private async loadChunks(id: string): Promise<JourneyTraceChunkV1[]> {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHUNK_STORE, "readonly");
        const req = tx.objectStore(CHUNK_STORE).index("byJourney").getAll(id);
        req.onsuccess = () => resolve(req.result as JourneyTraceChunkV1[]);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async finalizeJourney(trace: JourneyTraceV1): Promise<void> {
    await this.enqueue(() => this.finalizeNow(trace));
  }

  private async finalizeNow(trace: JourneyTraceV1): Promise<void> {
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
      const trace = (row as JourneyTraceV1 | undefined) ?? null;
      if (!trace || trace.status !== "recording") return trace;
      return mergeChunksIntoTrace(trace, await this.loadChunks(id));
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

/** Rebuild a recording trace from its persisted chunks (pure, exported for tests). */
export function mergeChunksIntoTrace(
  trace: JourneyTraceV1,
  chunks: JourneyTraceChunkV1[],
): JourneyTraceV1 {
  if (!chunks.length) return trace;
  const ordered = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const byT = new Map<number, JourneyTraceV1["samples"][number]>();
  for (const s of trace.samples) byT.set(s.t, s);
  for (const c of ordered) for (const s of c.samples) byT.set(s.t, s);
  const samples = [...byT.values()].sort((a, b) => a.t - b.t);
  const eventKey = (e: { t: number; type: string }) => `${e.t}:${e.type}`;
  const events = new Map(trace.semanticEvents.map((e) => [eventKey(e), e]));
  for (const c of ordered) for (const e of c.events) events.set(eventKey(e), e);
  const gapKey = (g: { startT: number }) => g.startT;
  const gaps = new Map(trace.gaps.map((g) => [gapKey(g), g]));
  for (const c of ordered) for (const g of c.gaps) gaps.set(gapKey(g), g);
  const gapList = [...gaps.values()].sort((a, b) => a.startT - b.startT);
  let distanceM = 0;
  let speedSum = 0;
  let maxSpeed = 0;
  let moving = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    speedSum += s.speedKmh;
    maxSpeed = Math.max(maxSpeed, s.speedKmh);
    if (s.speedKmh > 3) moving++;
    const prev = samples[i - 1];
    if (prev) {
      const dt = (s.t - prev.t) / 1000;
      if (dt > 0 && dt < 10) distanceM += ((s.speedKmh + prev.speedKmh) / 2 / 3.6) * dt;
    }
  }
  const durationMs = Math.max(trace.durationMs, samples[samples.length - 1]?.t ?? 0);
  return {
    ...trace,
    samples,
    semanticEvents: [...events.values()].sort((a, b) => a.t - b.t).slice(0, 400),
    gaps: gapList,
    durationMs,
    summary: {
      ...trace.summary,
      sampleCount: samples.length,
      durationMs,
      distanceM: Math.max(trace.summary.distanceM, distanceM),
      meanSpeedKmh: samples.length ? speedSum / samples.length : 0,
      maxSpeedKmh: maxSpeed,
      movingShare: samples.length ? moving / samples.length : 0,
      gapCount: gapList.length,
      gapMs: gapList.reduce((a, g) => a + Math.max(0, g.endT - g.startT), 0),
    },
  };
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
