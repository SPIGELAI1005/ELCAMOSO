import type { JourneySummary } from "./types";

const DB = "elcamoso-journeys";
const JOURNEY_STORE = "journeys";
const AUDIO_STORE = "song-audio";
const MAX_JOURNEYS = 40;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(JOURNEY_STORE)) {
        db.createObjectStore(JOURNEY_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveJourney(summary: JourneySummary): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(JOURNEY_STORE, "readwrite");
    tx.objectStore(JOURNEY_STORE).put(summary);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const all = await listJourneys();
  if (all.length > MAX_JOURNEYS) {
    const extra = all.sort((a, b) => a.createdAt - b.createdAt).slice(0, all.length - MAX_JOURNEYS);
    for (const j of extra) await deleteJourney(j.id);
  }
}

export async function listJourneys(): Promise<JourneySummary[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(JOURNEY_STORE, "readonly");
    const req = tx.objectStore(JOURNEY_STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as JourneySummary[]).sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getJourney(id: string): Promise<JourneySummary | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(JOURNEY_STORE, "readonly");
    const req = tx.objectStore(JOURNEY_STORE).get(id);
    req.onsuccess = () => resolve((req.result as JourneySummary | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteJourney(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([JOURNEY_STORE, AUDIO_STORE], "readwrite");
    tx.objectStore(JOURNEY_STORE).delete(id);
    tx.objectStore(AUDIO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSongAudio(journeyId: string, blob: Blob): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).put({ id: journeyId, blob, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSongAudio(journeyId: string): Promise<Blob | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const req = tx.objectStore(AUDIO_STORE).get(journeyId);
    req.onsuccess = () => {
      const row = req.result as { blob?: Blob } | undefined;
      resolve(row?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}
