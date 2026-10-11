/**
 * Per-profile baseline report scaffolding for Prompt 01.
 * Measured fields stay pending until a capture is run — never fabricate results.
 */

import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { familyForProfile } from "@/lib/sound/realism/families";
import { isCombustionRealismV2Profile } from "@/lib/sound/realism/v2";
import { LAB_HARNESS_REVISION } from "@/lib/sound/lab/capture-metadata";
import type { LabSignalMetrics } from "@/lib/sound/lab/metrics";

export type BaselineEvidenceClass =
  | "pending-capture"
  | "code-confirmed"
  | "hypothesis"
  | "missing-human-assessment";

export interface ProfileBaselineReport {
  profileId: string;
  displayName: string;
  family: string;
  realismV2Combustion: boolean;
  harnessRevision: typeof LAB_HARNESS_REVISION;
  measured: {
    status: "pending" | "captured";
    fixtureId?: string;
    metrics?: LabSignalMetrics;
    issues: string[];
  };
  codeEvidence: string[];
  hypotheses: string[];
  missingHumanAssessment: string[];
  evidenceClasses: BaselineEvidenceClass[];
}

const THIN_AUDIO_CODE_EVIDENCE: Record<string, string[]> = {
  "gt-v8": [
    "Improved path: createHarmonicEngineLayer defaults to sawtooth stacks (src/lib/sound/dsp/layers.ts).",
    "V2 eligible via ACOUSTIC_ENGINE_BY_PROFILE; empty sample banks → procedural excitation.",
  ],
  "american-muscle-v8": [
    "Same Improved sawtooth risk when Current A/B selected; V2 hybrid default when enabled.",
    "Pilot sample bank present but approved assets remain 0/9.",
  ],
  "cyber-pulse": [
    "Electric pulse mesh uses sine/triangle/saw + pink BP ~2400 Hz (strategies.ts / layers.ts).",
  ],
  "neon-drive": [
    "Neon pulse uses square/saw + peaking ~1800 Hz and city-haze BP ~2200 Hz (layers-extra.ts).",
    "Runtime family designed vs package musical — motion envelopes differ (FAMILY_CLASSIFICATION_MISMATCHES.md).",
  ],
};

const DEFAULT_HYPOTHESES = [
  "Limiter pumping may elevate mid/high relative to low-order body energy (requires measurement).",
  "Offline worklet vs fallback excitation may change brightness (check excitationMode in capture metadata).",
];

const DEFAULT_HUMAN = [
  "Headphone listening not performed.",
  "Tesla cabin / device listening not performed.",
  "Do not treat lower spectral centroid or higher low-band energy as proven realism.",
];

export function buildPendingBaselineReport(profileId: string): ProfileBaselineReport {
  const profile = SOUND_PROFILES.find((entry) => entry.id === profileId);
  const codeEvidence =
    THIN_AUDIO_CODE_EVIDENCE[profileId] ??
    (isCombustionRealismV2Profile(profileId)
      ? [
          "Combustion V2 eligible; verify body/order energy vs Improved sawtooth A/B after capture.",
        ]
      : [
          "Procedural ImprovedSynth strategy; inspect layer peaking/HPF after capture.",
        ]);

  return {
    profileId,
    displayName: profile?.name ?? profileId,
    family: familyForProfile(profileId),
    realismV2Combustion: isCombustionRealismV2Profile(profileId),
    harnessRevision: LAB_HARNESS_REVISION,
    measured: {
      status: "pending",
      issues: ["Capture not run in this report generation — results pending, not fabricated."],
    },
    codeEvidence,
    hypotheses: DEFAULT_HYPOTHESES,
    missingHumanAssessment: DEFAULT_HUMAN,
    evidenceClasses: ["pending-capture", "code-confirmed", "hypothesis", "missing-human-assessment"],
  };
}

export function allPendingBaselineReports(): ProfileBaselineReport[] {
  return SOUND_PROFILES.map((profile) => buildPendingBaselineReport(profile.id));
}

export function attachCaptureToReport(
  report: ProfileBaselineReport,
  fixtureId: string,
  metrics: LabSignalMetrics,
): ProfileBaselineReport {
  const issues: string[] = [];
  if (metrics.clippedSamples > 0) issues.push(`clippedSamples=${metrics.clippedSamples}`);
  if (metrics.nanCount > 0) issues.push(`nanCount=${metrics.nanCount}`);
  if (metrics.infinityCount > 0) issues.push(`infinityCount=${metrics.infinityCount}`);
  if (Math.abs(metrics.dcOffset) > 0.01) issues.push(`dcOffset=${metrics.dcOffset.toFixed(4)}`);
  if (metrics.spectralCentroidHz > 2500) {
    issues.push(
      `spectralCentroidHz=${metrics.spectralCentroidHz.toFixed(0)} (high centroid is a diagnostic flag, not proof of thinness)`,
    );
  }

  return {
    ...report,
    measured: {
      status: "captured",
      fixtureId,
      metrics,
      issues: issues.length
        ? issues
        : ["No automated hard faults (clip/NaN/Inf/large DC); human listening still required."],
    },
    evidenceClasses: issues.length
      ? ["code-confirmed", "hypothesis", "missing-human-assessment"]
      : ["hypothesis", "missing-human-assessment"],
  };
}
