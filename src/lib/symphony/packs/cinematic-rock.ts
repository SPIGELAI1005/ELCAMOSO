import type { SymphonyPack } from "../types";
import { developmentSymphonyStem } from "../asset-manifest";

const PACK_ID = "symphony-cinematic-rock";
const stem = developmentSymphonyStem.bind(null, PACK_ID);

/** Cinematic Rock - ~112 BPM, 4/4, 4-bar loops. */
export const CINEMATIC_ROCK_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Cinematic Rock",
  tagline: "Drums · Bass · Guitar · Strings",
  bpm: 112,
  key: "D minor",
  beatsPerBar: 4,
  barsPerLoop: 4,
  packGain: 0.55,
  stems: [
    stem("atmosphere", "Atmosphere", "pad"),
    stem("drumsLow", "Drums Light", "pulse"),
    stem("drumsHigh", "Drums Full", "noise"),
    stem("bass", "Bass", "bass"),
    stem("rhythm", "Rhythm Guitar", "warm"),
    stem("lead", "Lead Guitar", "bright"),
    stem("strings", "Strings", "warm"),
    stem("fx", "Impact", "impact"),
  ],
  intensityRules: [
    { movementState: "stopped", gains: { atmosphere: 0.55 } },
    {
      movementState: "calm",
      gains: { atmosphere: 0.6, rhythm: 0.2 },
    },
    {
      movementState: "cruise",
      gains: { atmosphere: 0.35, bass: 0.55, drumsLow: 0.5, rhythm: 0.45 },
    },
    {
      movementState: "building",
      gains: {
        atmosphere: 0.25,
        bass: 0.7,
        drumsLow: 0.55,
        drumsHigh: 0.55,
        rhythm: 0.65,
      },
    },
    {
      movementState: "energetic",
      gains: {
        atmosphere: 0.2,
        bass: 0.75,
        drumsLow: 0.4,
        drumsHigh: 0.75,
        rhythm: 0.7,
        strings: 0.55,
      },
    },
    {
      movementState: "peak",
      gains: {
        atmosphere: 0.15,
        bass: 0.8,
        drumsHigh: 0.85,
        rhythm: 0.75,
        lead: 0.7,
        strings: 0.65,
        fx: 0.35,
      },
    },
    {
      movementState: "decelerating",
      gains: {
        atmosphere: 0.45,
        bass: 0.4,
        drumsLow: 0.35,
        rhythm: 0.3,
        strings: 0.4,
      },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Development placeholder loops - replace with original/commissioned stems.",
    version: "0.1.0-dev",
  },
};
