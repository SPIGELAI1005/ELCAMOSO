/** Studio 2.0 - Sound / Symphony / Fusion creator modes. */

import type { StemId } from "@/lib/symphony/types";

export type StudioMode = "sound" | "symphony" | "fusion";

export type DemoDriveId = "gentle" | "city" | "highway" | "energetic";

export type InstrumentFocusId = "drums" | "bass" | "guitar" | "strings" | "lead" | "atmosphere";

/** Six primary Symphony dials - 0 = left label, 1 = right label. */
export interface SymphonyStudioParams {
  energy: number;
  build: number;
  rhythm: number;
  melody: number;
  drama: number;
  variation: number;
  instruments: Record<InstrumentFocusId, boolean>;
  /** Advanced 0..1 */
  transitionFrequency: number;
  fillFrequency: number;
  climaxSensitivity: number;
  /** Seconds - soft floor for section changes */
  minSectionDuration: number;
  /** Optional per-stem mix overrides 0..1 */
  stemMix: Partial<Record<StemId, number>>;
}

export interface FusionStudioParams {
  machineProfileId: string;
  symphonyProfileId: string;
  /** 0 machine ↔ 1 music */
  mix: number;
  machinePresence: number;
  musicEnergy: number;
  shiftEmphasis: number;
  harmonicResonance: number;
}

export interface ExperiencePreset {
  id: string;
  kind: StudioMode;
  name: string;
  note?: string;
  createdAt: number;
  /** Sound mode - CustomSound id after save, or inline */
  soundId?: string;
  baseProfileId?: string;
  /** Symphony */
  symphonyPackId?: string;
  symphonyParams?: SymphonyStudioParams;
  /** Fusion */
  fusionParams?: FusionStudioParams;
}

export const DEFAULT_SYMPHONY_PARAMS: SymphonyStudioParams = {
  energy: 0.45,
  build: 0.45,
  rhythm: 0.5,
  melody: 0.45,
  drama: 0.4,
  variation: 0.4,
  instruments: {
    atmosphere: true,
    drums: true,
    bass: true,
    guitar: true,
    strings: true,
    lead: true,
  },
  transitionFrequency: 0.5,
  fillFrequency: 0.45,
  climaxSensitivity: 0.5,
  minSectionDuration: 2,
  stemMix: {},
};

export const DEFAULT_FUSION_PARAMS: FusionStudioParams = {
  machineProfileId: "gt-v8",
  symphonyProfileId: "symphony-cinematic-rock",
  mix: 0.6,
  machinePresence: 0.55,
  musicEnergy: 0.6,
  shiftEmphasis: 0.4,
  harmonicResonance: 0.25,
};

export const SYMPHONY_SLIDERS: {
  key: keyof Pick<
    SymphonyStudioParams,
    "energy" | "build" | "rhythm" | "melody" | "drama" | "variation"
  >;
  label: string;
  left: string;
  right: string;
}[] = [
  { key: "energy", label: "Energy", left: "Calm", right: "Intense" },
  { key: "build", label: "Build", left: "Slow", right: "Fast" },
  { key: "rhythm", label: "Rhythm", left: "Loose", right: "Driving" },
  { key: "melody", label: "Melody", left: "Subtle", right: "Expressive" },
  { key: "drama", label: "Drama", left: "Minimal", right: "Cinematic" },
  { key: "variation", label: "Variation", left: "Predictable", right: "Evolving" },
];

export const INSTRUMENT_FOCUS_LABELS: { id: InstrumentFocusId; label: string }[] = [
  { id: "drums", label: "Drums" },
  { id: "bass", label: "Bass" },
  { id: "guitar", label: "Guitar" },
  { id: "strings", label: "Strings" },
  { id: "lead", label: "Lead" },
  { id: "atmosphere", label: "Atmosphere" },
];
