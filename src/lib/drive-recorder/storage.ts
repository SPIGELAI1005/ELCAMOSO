/** IndexedDB persistence for drive logs (falls back to localStorage). Browser only. */
import type { DriveLog } from "./recorder-core";

const DB = "elcamoso-drive-recorder";
const STORE = "logs";
const LS_PREFIX = "elcamoso.driveLog.";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDriveLog(log: DriveLog): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await tx(db, "readwrite", (s) => s.put(log));
      return;
    } catch {
      /* fall through */
    } finally {
      db.close();
    }
  }
  try {
    localStorage.setItem(LS_PREFIX + log.id, JSON.stringify(log));
  } catch {
    /* quota – nothing else we can do */
  }
}

export async function listDriveLogs(): Promise<DriveLog[]> {
  const out: DriveLog[] = [];
  const db = await openDb();
  if (db) {
    try {
      out.push(
        ...(await tx<DriveLog[]>(db, "readonly", (s) => s.getAll() as IDBRequest<DriveLog[]>)),
      );
    } catch {
      /* ignore */
    } finally {
      db.close();
    }
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX) && !out.some((l) => LS_PREFIX + l.id === k)) {
        out.push(JSON.parse(localStorage.getItem(k)!) as DriveLog);
      }
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function deleteDriveLog(id: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await tx(db, "readwrite", (s) => s.delete(id));
    } catch {
      /* ignore */
    } finally {
      db.close();
    }
  }
  try {
    localStorage.removeItem(LS_PREFIX + id);
  } catch {
    /* ignore */
  }
}

export async function gzipJson(value: unknown): Promise<Blob> {
  const json = JSON.stringify(value);
  if (typeof CompressionStream === "undefined")
    return new Blob([json], { type: "application/json" });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Blob([await new Response(stream).arrayBuffer()], { type: "application/gzip" });
}
