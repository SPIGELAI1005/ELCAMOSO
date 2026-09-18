import { generateSongTitle } from "./titles";
import type {
  CompositionSection,
  DriveReelMeta,
  DriveSongMeta,
  JourneySummary,
  MusicalChapter,
  TimelinePoint,
} from "./types";

const TARGET_SONG_SEC = 150; // ~2.5 minutes
const MIN_SONG_SEC = 90;
const MAX_SONG_SEC = 180;

interface MomentPick {
  chapter: MusicalChapter;
  sourceStartSec: number;
  sourceEndSec: number;
  intensity: number;
  weight: number;
}

/**
 * JourneyComposer - condense a journey into musical chapters (~2–3 min).
 * Same seed + same summary → same section structure.
 */
export function composeDriveSong(
  journey: JourneySummary,
  opts?: { symphonyPackId?: string; seed?: number },
): DriveSongMeta {
  const seed = opts?.seed ?? journey.seed;
  const packId = opts?.symphonyPackId ?? journey.symphonyPackId ?? "symphony-cinematic-rock";
  const durationSec = Math.max(1, journey.durationMs / 1000);
  const timeline = journey.energyTimeline;

  const moments = pickMoments(timeline, journey, durationSec, seed);
  const songDuration = Math.min(
    MAX_SONG_SEC,
    Math.max(MIN_SONG_SEC, Math.min(TARGET_SONG_SEC, durationSec * 0.85 + 30)),
  );

  const totalWeight = moments.reduce((a, m) => a + m.weight, 0) || 1;
  const sections: CompositionSection[] = [];
  let songCursor = 0;
  for (const m of moments) {
    const len = (m.weight / totalWeight) * songDuration;
    sections.push({
      chapter: m.chapter,
      sourceStartSec: m.sourceStartSec,
      sourceEndSec: m.sourceEndSec,
      songStartSec: Math.round(songCursor * 10) / 10,
      songEndSec: Math.round((songCursor + len) * 10) / 10,
      intensity: m.intensity,
    });
    songCursor += len;
  }

  return {
    title: generateSongTitle(seed, journey.createdAt),
    symphonyPackId: packId,
    seed,
    durationSec: Math.round(songCursor * 10) / 10,
    sections,
    format: "audio/wav",
  };
}

export function composeDriveReel(song: DriveSongMeta): DriveReelMeta {
  const peak =
    song.sections.find((s) => s.chapter === "PEAK") ??
    song.sections[Math.floor(song.sections.length / 2)]!;
  const mid = (peak.songStartSec + peak.songEndSec) / 2;
  const startSec = Math.max(0, mid - 7.5);
  const endSec = Math.min(song.durationSec, startSec + 15);
  return {
    startSec: Math.round(startSec * 10) / 10,
    endSec: Math.round(endSec * 10) / 10,
    label: peak.chapter,
  };
}

function pickMoments(
  timeline: TimelinePoint[],
  journey: JourneySummary,
  durationSec: number,
  seed: number,
): MomentPick[] {
  if (!timeline.length) {
    return [
      {
        chapter: "INTRO",
        sourceStartSec: 0,
        sourceEndSec: Math.min(8, durationSec),
        intensity: 0.2,
        weight: 1,
      },
      {
        chapter: "GROOVE",
        sourceStartSec: 0,
        sourceEndSec: durationSec,
        intensity: 0.4,
        weight: 2,
      },
      {
        chapter: "OUTRO",
        sourceStartSec: Math.max(0, durationSec - 8),
        sourceEndSec: durationSec,
        intensity: 0.15,
        weight: 1,
      },
    ];
  }

  const rnd = mulberry(seed);
  const opening = windowAround(timeline, 0, 0.08, durationSec);
  const firstBuild =
    findRise(timeline, 0.15, 0.45) ?? windowAround(timeline, 0.2, 0.08, durationSec);
  const strong = findPeak(timeline) ?? windowAround(timeline, 0.55, 0.1, durationSec);
  const flow =
    journey.cruisePeriods[0] != null
      ? {
          start: journey.cruisePeriods[0].startSec,
          end: journey.cruisePeriods[0].endSec,
          intensity: 0.45,
        }
      : windowAround(timeline, 0.4, 0.12, durationSec);
  const regen =
    journey.regenPeriods[0] != null
      ? {
          start: journey.regenPeriods[0].startSec,
          end: journey.regenPeriods[0].endSec,
          intensity: 0.35,
        }
      : windowAround(timeline, 0.75, 0.08, durationSec);
  const ending = windowAround(timeline, 0.92, 0.08, durationSec);

  // Tiny seeded jitter so structure stays valid but not identical across seeds
  const j = () => (rnd() - 0.5) * 2;

  return [
    { chapter: "INTRO", ...span(opening, j()), weight: 1.1 },
    { chapter: "BUILD", ...span(firstBuild, j()), weight: 1.4 },
    { chapter: "GROOVE", ...span(flow, j()), weight: 2.0 },
    { chapter: "RISE", ...span(strong, j(), -0.15), weight: 1.5 },
    { chapter: "PEAK", ...span(strong, j()), weight: 1.8 },
    { chapter: "RELEASE", ...span(regen, j()), weight: 1.3 },
    { chapter: "OUTRO", ...span(ending, j()), weight: 1.0 },
  ];
}

function span(
  w: { start: number; end: number; intensity: number },
  jitter: number,
  shrink = 0,
): { sourceStartSec: number; sourceEndSec: number; intensity: number } {
  const len = Math.max(4, (w.end - w.start) * (1 + shrink));
  const mid = (w.start + w.end) / 2 + jitter;
  return {
    sourceStartSec: Math.max(0, mid - len / 2),
    sourceEndSec: mid + len / 2,
    intensity: w.intensity,
  };
}

function windowAround(timeline: TimelinePoint[], frac: number, half: number, durationSec: number) {
  const mid = frac * durationSec;
  const start = Math.max(0, mid - half * durationSec);
  const end = Math.min(durationSec, mid + half * durationSec);
  const intensity = sampleEnergy(timeline, mid);
  return { start, end, intensity };
}

function findPeak(timeline: TimelinePoint[]) {
  let best = timeline[0]!;
  for (const p of timeline) if (p.energy > best.energy) best = p;
  return { start: Math.max(0, best.t - 8), end: best.t + 8, intensity: best.energy };
}

function findRise(timeline: TimelinePoint[], fromFrac: number, toFrac: number) {
  if (!timeline.length) return null;
  const t0 = timeline[0]!.t;
  const t1 = timeline[timeline.length - 1]!.t;
  const a = t0 + (t1 - t0) * fromFrac;
  const b = t0 + (t1 - t0) * toFrac;
  let bestDelta = 0;
  let bestT = a;
  for (let i = 1; i < timeline.length; i++) {
    const p = timeline[i]!;
    const prev = timeline[i - 1]!;
    if (p.t < a || p.t > b) continue;
    const d = p.energy - prev.energy;
    if (d > bestDelta) {
      bestDelta = d;
      bestT = p.t;
    }
  }
  if (bestDelta < 0.05) return null;
  return { start: Math.max(0, bestT - 6), end: bestT + 10, intensity: 0.55 + bestDelta };
}

function sampleEnergy(timeline: TimelinePoint[], t: number) {
  let closest = timeline[0]!;
  for (const p of timeline) {
    if (Math.abs(p.t - t) < Math.abs(closest.t - t)) closest = p;
  }
  return closest.energy;
}

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
