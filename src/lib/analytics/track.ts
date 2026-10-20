/**
 * Client-side anonymous analytics. Only active when the user enabled
 * Settings → Usage insights (analyticsEnabled). Events are batched in
 * localStorage and sent at most every 15 minutes or when the tab is hidden,
 * so each session costs ~1–3 Blob writes.
 */
import { readSettings } from "@/lib/drive/settings";
import { installId } from "@/lib/telemetry/analytics";
import { detectDevice } from "@/lib/feedback/feedback-core";

import type { AnalyticsEvent, AnalyticsEventType } from "./events";

const Q = "elcamoso.analytics.queue.v1";
const LAST = "elcamoso.analytics.lastFlush.v1";
const FLUSH_EVERY_MS = 15 * 60_000;
const MAX_QUEUE = 300;

function enabled() {
  try {
    return readSettings().analyticsEnabled === true;
  } catch {
    return false;
  }
}
function readQ(): AnalyticsEvent[] {
  try {
    const v = JSON.parse(localStorage.getItem(Q) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeQ(l: AnalyticsEvent[]) {
  try {
    localStorage.setItem(Q, JSON.stringify(l.slice(-MAX_QUEUE)));
  } catch {
    /* ignore */
  }
}

export function track(t: AnalyticsEventType, p?: AnalyticsEvent["p"]) {
  if (typeof window === "undefined" || !enabled()) return;
  writeQ([...readQ(), { t, at: Date.now(), ...(p ? { p } : {}) }]);
  maybeFlush(false);
}

function device() {
  return detectDevice(navigator.userAgent, window.innerWidth) as
    | "tesla"
    | "phone"
    | "tablet"
    | "desktop";
}

export function maybeFlush(force: boolean) {
  if (typeof window === "undefined") return;
  const q = readQ();
  if (!q.length) return;
  if (!enabled()) {
    writeQ([]);
    return;
  }
  const last = Number(localStorage.getItem(LAST) ?? 0);
  const gap = Date.now() - last;
  if (force ? gap < 120_000 : gap < FLUSH_EVERY_MS) return;
  const body = JSON.stringify({ deviceId: installId(), device: device(), events: q });
  localStorage.setItem(LAST, String(Date.now()));
  writeQ([]);
  const sent =
    typeof navigator.sendBeacon === "function" &&
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
  if (!sent) {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => writeQ([...q, ...readQ()]));
  }
}

let installed = false;
/** Call once on app start: session event, error hooks, flush on hide. */
export function installAnalytics() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  track("session_start", { path: location.pathname.slice(0, 40) });
  window.addEventListener("error", (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target !== (window as unknown as HTMLElement) && "src" in target) {
      const src = String((target as HTMLAudioElement).src ?? "");
      if (/\.(mp3|wav|ogg|m4a|flac|opus)(\?|$)|sound-assets/i.test(src)) {
        track("sound_load_fail", { kind: "asset" });
        return;
      }
    }
    track("client_error", { msg: String(e.message || "error").slice(0, 80) });
  }, true);
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e.reason as Error)?.message ?? e.reason ?? "rejection").slice(0, 80);
    track(/audio|decode|sound|worklet/i.test(msg) ? "sound_load_fail" : "client_error", { msg });
  });
  // Existing app telemetry hook: audio errors.
  window.addEventListener("elcamoso:analytics", (e) => {
    const d = (e as CustomEvent<{ name: string }>).detail;
    if (d?.name === "audio_error") track("sound_load_fail", { kind: "audio_error" });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) maybeFlush(true);
  });
  window.addEventListener("pagehide", () => maybeFlush(true));
  window.setInterval(() => maybeFlush(false), 5 * 60_000);
}
