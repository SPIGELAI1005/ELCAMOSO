import type { StemId, SymphonyPack, SymphonyPackStemDef } from "../types";

const PACK_ID = "symphony-viral-mix";
const ASSET_DIR = `/audio/symphony/${PACK_ID}`;
/** 16 bars at the measured tempo of the licensed recording (≈108 BPM). */
const LOOP_DURATION_SECONDS = 35.66585416666667;
const INTRO_DURATION_SECONDS = 8.916458333333333;
const BPM = 107.666015625;

function licensedLoop(
  id: StemId,
  label: string,
  procedural: SymphonyPackStemDef["procedural"],
  file: string,
  peakDb: number,
  rmsDb: number,
): SymphonyPackStemDef {
  return {
    id,
    label,
    procedural,
    assetPath: `${ASSET_DIR}/${file}`,
    manifest: {
      assetId: `${PACK_ID}.${id}.licensed-loop`,
      variation: "licensed-loop",
      version: "3.0.0",
      copyrightOwner: "George Neacsu",
      license: "Owner-licensed for ELCAMOSO Viral Mix (rights confirmed by the owner)",
      source: "licensed",
      commercialUseStatus: "approved",
      sampleRate: 48_000,
      durationSeconds: LOOP_DURATION_SECONDS,
      peakDb,
      rmsDb,
    },
  };
}

/**
 * Viral Mix — licensed recording, motion-layered.
 *
 * Live Drive path is SymphonySynth (not the procedural viralmix genre).
 * Hybrid mix: pads + quiet vocals at rest, bass when rolling, the full original
 * mix at cruise and above so loudness/punch match the source. The intro riser
 * is a one-shot on start; the loop is bars 4–20 (16 bars), beat-aligned.
 */
export const VIRAL_MIX_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Viral Mix",
  tagline: "Pads · Bass · Vocals · Full Mix",
  bpm: BPM,
  key: "C# minor",
  beatsPerBar: 4,
  barsPerLoop: 16,
  packGain: 1,
  lowShelfGain: 0,
  playIntroOnStart: true,
  intro: {
    assetPath: `${ASSET_DIR}/intro-mix.m4a`,
    durationSeconds: INTRO_DURATION_SECONDS,
  },
  stems: [
    licensedLoop("atmosphere", "Pads / Harmony", "pad", "loop-atmosphere.m4a", -8.991, -27.056),
    licensedLoop("bass", "Bass", "bass", "loop-bass.m4a", -9.598, -17.693),
    licensedLoop("rhythm", "Vocals", "warm", "loop-vocals.m4a", -16.165, -35.586),
    licensedLoop("lead", "Full Mix", "bright", "loop-mix.m4a", -2.024, -16.428),
  ],
  intensityRules: [
    {
      movementState: "stopped",
      gains: { atmosphere: 0.9, rhythm: 0.35 },
    },
    {
      movementState: "calm",
      gains: { atmosphere: 0.9, rhythm: 0.5, bass: 1 },
    },
    {
      movementState: "cruise",
      gains: { lead: 1 },
    },
    {
      movementState: "building",
      gains: { lead: 1 },
    },
    {
      movementState: "energetic",
      gains: { lead: 1 },
    },
    {
      movementState: "peak",
      gains: { lead: 1 },
    },
    {
      movementState: "decelerating",
      gains: { lead: 0.75 },
    },
  ],
  licensing: {
    source: "licensed",
    notes:
      "Owner-licensed recording (rights confirmed by George Neacsu). Loop skips the intro riser (bars 4–20, 16 bars at the measured ~108 BPM). Intro is optional on start. Live playback is this pack through SymphonySynth, not the procedural viralmix genre.",
    version: "3.0.0",
  },
};
