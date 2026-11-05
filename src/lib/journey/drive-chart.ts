import type { JourneyTraceGapV1, JourneyTraceV1 } from "@/lib/journey-trace/types";
import type { CompositionSection, DriveSongMeta, MusicalChapter } from "./types";

export type DriveChartMomentKind = "launch" | "braking" | "top-speed" | "cruise" | "stop";

export interface DriveChartPoint {
  /** seconds from drive start */
  t: number;
  speedKmh: number;
  /** m/s², signed (negative = braking / regen) */
  accel: number;
}

export interface DriveChartMoment {
  /** seconds from drive start */
  t: number;
  kind: DriveChartMomentKind;
  label: string;
  /** What it did to the music, in plain words */
  effect: string;
  /** Where it is heard in the song (seconds) - null if the moment was condensed away */
  songSec: number | null;
}

export interface DriveChartBand {
  startSec: number;
  endSec: number;
  chapter: MusicalChapter;
  songStartSec: number;
}

export interface DriveChart {
  durationSec: number;
  maxSpeedKmh: number;
  maxAbsAccel: number;
  points: DriveChartPoint[];
  moments: DriveChartMoment[];
  gaps: { startSec: number; endSec: number; reason: JourneyTraceGapV1["reason"] }[];
  bands: DriveChartBand[];
}

const LAUNCH_ACCEL = 1.6;
const BRAKE_ACCEL = -1.8;
const MIN_SPACING_SEC = 20;
const MAX_MOMENTS = 8;

/** Where a drive second is heard in the song, via the composition sections. */
export function sourceToSongSec(
  sections: CompositionSection[] | undefined,
  sourceSec: number,
): number | null {
  if (!sections?.length) return null;
  for (const s of sections) {
    if (sourceSec >= s.sourceStartSec && sourceSec <= s.sourceEndSec) {
      const f = (sourceSec - s.sourceStartSec) / Math.max(0.01, s.sourceEndSec - s.sourceStartSec);
      return Math.round((s.songStartSec + f * (s.songEndSec - s.songStartSec)) * 10) / 10;
    }
  }
  return null;
}

/** Build a chart model of the drive (speed, acceleration, braking) and the moments that shaped the song. */
export function buildDriveChart(
  trace: Pick<JourneyTraceV1, "samples" | "gaps" | "durationMs">,
  song?: Pick<DriveSongMeta, "sections"> | null,
  opts?: { maxPoints?: number },
): DriveChart {
  const samples = trace.samples;
  const lastT = samples.length ? samples[samples.length - 1]!.t : 0;
  const durationSec = Math.max(trace.durationMs, lastT) / 1000;
  const maxPoints = opts?.maxPoints ?? 240;

  // Downsample into buckets keeping the extreme acceleration of each bucket
  const points: DriveChartPoint[] = [];
  if (samples.length) {
    const bucketMs = Math.max(1, (durationSec * 1000) / maxPoints);
    let bucket = -1;
    let cur: DriveChartPoint | null = null;
    let n = 0;
    let speedSum = 0;
    for (const s of samples) {
      const b = Math.floor(s.t / bucketMs);
      if (b !== bucket) {
        if (cur) points.push({ ...cur, speedKmh: speedSum / n });
        bucket = b;
        cur = { t: s.t / 1000, speedKmh: 0, accel: s.acceleration };
        n = 0;
        speedSum = 0;
      }
      n++;
      speedSum += s.speedKmh;
      if (Math.abs(s.acceleration) > Math.abs(cur!.accel)) cur!.accel = s.acceleration;
    }
    if (cur) points.push({ ...cur, speedKmh: speedSum / n });
  }

  const maxSpeedKmh = samples.reduce((m, s) => Math.max(m, s.speedKmh), 0);
  const maxAbsAccel = samples.reduce((m, s) => Math.max(m, Math.abs(s.acceleration)), 0);

  // Candidate moments
  const candidates: (Omit<DriveChartMoment, "songSec"> & { score: number })[] = [];
  let topIdx = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (topIdx < 0 || s.speedKmh > samples[topIdx]!.speedKmh) topIdx = i;
    const prev = samples[i - 1];
    const next = samples[i + 1];
    const isPeak =
      (!prev || s.acceleration >= prev.acceleration) &&
      (!next || s.acceleration >= next.acceleration);
    const isTrough =
      (!prev || s.acceleration <= prev.acceleration) &&
      (!next || s.acceleration <= next.acceleration);
    if (isPeak && s.acceleration >= LAUNCH_ACCEL) {
      candidates.push({
        t: s.t / 1000,
        kind: "launch",
        label: "Strong acceleration",
        effect: "Drums and energy surge",
        score: s.acceleration,
      });
    } else if (isTrough && s.acceleration <= BRAKE_ACCEL) {
      candidates.push({
        t: s.t / 1000,
        kind: "braking",
        label: "Braking",
        effect: "Music softens and releases",
        score: -s.acceleration,
      });
    }
    if (
      prev &&
      prev.speedKmh > 3 &&
      s.speedKmh <= 1 &&
      (!next || next.speedKmh <= 3)
    ) {
      candidates.push({
        t: s.t / 1000,
        kind: "stop",
        label: "Stop",
        effect: "Breathing space in the song",
        score: 0.8,
      });
    }
  }
  if (topIdx >= 0 && samples[topIdx]!.speedKmh > 10) {
    candidates.push({
      t: samples[topIdx]!.t / 1000,
      kind: "top-speed",
      label: `Top speed ${Math.round(samples[topIdx]!.speedKmh)} km/h`,
      effect: "Biggest, fullest part of the song",
      score: 99,
    });
  }
  // Longest steady cruise
  let cruiseStart = -1;
  let best: { a: number; b: number } | null = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const steady = s.speedKmh > 30 && Math.abs(s.acceleration) < 0.4;
    if (steady && cruiseStart < 0) cruiseStart = i;
    if ((!steady || i === samples.length - 1) && cruiseStart >= 0) {
      const a = samples[cruiseStart]!.t;
      const b = s.t;
      if (b - a > 15000 && (!best || b - a > best.b - best.a)) best = { a, b };
      cruiseStart = -1;
    }
  }
  if (best) {
    candidates.push({
      t: (best.a + best.b) / 2000,
      kind: "cruise",
      label: "Steady cruise",
      effect: "Smooth, flowing groove",
      score: 1.5,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.length >= MAX_MOMENTS) break;
    if (picked.some((p) => Math.abs(p.t - c.t) < MIN_SPACING_SEC)) continue;
    picked.push(c);
  }
  picked.sort((a, b) => a.t - b.t);
  const moments: DriveChartMoment[] = picked.map(({ score: _score, ...m }) => ({
    ...m,
    t: Math.round(m.t * 10) / 10,
    songSec: sourceToSongSec(song?.sections, m.t),
  }));

  return {
    durationSec,
    maxSpeedKmh,
    maxAbsAccel,
    points,
    moments,
    gaps: (trace.gaps ?? []).map((g) => ({
      startSec: g.startT / 1000,
      endSec: g.endT / 1000,
      reason: g.reason,
    })),
    bands: (song?.sections ?? []).map((s) => ({
      startSec: s.sourceStartSec,
      endSec: s.sourceEndSec,
      chapter: s.chapter,
      songStartSec: s.songStartSec,
    })),
  };
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
