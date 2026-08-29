export type AnalyticsName =
  | "garage_open"
  | "studio_preset_save"
  | "studio_listen"
  | "calibrate_complete"
  | "share_create"
  | "audio_error"
  | "pricing_viewed"
  | "dynamic_trial_offered"
  | "dynamic_trial_started"
  | "dynamic_trial_session_started"
  | "dynamic_trial_session_completed"
  | "dynamic_trial_low_remaining"
  | "dynamic_trial_exhausted"
  | "premium_feature_clicked"
  | "upgrade_clicked"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_canceled"
  | "subscription_started"
  | "subscription_canceled"
  | "plan_interval_selected";

export interface AnalyticsEvent {
  name: AnalyticsName;
  at: number;
  /** coarse labels only: never GPS, DriveState, or audio buffers */
  meta?: Record<string, string | number | boolean>;
}

const INSTALL_KEY = "elcamoso.installId";
const QUEUE_KEY = "elcamoso.telemetry.queue";
const MAX_QUEUE = 40;

export function installId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(INSTALL_KEY);
    if (existing) return existing;
    const id = `elc-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(INSTALL_KEY, id);
    return id;
  } catch {
    return "ephemeral";
  }
}

function readQueue(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: AnalyticsEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE)));
  } catch {
    /* storage full: drop */
  }
}

export function trackEvent(name: AnalyticsName, meta?: AnalyticsEvent["meta"]) {
  if (typeof window === "undefined") return;
  const event: AnalyticsEvent = { name, at: Date.now(), ...(meta ? { meta } : {}) };
  window.dispatchEvent(new CustomEvent("elcamoso:analytics", { detail: event }));
}

export function enqueueIfEnabled(enabled: boolean, event: AnalyticsEvent) {
  if (!enabled) return;
  writeQueue([...readQueue(), event]);
}

export function drainQueue(): AnalyticsEvent[] {
  const events = readQueue();
  writeQueue([]);
  return events;
}
