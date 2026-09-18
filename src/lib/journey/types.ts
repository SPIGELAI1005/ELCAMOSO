/** Privacy-first Journey - no GPS / route in default persistence. */

export type JourneyExperienceKind = "engine" | "symphony" | "world" | "fusion";

export type MusicalChapter = "INTRO" | "BUILD" | "GROOVE" | "RISE" | "PEAK" | "RELEASE" | "OUTRO";

export type DriveDnaArchetype =
  | "Progressive Cruiser"
  | "Pulse Rider"
  | "Smooth Builder"
  | "Dynamic Flow"
  | "Night Rhythm"
  | "Quiet Glide"
  | "Open Pulse";

/** Five musical motion dimensions - not safety / quality scores. */
export interface DriveDna {
  energy: number;
  flow: number;
  rhythm: number;
  variation: number;
  regen: number;
  archetype: DriveDnaArchetype;
}

export interface TimelinePoint {
  /** Seconds from journey start */
  t: number;
  energy: number;
}

export interface SemanticMarker {
  t: number;
  type: string;
}

export interface GearMarker {
  t: number;
  gear: number;
  direction: "up" | "down";
}

export interface ArrangementMarker {
  t: number;
  movementState: string;
}

export interface CompositionSection {
  chapter: MusicalChapter;
  /** Source journey time (seconds) */
  sourceStartSec: number;
  sourceEndSec: number;
  /** Position in condensed song (seconds) */
  songStartSec: number;
  songEndSec: number;
  intensity: number;
}

export interface DriveSongMeta {
  title: string;
  symphonyPackId: string;
  seed: number;
  durationSec: number;
  sections: CompositionSection[];
  /** IndexedDB blob key when rendered */
  audioBlobId?: string;
  renderedAt?: number;
  format: "audio/wav";
}

export interface DriveReelMeta {
  /** Song-relative highlight window */
  startSec: number;
  endSec: number;
  label: string;
}

/**
 * Local JourneySummary - motion signature only.
 * Never includes latitude, longitude, or route geometry.
 */
export interface JourneySummary {
  id: string;
  createdAt: number;
  durationMs: number;
  /** Approximate distance metres from integrated speed - not GPS path length */
  distanceM: number | null;
  profileId: string;
  experienceKind: JourneyExperienceKind;
  experienceName: string;
  symphonyPackId: string | null;
  seed: number;
  energyTimeline: TimelinePoint[];
  semanticEvents: SemanticMarker[];
  gearChanges: GearMarker[];
  energyPeaks: number[];
  cruisePeriods: { startSec: number; endSec: number }[];
  regenPeriods: { startSec: number; endSec: number }[];
  arrangementTimeline: ArrangementMarker[];
  dna: DriveDna;
  song: DriveSongMeta | null;
  reel: DriveReelMeta | null;
  /** Explicit opt-in cloud share id if shared */
  shareId: string | null;
}

/** Fields allowed in a cloud / link share payload. */
export interface JourneySharePayload {
  v: 1;
  kind: "drive-song";
  title: string;
  experienceName: string;
  experienceKind: JourneyExperienceKind;
  durationMs?: number;
  dna: DriveDna;
  symphonyPackId: string;
  seed: number;
  sections: CompositionSection[];
  energyTimeline: TimelinePoint[];
  reel?: DriveReelMeta;
}

export const DRIVE_DNA_COPY: Record<keyof Omit<DriveDna, "archetype">, string> = {
  energy: "How strongly the journey built and released intensity.",
  flow: "How continuously motion evolved.",
  rhythm: "How recurring acceleration and cruise patterns appeared.",
  variation: "How much motion state changed.",
  regen: "How much deceleration shaped the motion.",
};
