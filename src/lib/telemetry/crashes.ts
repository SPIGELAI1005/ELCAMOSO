import { reportRuntimeError } from "@/lib/runtime-error-reporting";

export interface CrashRecord {
  at: number;
  message: string;
  kind: "crash" | "audio";
  route: string;
}

const KEY = "elcamoso.crashes";
const MAX = 12;

export function readCrashes(): CrashRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CrashRecord[]) : [];
  } catch {
    return [];
  }
}

function persist(record: CrashRecord) {
  const next = [...readCrashes(), record].slice(-MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function reportCrash(error: unknown, kind: CrashRecord["kind"] = "crash") {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  const record: CrashRecord = {
    at: Date.now(),
    message: message.slice(0, 240),
    kind,
    route: typeof window !== "undefined" ? window.location.pathname : "/",
  };
  if (typeof window !== "undefined") persist(record);
  reportRuntimeError(error, { kind, privacy: "no-motion" });
  return record;
}

export function reportAudioError(error: unknown) {
  return reportCrash(error, "audio");
}

export function installCrashReporting() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __elcamosoCrash?: boolean };
  if (w.__elcamosoCrash) return;
  w.__elcamosoCrash = true;
  window.addEventListener("error", (event) => {
    reportCrash(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportCrash(event.reason);
  });
}
