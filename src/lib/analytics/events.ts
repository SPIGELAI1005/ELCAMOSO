/** Anonymous analytics events (shared). No personal data, no locations. */
export const ANALYTICS_EVENT_TYPES = [
  "session_start",
  "drive_end",
  "sound_listen",
  "shift_mode",
  "smiles_shown",
  "smiles_shared",
  "share_visit",
  "client_error",
  "sound_load_fail",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export interface AnalyticsEvent {
  t: AnalyticsEventType;
  /** epoch ms */
  at: number;
  /** small flat props: strings ≤ 80 chars, finite numbers */
  p?: Record<string, string | number | boolean>;
}

export interface AnalyticsBatch {
  deviceId: string;
  device: "tesla" | "phone" | "tablet" | "desktop" | "unknown";
  events: AnalyticsEvent[];
}

export const MAX_EVENTS_PER_BATCH = 300;
export const MAX_BATCH_BYTES = 48_000;

const PROP_KEYS = new Set([
  "profileId",
  "ms",
  "km",
  "durationMs",
  "mode",
  "path",
  "msg",
  "kind",
  "score",
  "test",
]);

export function sanitizeBatch(raw: unknown): AnalyticsBatch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const deviceId = typeof r["deviceId"] === "string" ? r["deviceId"] : "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(deviceId)) return null;
  const device = ["tesla", "phone", "tablet", "desktop"].includes(r["device"] as string)
    ? (r["device"] as AnalyticsBatch["device"])
    : "unknown";
  const list = Array.isArray(r["events"]) ? r["events"].slice(0, MAX_EVENTS_PER_BATCH) : [];
  const now = Date.now();
  const events: AnalyticsEvent[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    if (!ANALYTICS_EVENT_TYPES.includes(ev["t"] as AnalyticsEventType)) continue;
    const at = typeof ev["at"] === "number" ? ev["at"] : now;
    if (at > now + 60_000 || at < now - 45 * 86400_000) continue;
    const p: Record<string, string | number | boolean> = {};
    const rp = ev["p"] && typeof ev["p"] === "object" ? (ev["p"] as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(rp)) {
      if (!PROP_KEYS.has(k)) continue;
      if (typeof v === "string") p[k] = v.slice(0, 80);
      else if (typeof v === "number" && Number.isFinite(v)) p[k] = Math.round(v * 1000) / 1000;
      else if (typeof v === "boolean") p[k] = v;
    }
    events.push({ t: ev["t"] as AnalyticsEventType, at, p });
  }
  return events.length ? { deviceId, device, events } : null;
}

/* ---------------- aggregation ---------------- */
export interface DayAggregate {
  day: string;
  /** anonymous deviceId → kind */
  devices: Record<string, string>;
  drives: number;
  km: number;
  driveMs: number;
  plays: Record<string, number>;
  listenMs: Record<string, number>;
  quickSkips: Record<string, number>;
  shiftModes: Record<string, number>;
  smilesShown: number;
  smilesShared: number;
  shareVisits: number;
  errors: number;
  soundLoadFails: number;
  teslaErrors: number;
  topErrors: Record<string, number>;
  test: number;
}

export function emptyDay(day: string): DayAggregate {
  return {
    day,
    devices: {},
    drives: 0,
    km: 0,
    driveMs: 0,
    plays: {},
    listenMs: {},
    quickSkips: {},
    shiftModes: {},
    smilesShown: 0,
    smilesShared: 0,
    shareVisits: 0,
    errors: 0,
    soundLoadFails: 0,
    teslaErrors: 0,
    topErrors: {},
    test: 0,
  };
}

const inc = (o: Record<string, number>, k: string, by = 1) => {
  o[k] = (o[k] ?? 0) + by;
};
export const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

export function addBatch(days: Map<string, DayAggregate>, b: AnalyticsBatch) {
  for (const e of b.events) {
    const d = dayOf(e.at);
    let a = days.get(d);
    if (!a) days.set(d, (a = emptyDay(d)));
    if (e.p?.["test"]) {
      a.test++;
      continue;
    }
    a.devices[b.deviceId] = b.device;
    const p = e.p ?? {};
    const prof = String(p["profileId"] ?? "unknown");
    switch (e.t) {
      case "drive_end":
        a.drives++;
        a.km += Number(p["km"] ?? 0);
        a.driveMs += Number(p["durationMs"] ?? 0);
        break;
      case "sound_listen": {
        const ms = Number(p["ms"] ?? 0);
        inc(a.plays, prof);
        inc(a.listenMs, prof, ms);
        if (ms < 10_000) inc(a.quickSkips, prof);
        break;
      }
      case "shift_mode":
        inc(a.shiftModes, String(p["mode"] ?? "unknown"));
        break;
      case "smiles_shown":
        a.smilesShown++;
        break;
      case "smiles_shared":
        a.smilesShared++;
        break;
      case "share_visit":
        a.shareVisits++;
        break;
      case "client_error":
        a.errors++;
        if (b.device === "tesla") a.teslaErrors++;
        inc(a.topErrors, String(p["msg"] ?? "error").slice(0, 80));
        break;
      case "sound_load_fail":
        a.soundLoadFails++;
        if (b.device === "tesla") a.teslaErrors++;
        break;
      default:
        break;
    }
  }
}

export function mergeDays(list: DayAggregate[]) {
  const t = emptyDay("total");
  for (const a of list) {
    Object.assign(t.devices, a.devices);
    for (const k of ["drives", "km", "driveMs", "smilesShown", "smilesShared", "shareVisits", "errors", "soundLoadFails", "teslaErrors", "test"] as const)
      t[k] += a[k];
    for (const k of ["plays", "listenMs", "quickSkips", "shiftModes", "topErrors"] as const)
      for (const [x, v] of Object.entries(a[k])) inc(t[k], x, v);
  }
  return t;
}

export function deviceKinds(devices: Record<string, string>) {
  const o: Record<string, number> = {};
  for (const k of Object.values(devices)) inc(o, k);
  return o;
}
