import type { CalibrationSubjectiveNote, CalibrationTrace } from "@/lib/calibration/types";
import { parseCalibrationTrace } from "@/lib/calibration/serialize";

const TRACE_KEY = "elcamoso.calibration.traces.v1";
const NOTES_KEY = "elcamoso.calibration.notes.v1";
const MAX_TRACES = 8;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function listStoredCalibrationTraces(): CalibrationTrace[] {
  const list = readJson<unknown[]>(TRACE_KEY, []);
  const out: CalibrationTrace[] = [];
  for (const item of list) {
    try {
      out.push(parseCalibrationTrace(item));
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

export function saveCalibrationTraceLocally(trace: CalibrationTrace) {
  const list = listStoredCalibrationTraces().filter((t) => t.id !== trace.id);
  list.unshift(trace);
  writeJson(TRACE_KEY, list.slice(0, MAX_TRACES));
}

export function deleteStoredCalibrationTrace(id: string) {
  writeJson(
    TRACE_KEY,
    listStoredCalibrationTraces().filter((t) => t.id !== id),
  );
}

export function listSubjectiveNotes(traceId?: string): CalibrationSubjectiveNote[] {
  const all = readJson<CalibrationSubjectiveNote[]>(NOTES_KEY, []);
  return traceId ? all.filter((n) => n.traceId === traceId) : all;
}

export function saveSubjectiveNote(note: CalibrationSubjectiveNote) {
  const all = listSubjectiveNotes().filter((n) => n.id !== note.id);
  all.unshift(note);
  writeJson(NOTES_KEY, all.slice(0, 40));
}
