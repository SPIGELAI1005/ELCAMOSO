/**
 * Prompt 07 family guidance defaults — applied only to matching profiles,
 * then overridden by per-ID deviations in by-profile.ts.
 */

import type { AcousticTuningOverlay, ExperienceTuningOverlay } from "@/lib/sound/realism/catalog-tuning/types";

export type DesignFamilyHint =
  | "cross-plane-muscle-v8"
  | "cross-plane-gt-v8"
  | "flat-six-sport"
  | "turbo-inline-6"
  | "high-rev-race"
  | "heavy-mechanical"
  | "electric-futuristic"
  | "creature-cinematic"
  | "ambient-world"
  | "musical-fusion"
  | "generic-motion";

export interface FamilyDefaultBundle {
  layerOrderBalance: string;
  rpmLoadShaping: string;
  bassBodyAdjustment: string;
  harshnessTreatment: string;
  transmissionEvents: string;
  acoustic?: AcousticTuningOverlay;
  experience?: ExperienceTuningOverlay;
}

export const FAMILY_DEFAULTS: Record<DesignFamilyHint, FamilyDefaultBundle> = {
  "cross-plane-muscle-v8": {
    layerOrderBalance:
      "Weight on textured exhaust pulse groups and bank routing; restrained intake/whine; not random global uneven firing.",
    rpmLoadShaping: "Idle lope + load opens exhaust body; cruise stays less intrusive.",
    bassBodyAdjustment: "Lower body resonances emphasized; avoid octave mud.",
    harshnessTreatment: "Soften metallic grit; keep exhaust edge, not blanket LPF dullness.",
    transmissionEvents: "Shift accents allowed when VT engagement + shiftIntensity > 0.",
    acoustic: {
      exhaustPulse: 0.96,
      intakePresence: 0.24,
      mechanicalIntensity: 0.22,
      bodyBrightness: 0.34,
      loadContrast: 0.88,
      upperRpmEnergy: 0.28,
    },
    experience: {
      phases: { idleCharacter: 1.1, pullAwayTexture: 1.14, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.8 },
    },
  },
  "cross-plane-gt-v8": {
    layerOrderBalance: "Balanced combustion/exhaust with moderate intake; GT polish over muscle lope.",
    rpmLoadShaping: "Smooth pull-away; acceleration adds enrichment without lope exaggeration.",
    bassBodyAdjustment: "Solid mid-bass body; brighter than muscle but not race-thin.",
    harshnessTreatment: "Mild shelf on grit; retain upper support under load.",
    transmissionEvents: "City/Touring shift choreography when engaged.",
    acoustic: {
      exhaustPulse: 0.78,
      intakePresence: 0.4,
      mechanicalIntensity: 0.3,
      bodyBrightness: 0.4,
      loadContrast: 0.58,
      upperRpmEnergy: 0.5,
    },
    experience: {
      phases: { idleCharacter: 0.94, accelerationTexture: 1.12, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.44 },
    },
  },
  "flat-six-sport": {
    layerOrderBalance:
      "Mechanical texture + balanced midrange; intake presence; not muscle V8 rumble.",
    rpmLoadShaping: "Strong body at low/mid; upper harmonics open with RPM.",
    bassBodyAdjustment: "Body without cross-plane lope; mid resonances preferred.",
    harshnessTreatment: "Tame narrow harsh bands; keep mechanical bite.",
    transmissionEvents: "Sport VT accents; intensity gated.",
    acoustic: {
      exhaustPulse: 0.54,
      intakePresence: 0.86,
      mechanicalIntensity: 0.74,
      bodyBrightness: 0.56,
      upperRpmEnergy: 0.86,
      intakeLoadResponse: 0.96,
    },
    experience: {
      phases: { idleCharacter: 0.88, accelerationTexture: 1.24, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.46 },
    },
  },
  "turbo-inline-6": {
    layerOrderBalance: "Smooth body + load-responsive intake/spool; boost role gated by load.",
    rpmLoadShaping: "No constant high whistle at idle/cruise; spool with demand.",
    bassBodyAdjustment: "Smooth low-mid mass; avoid whistle substitute for body.",
    harshnessTreatment: "Cap idle intake presence; open under load only.",
    transmissionEvents: "Turbo overrun/release character; shift accents when engaged.",
    acoustic: {
      intakePresence: 0.42,
      intakeLoadResponse: 0.78,
      upperRpmEnergy: 0.52,
      overrunCharacter: 0.36,
      bodyBrightness: 0.46,
    },
    experience: {
      phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.7 },
      aspirationDynamics: { attackSeconds: 0.68, decaySeconds: 0.46, minimumReleaseState: 0.58 },
    },
  },
  "high-rev-race": {
    layerOrderBalance: "Retain upper harmonics with RPM; justified body at low/mid; no blanket LPF.",
    rpmLoadShaping: "upperRpmEnergy rises with rpmNorm; load adds enrichment.",
    bassBodyAdjustment: "Add low/mid body without converting to muscle rumble.",
    harshnessTreatment: "Narrow harshness tame only; identity stays bright at high RPM.",
    transmissionEvents: "Faster transition tau; sport shift accents.",
    acoustic: {
      upperRpmEnergy: 0.94,
      bodyBrightness: 0.62,
      combustionSharpness: 0.66,
      highLoadEnrichment: 0.84,
    },
    experience: {
      phases: { accelerationTexture: 1.26, cruiseIntrusiveScale: 0.52, releaseCharacter: 0.52 },
      transitionTauSeconds: 0.05,
    },
  },
  "heavy-mechanical": {
    layerOrderBalance: "Controlled clatter + low-RPM mass; mechanical over intake scream.",
    rpmLoadShaping: "Heavy idle character; slow transition tau.",
    bassBodyAdjustment: "Low-RPM mass; no clipping crackle.",
    harshnessTreatment: "Reduce sharpness spikes; keep mechanical texture.",
    transmissionEvents: "Sparse events; long cooldowns.",
    experience: {
      phases: { idleCharacter: 1.14, accelerationTexture: 1.08, cruiseIntrusiveScale: 0.78, releaseCharacter: 0.78 },
      transitionTauSeconds: 0.5,
      variation: { minEventCooldownSeconds: 10, maxEventVoices: 1 },
    },
  },
  "electric-futuristic": {
    layerOrderBalance: "Electronic identity retained; motor/regen/env — no combustion overlay.",
    rpmLoadShaping: "Motor-speed / torque-demand drivers; regen on release.",
    bassBodyAdjustment: "Improve weak body via phase idle/pull-away; not ICE rumble.",
    harshnessTreatment: "Lower cruise intrusion; soften harsh electronic edges via phases.",
    transmissionEvents: "Gearless / continuous — no combustion shift clacks.",
    experience: {
      phases: { idleCharacter: 0.28, accelerationTexture: 1.2, cruiseIntrusiveScale: 0.52, regenCharacter: 0.9 },
    },
  },
  "creature-cinematic": {
    layerOrderBalance: "Preserve described creature/cinematic layers; cadence/energy mapping.",
    rpmLoadShaping: "Cadence or energy drivers; not engine cylinder ratios.",
    bassBodyAdjustment: "Identity-appropriate body (roar/gallop), not V8 formants.",
    harshnessTreatment: "Fatigue control via cruise scale; keep character events.",
    transmissionEvents: "Event voices sparse; no ICE shift accents.",
    experience: {
      phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.74 },
      variation: { maxEventVoices: 1 },
    },
  },
  "ambient-world": {
    layerOrderBalance: "Environment-led; core secondary; no forced combustion orders.",
    rpmLoadShaping: "Vehicle-speed / energy; long tails on stop.",
    bassBodyAdjustment: "Atmosphere mass; avoid engine rumble templates.",
    harshnessTreatment: "Gentle cruise; no bright mechanical hiss.",
    transmissionEvents: "Rare or none.",
    experience: {
      phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.74, releaseCharacter: 0.84, stopTail: 0.85 },
    },
  },
  "musical-fusion": {
    layerOrderBalance: "Music/core lead; fusion may layer mechanical metaphorically.",
    rpmLoadShaping: "Energy / hybrid drivers; cruise less intrusive.",
    bassBodyAdjustment: "Musical bass, not ICE body resonances.",
    harshnessTreatment: "Keep arrangement bright without ear fatigue.",
    transmissionEvents: "Musical hits as events; not gear clacks unless hybrid fusion says so.",
    experience: {
      phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.7 },
    },
  },
  "generic-motion": {
    layerOrderBalance: "Core + mechanical + environment as authored roles.",
    rpmLoadShaping: "Engine-rpm or vehicle-speed per experience config.",
    bassBodyAdjustment: "Modest body via pull-away / idle character.",
    harshnessTreatment: "Cruise intrusion down slightly vs prior defaults.",
    transmissionEvents: "As availableRoles allow.",
    experience: {
      phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.68 },
    },
  },
};
