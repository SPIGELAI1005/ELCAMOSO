/** Shared RUMOSO types. Pure data — no DOM, no Drive engine changes. */

export type CoachMode = "off" | "calm" | "hype";

export type CoachLineId =
  | "push-for-it"
  | "go-for-it"
  | "you-can-do-it"
  | "nice-pace-hold-it"
  | "last-minute";

export type RunPhase = "ready" | "warming" | "running" | "paused" | "summary";

export type GpsSource = "reported" | "delta" | "none" | "simulate";

export interface TrackPoint {
  lat: number;
  lon: number;
  atMs: number;
  /** Smoothed effort 0–100 at this fix. */
  effort: number;
  cadenceSpm: number | null;
  /** Filtered speed, metres per second. */
  speedMps: number | null;
  accuracyM?: number | null;
  source: GpsSource;
}

export interface KmSplit {
  km: number;
  durationSec: number;
  paceSecPerKm: number;
  avgEffort: number;
  distanceM: number;
}

export type EffortZoneId = "walk" | "easy" | "steady" | "push" | "hard";

export interface EffortZoneShare {
  id: EffortZoneId;
  label: string;
  minEffort: number;
  maxEffort: number;
  durationMs: number;
  fraction: number;
}

export interface StoredRun {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  movingMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  avgEffort: number;
  peakEffort: number;
  avgCadenceSpm: number | null;
  musicProfileId: string;
  coachMode: CoachMode;
  points: TrackPoint[];
  splits: KmSplit[];
  zones: EffortZoneShare[];
}

export interface StoredRunSummary {
  id: string;
  startedAt: string;
  durationMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  avgEffort: number;
}
