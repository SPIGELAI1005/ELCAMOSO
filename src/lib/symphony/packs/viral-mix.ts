import type { StemId, SymphonyOneShotDef, SymphonyPack, SymphonyPackStemDef } from "../types";

const PACK_ID = "symphony-viral-mix";
const ASSET_DIR = `/audio/symphony/${PACK_ID}`;
/** 4 bars at the measured tempo of the licensed recording (≈108 BPM). */
const LOOP_DURATION_SECONDS = 8.916479166666667;
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
      version: "5.0.0",
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

function oneShot(
  id: string,
  file: string,
  triggers: SymphonyOneShotDef["triggers"],
  opts: { group?: string; gain?: number; cooldownSeconds?: number } = {},
): SymphonyOneShotDef {
  return {
    id,
    assetPath: `${ASSET_DIR}/${file}`,
    triggers,
    group: opts.group,
    gain: opts.gain ?? 1,
    cooldownSeconds: opts.cooldownSeconds,
  };
}

/**
 * Viral Mix — licensed recording, conducted in layers like the other Symphony packs.
 *
 * Live path is SymphonySynth with speed gates (not a full-mix loop, and not the
 * procedural viralmix genre). 4-bar loops are extracted from the sample so the
 * driver opens the arrangement with speed; cruise and highway add synthesized
 * techno bass, a 4-on-the-floor kick, acid, offbeat hats and an arp.
 */
export const VIRAL_MIX_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Viral Mix",
  tagline: "Pads · Bass · Techno · Hook · Vocals",
  bpm: BPM,
  key: "C# minor",
  beatsPerBar: 4,
  barsPerLoop: 4,
  packGain: 1,
  lowShelfGain: 0,
  playIntroOnStart: false,
  gainTauSeconds: 0.32,
  electronicLayers: true,
  stems: [
    licensedLoop("atmosphere", "Pads", "pad", "loop-pads.m4a", -17.09, -30.84),
    licensedLoop("bass", "Bass", "bass", "loop-bass.m4a", -9.04, -17.48),
    licensedLoop("drumsLow", "Kick", "pulse", "loop-kick.m4a", -10.87, -23.57),
    licensedLoop("drumsHigh", "Hats", "noise", "loop-hats.m4a", -8.9, -31.61),
    licensedLoop("rhythm", "Snare / Clap", "bright", "loop-snare.m4a", -6.25, -29.39),
    licensedLoop("piano", "Keys / Chords", "warm", "loop-keys.m4a", -11.85, -29.11),
    licensedLoop("lead", "Lead Hook", "bright", "loop-hook.m4a", -12.56, -31.66),
    licensedLoop("brass", "Vocal Chant", "warm", "loop-vocals.m4a", -16.16, -31.59),
    licensedLoop("cello", "Percussion", "impact", "loop-percussion.m4a", -8.82, -30.23),
  ],
  // Coarse fallback if speed gates are ignored; live path uses speedGates.
  intensityRules: [
    { movementState: "stopped", gains: { atmosphere: 1 } },
    { movementState: "calm", gains: { atmosphere: 1, bass: 1 } },
    {
      movementState: "cruise",
      gains: { atmosphere: 1, bass: 1, drumsLow: 1, drumsHigh: 0.85 },
    },
    {
      movementState: "building",
      gains: {
        atmosphere: 1,
        bass: 1,
        drumsLow: 1,
        drumsHigh: 1,
        rhythm: 1,
        piano: 0.85,
      },
    },
    {
      movementState: "energetic",
      gains: {
        atmosphere: 0.9,
        bass: 1,
        drumsLow: 1,
        drumsHigh: 1,
        rhythm: 1,
        lead: 1,
        brass: 0.85,
        cello: 0.7,
      },
    },
    {
      movementState: "peak",
      gains: {
        atmosphere: 0.9,
        bass: 1,
        drumsLow: 1,
        drumsHigh: 1,
        rhythm: 1,
        lead: 1,
        brass: 1,
        cello: 1,
      },
    },
    {
      movementState: "decelerating",
      gains: { atmosphere: 1, bass: 0.85, drumsLow: 0.45, drumsHigh: 0.25 },
    },
  ],
  speedGates: {
    atmosphere: { inKmh: 0, fullKmh: 0, maxGain: 1 },
    bass: { inKmh: 5, fullKmh: 18 },
    drumsLow: { inKmh: 28, fullKmh: 42 },
    drumsHigh: { inKmh: 30, fullKmh: 48 },
    rhythm: { inKmh: 55, fullKmh: 72, stripOnDecel: true },
    piano: { inKmh: 58, fullKmh: 78, stripOnDecel: true },
    lead: { inKmh: 75, fullKmh: 95, stripOnDecel: true },
    brass: { inKmh: 125, fullKmh: 155, stripOnDecel: true },
    cello: { inKmh: 140, fullKmh: 170, stripOnDecel: true },
  },
  oneShots: [
    oneShot("hey-1", "oneshot-hey-1.m4a", ["strong_acceleration", "kickdown", "energy_rise"], {
      group: "hey",
      gain: 1,
      cooldownSeconds: 3.2,
    }),
    oneShot("hey-2", "oneshot-hey-2.m4a", ["strong_acceleration", "kickdown", "energy_rise"], {
      group: "hey",
      gain: 1,
      cooldownSeconds: 3.2,
    }),
    oneShot("hey-3", "oneshot-hey-3.m4a", ["strong_acceleration", "kickdown", "energy_rise"], {
      group: "hey",
      gain: 1,
      cooldownSeconds: 3.2,
    }),
    oneShot("riser", "oneshot-riser.m4a", ["movement_started", "energy_rise"], {
      gain: 0.85,
      cooldownSeconds: 12,
    }),
    oneShot("fill", "oneshot-fill.m4a", ["kickdown", "upshift", "cruise_enter"], {
      gain: 0.9,
      cooldownSeconds: 7,
    }),
  ],
  licensing: {
    source: "licensed",
    notes:
      "Owner-licensed recording (rights confirmed by George Neacsu). Elements were extracted as 4-bar beat-aligned loops and one-shots; SymphonySynth opens them with speed, throttle and deceleration. Cruise and highway add synthesized techno layers (sub, 4/4 kick, offbeat/rolling bass, acid, hats, arp) on top of the extracted stems. Not a full-mix playback of the sample. Live path is this pack, not the procedural viralmix genre.",
    version: "5.0.0",
  },
};
