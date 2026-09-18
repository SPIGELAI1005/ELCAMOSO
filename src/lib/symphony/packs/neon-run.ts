import type { SymphonyPack } from "../types";
import { developmentSymphonyStem } from "../asset-manifest";

const PACK_ID = "symphony-neon-run";
const stem = developmentSymphonyStem.bind(null, PACK_ID);

/** Neon Run - electronic pulse, ~128 BPM. Procedural placeholder. */
export const NEON_RUN_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Neon Run",
  tagline: "Synths · Bass · Electronic drums",
  bpm: 128,
  key: "A minor",
  beatsPerBar: 4,
  barsPerLoop: 4,
  packGain: 0.52,
  stems: [
    stem("atmosphere", "Atmosphere", "pad"),
    stem("drumsLow", "Pulse Light", "pulse"),
    stem("drumsHigh", "Pulse Full", "noise"),
    stem("bass", "Synth Bass", "bass"),
    stem("rhythm", "Arp", "bright"),
    stem("lead", "Lead Synth", "bright"),
    stem("fx", "Sweep", "impact"),
  ],
  intensityRules: [
    { movementState: "stopped", gains: { atmosphere: 0.5 } },
    { movementState: "calm", gains: { atmosphere: 0.55, drumsLow: 0.25, bass: 0.2 } },
    {
      movementState: "cruise",
      gains: { atmosphere: 0.35, bass: 0.6, drumsLow: 0.55, rhythm: 0.4 },
    },
    {
      movementState: "building",
      gains: {
        atmosphere: 0.25,
        bass: 0.72,
        drumsLow: 0.5,
        drumsHigh: 0.55,
        rhythm: 0.6,
      },
    },
    {
      movementState: "energetic",
      gains: {
        atmosphere: 0.2,
        bass: 0.78,
        drumsHigh: 0.75,
        rhythm: 0.7,
        lead: 0.45,
      },
    },
    {
      movementState: "peak",
      gains: {
        atmosphere: 0.15,
        bass: 0.82,
        drumsHigh: 0.85,
        rhythm: 0.75,
        lead: 0.7,
        fx: 0.3,
      },
    },
    {
      movementState: "decelerating",
      gains: { atmosphere: 0.45, bass: 0.4, drumsLow: 0.3, rhythm: 0.25 },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes: "Development placeholder - replace with original/commissioned electronic stems.",
    version: "0.1.0-dev",
  },
};
