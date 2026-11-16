/**
 * Background / lock-screen diagnostic log: visibility, sensor and GPS
 * event counts, gaps, and AudioContext state. Exportable as text or JSON
 * so a phone test can be copied back.
 */
export type RumosoLogKind =
  | "visibility"
  | "motion"
  | "gps"
  | "audio"
  | "gap"
  | "note"
  | "permission";

export interface RumosoLogEvent {
  t: number;
  iso: string;
  kind: RumosoLogKind;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_EVENTS = 800;
const GAP_MS = 1_500;

export class RumosoDebugLog {
  readonly startedAt = Date.now();
  events: RumosoLogEvent[] = [];
  motionCount = 0;
  gpsCount = 0;
  lastMotionAt: number | null = null;
  lastGpsAt: number | null = null;
  hiddenAt: number | null = null;
  motionWhileHidden = 0;
  gpsWhileHidden = 0;
  audioState: string = "unknown";
  visibility: DocumentVisibilityState | "unknown" = "unknown";

  private push(kind: RumosoLogKind, message: string, data?: Record<string, unknown>, t = Date.now()): void {
    const event: RumosoLogEvent = { t, iso: new Date(t).toISOString(), kind, message };
    if (data) event.data = data;
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }

  note(message: string, data?: Record<string, unknown>): void {
    this.push("note", message, data);
  }

  permission(message: string, data?: Record<string, unknown>): void {
    this.push("permission", message, data);
  }

  onVisibility(state: DocumentVisibilityState, t = Date.now()): void {
    const prev = this.visibility;
    this.visibility = state;
    if (state === "hidden") {
      this.hiddenAt = t;
      this.motionWhileHidden = 0;
      this.gpsWhileHidden = 0;
      this.push("visibility", "hidden", { previous: prev }, t);
    } else {
      const hiddenMs = this.hiddenAt != null ? t - this.hiddenAt : null;
      this.push(
        "visibility",
        "visible",
        {
          previous: prev,
          hiddenMs,
          motionWhileHidden: this.motionWhileHidden,
          gpsWhileHidden: this.gpsWhileHidden,
          lastMotionAgoMs: this.lastMotionAt != null ? t - this.lastMotionAt : null,
          lastGpsAgoMs: this.lastGpsAt != null ? t - this.lastGpsAt : null,
          audioState: this.audioState,
        },
        t,
      );
      this.hiddenAt = null;
    }
  }

  onMotion(t = Date.now()): void {
    this.maybeGap("motion", this.lastMotionAt, t);
    this.motionCount += 1;
    this.lastMotionAt = t;
    if (this.hiddenAt != null) this.motionWhileHidden += 1;
  }

  onGps(t = Date.now(), data?: Record<string, unknown>): void {
    this.maybeGap("gps", this.lastGpsAt, t);
    this.gpsCount += 1;
    this.lastGpsAt = t;
    if (this.hiddenAt != null) this.gpsWhileHidden += 1;
    if (data) this.push("gps", "fix", data, t);
  }

  onAudio(state: string, t = Date.now()): void {
    const prev = this.audioState;
    this.audioState = state;
    if (prev !== state) this.push("audio", state, { previous: prev }, t);
  }

  snapshot(t = Date.now()): {
    runningForMs: number;
    visibility: DocumentVisibilityState | "unknown";
    hiddenForMs: number;
    motionCount: number;
    gpsCount: number;
    lastMotionAgoMs: number | null;
    lastGpsAgoMs: number | null;
    motionWhileHidden: number;
    gpsWhileHidden: number;
    audioState: string;
  } {
    return {
      runningForMs: t - this.startedAt,
      visibility: this.visibility,
      hiddenForMs: this.hiddenAt != null ? t - this.hiddenAt : 0,
      motionCount: this.motionCount,
      gpsCount: this.gpsCount,
      lastMotionAgoMs: this.lastMotionAt != null ? t - this.lastMotionAt : null,
      lastGpsAgoMs: this.lastGpsAt != null ? t - this.lastGpsAt : null,
      motionWhileHidden: this.motionWhileHidden,
      gpsWhileHidden: this.gpsWhileHidden,
      audioState: this.audioState,
    };
  }

  toJson(): string {
    return JSON.stringify({ snapshot: this.snapshot(), events: this.events }, null, 2);
  }

  toText(): string {
    const s = this.snapshot();
    const lines = [
      "RUMOSO diagnostics log",
      `started ${new Date(this.startedAt).toISOString()}`,
      `visibility=${s.visibility} audio=${s.audioState}`,
      `motion events=${s.motionCount} lastAgoMs=${s.lastMotionAgoMs}`,
      `gps events=${s.gpsCount} lastAgoMs=${s.lastGpsAgoMs}`,
      `while hidden: motion=${s.motionWhileHidden} gps=${s.gpsWhileHidden} hiddenForMs=${s.hiddenForMs}`,
      "",
      "events:",
    ];
    for (const e of this.events) {
      const extra = e.data ? " " + JSON.stringify(e.data) : "";
      lines.push(`${e.iso}  [${e.kind}]  ${e.message}${extra}`);
    }
    return lines.join("\n");
  }

  private maybeGap(kind: "motion" | "gps", last: number | null, t: number): void {
    if (last == null) return;
    const dt = t - last;
    if (dt >= GAP_MS) {
      this.push("gap", `${kind} gap ${dt}ms`, { kind, gapMs: dt, hidden: this.hiddenAt != null }, t);
    }
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
