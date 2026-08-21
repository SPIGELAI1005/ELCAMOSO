import type { AnalyticsEvent } from "@/lib/telemetry/analytics";
import type { CrashRecord } from "@/lib/telemetry/crashes";
import type { CustomSound } from "@/lib/drive/settings";

export interface TelemetryBatch {
  installId: string;
  events: AnalyticsEvent[];
  crashes: CrashRecord[];
}

const shareCodes = new Map<string, CustomSound>();

const telemetryLog: TelemetryBatch[] = [];

export function ingestTelemetry(batch: TelemetryBatch): { accepted: number } {
  const clean: TelemetryBatch = {
    installId: batch.installId.slice(0, 24),
    events: batch.events.slice(0, 40).map((event) => ({
      name: event.name,
      at: event.at,
      ...(event.meta ? { meta: event.meta } : {}),
    })),
    crashes: batch.crashes.slice(0, 12).map((crash) => ({
      at: crash.at,
      message: crash.message.slice(0, 240),
      kind: crash.kind,
      route: crash.route.slice(0, 80),
    })),
  };
  telemetryLog.push(clean);
  if (telemetryLog.length > 80) telemetryLog.shift();
  return { accepted: clean.events.length + clean.crashes.length };
}

export function saveShare(sound: CustomSound): string {
  const code = `s${Math.random().toString(36).slice(2, 8)}`;
  shareCodes.set(code, sound);
  return code;
}

export function loadShare(code: string): CustomSound | null {
  return shareCodes.get(code) ?? null;
}
