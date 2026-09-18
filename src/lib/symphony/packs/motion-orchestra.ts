import type { SymphonyPack } from "../types";
import { developmentSymphonyStem } from "../asset-manifest";

const PACK_ID = "symphony-motion-orchestra";
const stem = developmentSymphonyStem.bind(null, PACK_ID);

/** Motion Orchestra - ~96 BPM, 4/4. */
export const MOTION_ORCHESTRA_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Motion Orchestra",
  tagline: "Strings · Piano · Brass · Percussion",
  bpm: 96,
  key: "C major",
  beatsPerBar: 4,
  barsPerLoop: 4,
  packGain: 0.52,
  stems: [
    stem("atmosphere", "Atmosphere", "pad"),
    stem("piano", "Piano", "bright"),
    stem("cello", "Cello", "warm"),
    stem("strings", "Violins", "warm"),
    stem("drumsLow", "Low percussion", "pulse"),
    stem("drumsHigh", "Full percussion", "noise"),
    stem("brass", "Brass", "bright"),
    stem("fx", "Accent", "impact"),
  ],
  intensityRules: [
    { movementState: "stopped", gains: { atmosphere: 0.4, piano: 0.35, cello: 0.3 } },
    {
      movementState: "calm",
      gains: { atmosphere: 0.45, piano: 0.5, cello: 0.45 },
    },
    {
      movementState: "cruise",
      gains: { atmosphere: 0.3, piano: 0.4, cello: 0.4, strings: 0.55 },
    },
    {
      movementState: "building",
      gains: {
        piano: 0.35,
        cello: 0.4,
        strings: 0.7,
        drumsLow: 0.4,
      },
    },
    {
      movementState: "energetic",
      gains: {
        strings: 0.75,
        drumsLow: 0.5,
        drumsHigh: 0.55,
        cello: 0.45,
        brass: 0.35,
      },
    },
    {
      movementState: "peak",
      gains: {
        strings: 0.85,
        drumsHigh: 0.7,
        brass: 0.7,
        piano: 0.3,
        fx: 0.3,
      },
    },
    {
      movementState: "decelerating",
      gains: { atmosphere: 0.4, piano: 0.45, cello: 0.5, strings: 0.35 },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Development placeholder loops - replace with original/commissioned stems.",
    version: "0.1.0-dev",
  },
};
