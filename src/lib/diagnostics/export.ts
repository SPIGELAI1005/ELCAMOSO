import {
  DIAGNOSTICS_SESSION_KIND,
  type DiagnosticsSessionExport,
  type DiagnosticsSessionMeta,
  type DriveDiagnosticsFrame,
} from "@/lib/diagnostics/types";

const LOCATION_KEYS = new Set([
  "latitude",
  "longitude",
  "lat",
  "lng",
  "heading",
  "altitude",
  "coordinates",
]);

function stripLocation(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripLocation);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (LOCATION_KEYS.has(key)) continue;
    out[key] = stripLocation(child);
  }
  return out;
}

export function sanitizeDiagnosticsFrame(frame: DriveDiagnosticsFrame): DriveDiagnosticsFrame {
  return stripLocation(frame) as DriveDiagnosticsFrame;
}

export function buildDiagnosticsSessionExport(
  frames: DriveDiagnosticsFrame[],
  meta: DiagnosticsSessionMeta,
): DiagnosticsSessionExport {
  const sanitized = frames.map(sanitizeDiagnosticsFrame);
  const firstAt = sanitized[0]?.at ?? Date.now();
  const lastAt = sanitized[sanitized.length - 1]?.at ?? firstAt;
  return {
    kind: DIAGNOSTICS_SESSION_KIND,
    exportedAt: new Date().toISOString(),
    durationMs: Math.max(0, lastAt - firstAt),
    frameCount: sanitized.length,
    meta,
    frames: sanitized,
  };
}

export function downloadDiagnosticsSession(
  frames: DriveDiagnosticsFrame[],
  meta: DiagnosticsSessionMeta,
) {
  if (typeof window === "undefined") return;
  const payload = buildDiagnosticsSessionExport(frames, meta);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elcamoso-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
