import type { ListeningRubricScores } from "@/lib/sound/realism/catalog-tuning/types";

/**
 * Human-only listening rubric. Automated meters must never fill these scores.
 * Match A/B loudness before judgement (see lab levelMatchGainDb).
 */
export const LISTENING_RUBRIC_DIMENSIONS = [
  "bassBody",
  "rawMechanicalCharacter",
  "identity",
  "loadResponsiveness",
  "shiftBelievability",
  "harshnessFatigue",
  "loopArtefacts",
] as const;

export type ListeningRubricDimension = (typeof LISTENING_RUBRIC_DIMENSIONS)[number];

export function emptyListeningRubric(): ListeningRubricScores {
  return {
    bassBody: null,
    rawMechanicalCharacter: null,
    identity: null,
    loadResponsiveness: null,
    shiftBelievability: null,
    harshnessFatigue: null,
    loopArtefacts: null,
    scoredBy: null,
    scoredAt: null,
    loudnessMatched: false,
  };
}

/** Score guide for human listeners (1–5). Not used by automated tests. */
export const LISTENING_SCORE_GUIDE = {
  bassBody: "Perceived low/mid mass appropriate to identity (not mud, not thin).",
  rawMechanicalCharacter: "Believable mechanical texture for the stated identity.",
  identity: "Sounds like this profile's promise, not a neighbor clone.",
  loadResponsiveness: "Idle/cruise/load/release read differently in a justified way.",
  shiftBelievability: "Shifts (if any) feel sequenced; gearless stays free of fake clacks.",
  harshnessFatigue: "Long-listen comfort; harshness controlled without dulling identity.",
  loopArtefacts: "No obvious loop seams, pumping, or periodic glitches.",
} as const;
