import type { ElcamosoSettings } from "@/lib/drive/settings";
import type { TraceAggregates } from "@/lib/drive/traces";

export interface CloudDocument {
  accountId: string;
  updatedAt: number;
  settings: Partial<ElcamosoSettings>;
}

const memory = new Map<string, CloudDocument>();

export function upsertCloud(doc: CloudDocument): CloudDocument {
  const prev = memory.get(doc.accountId);
  if (prev && prev.updatedAt > doc.updatedAt) return prev;
  const merged: CloudDocument = {
    accountId: doc.accountId,
    updatedAt: doc.updatedAt,
    settings: { ...(prev?.settings ?? {}), ...doc.settings },
  };
  memory.set(doc.accountId, merged);
  return merged;
}

export function readCloud(accountId: string): CloudDocument | null {
  return memory.get(accountId) ?? null;
}

export function coachCopy(aggregates: TraceAggregates): { summary: string; suggestion: string } {
  const kmh = Math.round(aggregates.meanSpeedMps * 3.6);
  const peak = Math.round(aggregates.maxSpeedMps * 3.6);
  const minutes = Math.max(1, Math.round(aggregates.durationMs / 60000));
  const regen = Math.round(aggregates.regenShare * 100);
  const throttle = Math.round(aggregates.throttleShare * 100);
  const summary = `${minutes} min drive, average ${kmh} km/h, peak ${peak} km/h. Throttle ${throttle}%, regen ${regen}%.`;
  const suggestion =
    regen > 35
      ? "A gentler Sound Profile would sit better with this much regen time."
      : throttle > 45
        ? "A fuller Sound Profile would match this drive."
        : "Keep the current Sound Profile, or try a calmer one for the next stretch.";
  return { summary, suggestion };
}
