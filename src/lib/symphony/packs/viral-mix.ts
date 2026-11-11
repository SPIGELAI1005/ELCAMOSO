import type { SymphonyPack } from "../types";
import { developmentSymphonyStem } from "../asset-manifest";

const PACK_ID = "symphony-viral-mix";
const stem = developmentSymphonyStem.bind(null, PACK_ID);

/**
 * Viral Mix - 108 BPM, C# minor. Original motion-responsive disco-club profile.
 * The live Drive path is the Adaptive Music signature genre `viralmix`
 * (see genres.ts). This pack stays registered but is not the playback engine.
 * Texture: warm pads, pulsing sub/bass, modest kick, offbeat hats, organ stabs,
 * original synth hook. Motion: idle = pads; cruise = bass + kick + hats; pace opens claps, organ and lead.
 */
export const VIRAL_MIX_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Viral Mix",
  tagline: "Kick · Bass · Pads · Organ",
  bpm: 108,
  key: "C# minor",
  beatsPerBar: 4,
  barsPerLoop: 8,
  packGain: 0.48,
  stems: [
    stem("atmosphere", "Ethereal Pad", "pad"),
    stem("drumsLow", "Sub Pulse", "bass"),
    stem("drumsHigh", "Rhythmic Plucks", "bright"),
    stem("bass", "Deep Sub", "bass"),
    stem("rhythm", "Staccato Bounce", "bright"),
    stem("lead", "Crystal Bells", "warm"),
    stem("fx", "Sweep Riser", "impact"),
  ],
  intensityRules: [
    {
      movementState: "stopped",
      gains: { atmosphere: 0.65, lead: 0.25 },
    },
    {
      movementState: "calm",
      gains: { atmosphere: 0.6, lead: 0.4, bass: 0.15 },
    },
    {
      movementState: "cruise",
      gains: {
        atmosphere: 0.45,
        lead: 0.5,
        bass: 0.45,
        drumsLow: 0.35,
        rhythm: 0.3,
      },
    },
    {
      movementState: "building",
      gains: {
        atmosphere: 0.35,
        lead: 0.55,
        bass: 0.6,
        drumsLow: 0.5,
        drumsHigh: 0.4,
        rhythm: 0.5,
      },
    },
    {
      movementState: "energetic",
      gains: {
        atmosphere: 0.25,
        lead: 0.6,
        bass: 0.72,
        drumsLow: 0.6,
        drumsHigh: 0.6,
        rhythm: 0.65,
      },
    },
    {
      movementState: "peak",
      gains: {
        atmosphere: 0.2,
        lead: 0.65,
        bass: 0.78,
        drumsLow: 0.7,
        drumsHigh: 0.75,
        rhythm: 0.72,
        fx: 0.25,
      },
    },
    {
      movementState: "decelerating",
      gains: {
        atmosphere: 0.55,
        lead: 0.45,
        bass: 0.3,
        drumsLow: 0.2,
        rhythm: 0.2,
      },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes:
      "Original procedural disco-club profile. Live path is the viralmix adaptive genre; this pack is not shipped as audio.",
    version: "2.0.0",
  },
};
