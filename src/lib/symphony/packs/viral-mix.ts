import type { StemId, SymphonyOneShotDef, SymphonyPack, SymphonyPackStemDef } from "../types";

const PACK_ID = "symphony-viral-mix";
const ASSET_DIR = `/audio/symphony/${PACK_ID}`;
/** 4 bars at 120 BPM, 4/4 — exactly 8.000 s, the clip-able chant window. */
const LOOP_DURATION_SECONDS = 8;
const BPM = 120;

function originalLoop(
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
      assetId: `${PACK_ID}.${id}.original-loop`,
      variation: "original-loop",
      version: "6.0.0",
      copyrightOwner: "ELCAMOSO / George Neacsu",
      license:
        "Original ELCAMOSO production (synthesized + local Piper TTS), approved for the product",
      source: "original",
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
 * Viral Mix v6 — original stadium-anthem production, conducted with speed.
 *
 * Tempo is 120 BPM in C# minor (i–i–VI–III). 120 (not the 107.666 reference)
 * is used so a 4-bar hook is a clean 8 s clip, stomps and ElCA/MOSO land on
 * whole beats, and the grid stays countable for a stadium/party chant.
 *
 * Speed arrangement (each band adds a new layer; deceleration strips the
 * marked upper layers; the chant stays in the background once introduced):
 *   0 km/h          stadium stomp-stomp-clap + kick (drumsLow, rhythm)
 *   5–22            catchy accordion hook (piano)
 *   10–28           MC “ElCA…” / crowd “MOSO!” every 2 bars (cello, max 0.5)
 *                   plus a quiet arena/crowd bed (atmosphere, max 0.55)
 *   38–48           higher counter-melody + question/answer (strings)
 *   60–80           bass + extra hats/claps (bass, drumsHigh)
 *   80–100          brass stabs / horns (brass)
 *   100–130         supersaw lead + crowd “Hey!” (lead, fx)
 *   130+ / peak     full stadium; risers and fills on throttle surges
 *
 * Voice swap: replace loop-chant, oneshot-elca and oneshot-moso with a real
 * recording (George + friends), same 48 kHz / 8 s loop and short one-shots,
 * similar loudness. Current voices are local Piper TTS, PA-processed.
 *
 * Live path is SymphonySynth with speed gates, not the procedural viralmix
 * genre and not the extracted reference stems.
 */
export const VIRAL_MIX_PACK: SymphonyPack = {
  id: PACK_ID,
  name: "Viral Mix",
  tagline: "Stadium Beat · Accordion · ElCA / MOSO",
  bpm: BPM,
  key: "C# minor",
  beatsPerBar: 4,
  barsPerLoop: 4,
  packGain: 0.9,
  lowShelfGain: 0,
  playIntroOnStart: false,
  gainTauSeconds: 0.32,
  electronicLayers: false,
  busLimiter: true,
  stems: [
    originalLoop("drumsLow", "Stadium Beat", "pulse", "loop-beat.m4a", -6.5, -22.04),
    originalLoop("rhythm", "Claps", "bright", "loop-claps.m4a", -7.0, -31.1),
    originalLoop("piano", "Accordion Hook", "warm", "loop-accordion.m4a", -8.0, -27.59),
    originalLoop("cello", "ElCA / MOSO Chant", "warm", "loop-chant.m4a", -10.0, -31.68),
    originalLoop("atmosphere", "Arena Crowd Bed", "pad", "loop-arena.m4a", -16.0, -37.35),
    originalLoop(
      "strings",
      "Counter-melody + Q&A",
      "bright",
      "loop-countermelody.m4a",
      -9.0,
      -27.87,
    ),
    originalLoop("bass", "Bass", "bass", "loop-bass.m4a", -7.5, -23.42),
    originalLoop("drumsHigh", "Hats / Extra Claps", "noise", "loop-hats.m4a", -8.0, -28.15),
    originalLoop("brass", "Horn Stabs", "warm", "loop-brass.m4a", -8.0, -26.66),
    originalLoop("lead", "Supersaw Lead", "bright", "loop-lead.m4a", -8.5, -26.91),
    originalLoop("fx", "Crowd Hey", "impact", "loop-hey.m4a", -11.0, -33.42),
  ],
  // Coarse fallback if speed gates are ignored; live path uses speedGates.
  intensityRules: [
    { movementState: "stopped", gains: { drumsLow: 1, rhythm: 1 } },
    {
      movementState: "calm",
      gains: { drumsLow: 1, rhythm: 1, piano: 1, cello: 0.4, atmosphere: 0.45 },
    },
    {
      movementState: "cruise",
      gains: {
        drumsLow: 1,
        rhythm: 1,
        piano: 1,
        cello: 0.5,
        atmosphere: 0.55,
        strings: 1,
        bass: 0.7,
      },
    },
    {
      movementState: "building",
      gains: {
        drumsLow: 1,
        rhythm: 1,
        piano: 1,
        cello: 0.5,
        atmosphere: 0.55,
        strings: 1,
        bass: 1,
        drumsHigh: 1,
        brass: 0.85,
      },
    },
    {
      movementState: "energetic",
      gains: {
        drumsLow: 1,
        rhythm: 1,
        piano: 1,
        cello: 0.5,
        atmosphere: 0.55,
        strings: 1,
        bass: 1,
        drumsHigh: 1,
        brass: 1,
        lead: 1,
        fx: 0.7,
      },
    },
    {
      movementState: "peak",
      gains: {
        drumsLow: 1,
        rhythm: 1,
        piano: 1,
        cello: 0.5,
        atmosphere: 0.55,
        strings: 1,
        bass: 1,
        drumsHigh: 1,
        brass: 1,
        lead: 1,
        fx: 0.7,
      },
    },
    {
      movementState: "decelerating",
      gains: { drumsLow: 1, rhythm: 0.85, piano: 0.85, cello: 0.4, atmosphere: 0.4, bass: 0.35 },
    },
  ],
  speedGates: {
    drumsLow: { inKmh: 0, fullKmh: 0, maxGain: 1 },
    rhythm: { inKmh: 0, fullKmh: 0, maxGain: 1 },
    piano: { inKmh: 5, fullKmh: 22, maxGain: 1 },
    cello: { inKmh: 10, fullKmh: 28, maxGain: 0.5 },
    atmosphere: { inKmh: 10, fullKmh: 28, maxGain: 0.55 },
    strings: { inKmh: 38, fullKmh: 48, maxGain: 1, stripOnDecel: true },
    bass: { inKmh: 60, fullKmh: 78, maxGain: 1, stripOnDecel: true },
    drumsHigh: { inKmh: 62, fullKmh: 80, maxGain: 1, stripOnDecel: true },
    brass: { inKmh: 80, fullKmh: 100, maxGain: 1, stripOnDecel: true },
    lead: { inKmh: 100, fullKmh: 128, maxGain: 1, stripOnDecel: true },
    fx: { inKmh: 100, fullKmh: 130, maxGain: 0.7, stripOnDecel: true },
  },
  oneShots: [
    oneShot("hey-1", "oneshot-hey-1.m4a", ["strong_acceleration", "kickdown", "energy_rise"], {
      group: "hey",
      gain: 0.85,
      cooldownSeconds: 3.2,
    }),
    oneShot("hey-2", "oneshot-hey-2.m4a", ["strong_acceleration", "kickdown", "energy_rise"], {
      group: "hey",
      gain: 0.85,
      cooldownSeconds: 3.2,
    }),
    oneShot("hey-3", "oneshot-hey-3.m4a", ["strong_acceleration", "kickdown", "energy_rise"], {
      group: "hey",
      gain: 0.85,
      cooldownSeconds: 3.2,
    }),
    oneShot("riser", "oneshot-riser.m4a", ["movement_started", "energy_rise"], {
      gain: 0.8,
      cooldownSeconds: 12,
    }),
    oneShot("fill", "oneshot-fill.m4a", ["kickdown", "upshift", "cruise_enter"], {
      gain: 0.85,
      cooldownSeconds: 7,
    }),
  ],
  licensing: {
    source: "original",
    notes:
      "Original ELCAMOSO stadium-anthem production at 120 BPM, C# minor. Loops and one-shots are synthesized (accordion, drums, bass, brass, lead) plus local Piper TTS for the ElCA/MOSO chant, processed as a PA/crowd. Not derived from the previous licensed extract. Swap loop-chant, oneshot-elca and oneshot-moso for a real recorded chant (same 48 kHz, 8 s loop) without any other pack changes. Live path is this pack, not the procedural viralmix genre.",
    version: "6.0.0",
  },
};
