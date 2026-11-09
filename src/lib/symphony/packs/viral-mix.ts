import type { SymphonyPack, SymphonyPackStemDef } from "../types";

const PACK_ID = "symphony-viral-mix";

/**
 * Viral Mix - 140 BPM F minor. Cohesive song-style motion-responsive profile.
 *
 * REFERENCE CHARACTER (from supplied video, 0-26s):
 * - Glassy bell/music-box melodic lead: syncopated motif, high register (C5-C6)
 * - Ethereal sustained pads: soft, airy, breathing volume swells
 * - Warm sub-bass: sustained notes following chord roots
 * - Dry staccato bouncing pluck: syncopated 16th notes, enters at ~13s (higher energy)
 * - Sparse drums: only enter near peak energy (24s in reference)
 *
 * ARRANGEMENT MAPPING TO MOTION:
 * - Stopped/Calm: Bells + pads only (dreamy, mysterious atmosphere)
 * - Cruise: Bells + pads + bass (fuller but still ethereal)
 * - Building: + plucks enter (kinetic energy builds, like reference 13-24s)
 * - Energetic/Peak: + drums for climax (like reference 24s+ drop)
 * - Decelerating: Plucks/drums fade, return to pads+bells
 *
 * SONIC GOAL: Dreamy/mysterious/melancholic yet energetic. Wet reverb character
 * on pads/bells, dry staccato plucks for contrast.
 *
 * NOTE: Uses enhanced procedural synthesis. For production-quality timbre
 * matching the reference's glassy bells and ethereal pads, real audio assets
 * would be required. Current procedural creates the ARRANGEMENT and STRUCTURE
 * but cannot match the exact timbral sophistication.
 */

function viralMixStem(
  id: SymphonyPackStemDef["id"],
  label: string,
  procedural: SymphonyPackStemDef["procedural"],
): SymphonyPackStemDef {
  return {
    id,
    label,
    procedural,
    manifest: {
      assetId: `${PACK_ID}.${id}.v2`,
      variation: "viral-mix-enhanced",
      version: "2.0.0-dev",
      copyrightOwner: "ELCAMOSO project",
      license: "Development use only",
      source: "procedural_placeholder",
      commercialUseStatus: "development_only",
      sampleRate: null,
      durationSeconds: null,
      peakDb: null,
      rmsDb: null,
    },
  };
}

export const VIRAL_MIX_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Viral Mix",
  tagline: "Bells · Pads · Sub · Plucks",
  bpm: 140,
  key: "F minor",
  beatsPerBar: 4,
  barsPerLoop: 8,
  packGain: 0.52,
  stems: [
    viralMixStem("atmosphere", "Ethereal Pad", "pad"),
    viralMixStem("lead", "Glassy Bells", "warm"),
    viralMixStem("bass", "Warm Sub", "bass"),
    viralMixStem("rhythm", "Bouncing Pluck", "bright"),
    viralMixStem("drumsLow", "Sub Kick", "pulse"),
    viralMixStem("drumsHigh", "Ticking Hats", "noise"),
    viralMixStem("fx", "Riser Sweep", "impact"),
  ],
  intensityRules: [
    {
      movementState: "stopped",
      gains: {
        atmosphere: 0.65,
        lead: 0.35,
      },
    },
    {
      movementState: "calm",
      gains: {
        atmosphere: 0.6,
        lead: 0.45,
        bass: 0.15,
      },
    },
    {
      movementState: "cruise",
      gains: {
        atmosphere: 0.55,
        lead: 0.5,
        bass: 0.4,
      },
    },
    {
      movementState: "building",
      gains: {
        atmosphere: 0.45,
        lead: 0.55,
        bass: 0.55,
        rhythm: 0.45,
      },
    },
    {
      movementState: "energetic",
      gains: {
        atmosphere: 0.35,
        lead: 0.6,
        bass: 0.65,
        rhythm: 0.6,
        drumsLow: 0.35,
      },
    },
    {
      movementState: "peak",
      gains: {
        atmosphere: 0.25,
        lead: 0.65,
        bass: 0.72,
        rhythm: 0.7,
        drumsLow: 0.55,
        drumsHigh: 0.45,
        fx: 0.2,
      },
    },
    {
      movementState: "decelerating",
      gains: {
        atmosphere: 0.55,
        lead: 0.5,
        bass: 0.35,
        rhythm: 0.2,
      },
    },
  ],
  licensing: {
    source: "procedural_placeholder",
    notes:
      "Enhanced procedural synthesis matching reference arrangement structure. " +
      "Creates F minor melodic content with glassy bell motif, ethereal pads, " +
      "warm sub-bass, and syncopated plucks. Production quality requires real audio assets.",
    version: "2.0.0-dev",
  },
};
