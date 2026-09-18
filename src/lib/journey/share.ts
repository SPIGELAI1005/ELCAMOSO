import type { JourneySharePayload, JourneySummary } from "./types";

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(text: string) {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(pad);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Explicit share fields only - never route / GPS / sensor traces.
 */
export function buildJourneySharePayload(
  journey: JourneySummary,
  opts?: { includeDuration?: boolean },
): JourneySharePayload | null {
  if (!journey.song) return null;
  const payload: JourneySharePayload = {
    v: 1,
    kind: "drive-song",
    title: journey.song.title,
    experienceName: journey.experienceName,
    experienceKind: journey.experienceKind,
    dna: journey.dna,
    symphonyPackId: journey.song.symphonyPackId,
    seed: journey.song.seed,
    sections: journey.song.sections,
    energyTimeline: journey.energyTimeline.slice(0, 80),
  };
  if (opts?.includeDuration) payload.durationMs = journey.durationMs;
  if (journey.reel) payload.reel = journey.reel;
  return payload;
}

export function encodeJourneyShare(payload: JourneySharePayload): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeJourneyShare(raw: string): JourneySharePayload | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(raw));
    const data = JSON.parse(json) as JourneySharePayload;
    if (data.v !== 1 || data.kind !== "drive-song") return null;
    if (!data.dna || !data.sections || !data.symphonyPackId) return null;
    // Reject coordinate smuggling
    if (/latitude|longitude|gps|polyline/i.test(json)) return null;
    return data;
  } catch {
    return null;
  }
}

export function journeyShareUrl(encoded: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share/drive/${encodeURIComponent(encoded)}`;
}

export const SHARE_DISCLOSURE = {
  shared: ["Drive Song structure", "Drive DNA", "Experience name"] as const,
  notShared: ["Route", "GPS coordinates", "Sensor trace"] as const,
};
