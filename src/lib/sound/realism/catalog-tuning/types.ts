/**
 * Prompt 07 — full-catalog tuning pass (typed matrix + runtime overlays).
 * Listening scores are never auto-filled; only humans mark listeningVerified.
 */

import type { ProfileFamily } from "@/lib/sound/realism/families";
import type { AcousticEngineConfig } from "@/lib/sound/realism/v2/acoustic-engine";
import type { ProfileExperienceConfig } from "@/lib/sound/profile-experience-config";

export type CatalogRendererKind =
  | "realism-v2-hybrid"
  | "realism-v3-raw-mechanical-opt-in"
  | "improved-strategy"
  | "symphony"
  | "world"
  | "fusion"
  | "legacy-fallback";

export type CatalogSampleStatus =
  | "asset-pending"
  | "procedural-only"
  | "hybrid-ready-awaiting-banks"
  | "not-applicable";

export type CatalogListeningStatus = "unverified" | "pending" | "approved" | "rejected";
export type CatalogDeviceStatus = "unverified" | "pending" | "device-verified";
export type CatalogAutomatedCheck = "pending" | "pass" | "fail" | "skipped-no-offline";

export type CatalogOutcome =
  | "procedural-improved"
  | "combustion-tuned"
  | "experience-tuned"
  | "blocked-assets"
  | "blocked-listening"
  | "unchanged-intentional";

/** Partial acoustic overrides — only set fields that change for this ID. */
export type AcousticTuningOverlay = Partial<
  Pick<
    AcousticEngineConfig,
    | "idleIrregularity"
    | "exhaustPulse"
    | "intakePresence"
    | "mechanicalIntensity"
    | "combustionSharpness"
    | "highLoadEnrichment"
    | "loadContrast"
    | "upperRpmEnergy"
    | "intakeLoadResponse"
    | "overrunCharacter"
    | "bodyBrightness"
    | "exhaustFormantsHz"
    | "intakeFormantsHz"
    | "bodyResonanceHz"
  >
>;

export interface ExperienceTuningOverlay {
  phases?: Partial<ProfileExperienceConfig["phases"]>;
  variation?: Partial<ProfileExperienceConfig["variation"]>;
  aspirationDynamics?: Partial<ProfileExperienceConfig["aspirationDynamics"]>;
  transitionTauSeconds?: number;
}

export interface CatalogTuningEntry {
  profileId: string;
  /** Runtime technical family. */
  family: ProfileFamily;
  /** Short intended identity (design). */
  intendedIdentity: string;
  /** Previous source path before this pass. */
  previousSource: string;
  /** Diagnosed weakness with evidence class. */
  diagnosedProblem: string;
  chosenRenderer: CatalogRendererKind;
  layerOrderBalance: string;
  rpmLoadShaping: string;
  bassBodyAdjustment: string;
  harshnessTreatment: string;
  transmissionEvents: string;
  sampleStatus: CatalogSampleStatus;
  /** Exact code touchpoints for this ID. */
  changedCode: string[];
  baselineCapturePath: string | null;
  afterCapturePath: string | null;
  automatedCheck: CatalogAutomatedCheck;
  humanListeningStatus: CatalogListeningStatus;
  deviceStatus: CatalogDeviceStatus;
  outcome: CatalogOutcome;
  /** Audible rationale for individual deviation vs family default. */
  audibleRationale: string;
  acousticOverlay?: AcousticTuningOverlay;
  experienceOverlay?: ExperienceTuningOverlay;
  /** Explicit blocker when outcome is blocked-*. */
  blocker?: string;
}

export interface ListeningRubricScores {
  /** All null until a human scores. */
  bassBody: number | null;
  rawMechanicalCharacter: number | null;
  identity: number | null;
  loadResponsiveness: number | null;
  shiftBelievability: number | null;
  harshnessFatigue: number | null;
  loopArtefacts: number | null;
  scoredBy: string | null;
  scoredAt: string | null;
  loudnessMatched: boolean;
}
