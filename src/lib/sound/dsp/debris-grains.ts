/**
 * Real debris grains: short, dry impacts (pebbles on a metal frame, small rocks on stone) cut
 * from CC BY 4.0 recordings by Gravity Sound (via Wikimedia Commons). Each grain is <=70 ms,
 * high-passed at 250 Hz and faded after ~6 ms so no ringing tail remains. One small WAV at a
 * versioned path (cache-first in the service worker); offsets below.
 */
export const DEBRIS_GRAINS_VERSION = "debris-v1";
export const DEBRIS_GRAINS_URL = `/sample-packs/recorded/${DEBRIS_GRAINS_VERSION}/grains.wav`;

/** [start s, duration s, kind] - kind "m" = pebble on metal, "s" = stone/rock. */
export const DEBRIS_GRAINS: ReadonlyArray<readonly [number, number, "m" | "s"]> = [
  [0.0, 0.04235, "m"],
  [0.05235, 0.07, "m"],
  [0.13235, 0.066, "m"],
  [0.20835, 0.0471, "m"],
  [0.26546, 0.06308, "s"],
  [0.33854, 0.05117, "s"],
  [0.39971, 0.06554, "s"],
  [0.47525, 0.07, "s"],
  [0.55525, 0.07, "s"],
  [0.63525, 0.05544, "s"],
  [0.70069, 0.05942, "s"],
  [0.7701, 0.04129, "s"],
  [0.8214, 0.07, "s"],
  [0.9014, 0.07, "s"],
  [0.9814, 0.0295, "s"],
  [1.0209, 0.07, "s"],
  [1.1009, 0.07, "s"],
  [1.1809, 0.07, "s"],
  [1.2609, 0.07, "s"],
  [1.3409, 0.07, "s"],
  [1.4209, 0.05713, "s"],
  [1.48802, 0.04046, "s"],
  [1.53848, 0.07, "s"],
  [1.61848, 0.07, "s"],
  [1.69848, 0.04533, "s"],
  [1.75381, 0.05142, "s"],
  [1.81523, 0.04398, "s"],
  [1.86921, 0.06773, "s"],
  [1.94694, 0.07, "s"],
  [2.02694, 0.04131, "s"],
  [2.07825, 0.0295, "s"],
  [2.11775, 0.04515, "s"],
  [2.1729, 0.07, "s"],
  [2.2529, 0.07, "s"],
  [2.3329, 0.03463, "s"],
  [2.37752, 0.07, "s"],
] as const;

export interface DebrisCredit {
  title: string;
  author: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  usedIn: string;
  attribution: string;
}

const USED_IN =
  "Debris pings on hard launches: Space Drive, Space Ship, Cyber City, Storm Run, UFO, Time Machine, Rocket Car";
const BY4 = "https://creativecommons.org/licenses/by/4.0/";

export const DEBRIS_GRAIN_CREDITS: DebrisCredit[] = [
  {
    title: "Pebbles dropped on metal frame",
    author: "Gravity Sound (gravitysound.studio)",
    licence: "CC BY 4.0",
    licenceUrl: BY4,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Pebbles_dropped_on_metal_frame_(Gravity_Sound).wav",
    usedIn: USED_IN,
    attribution:
      "\u201CPebbles dropped on metal frame\u201D by Gravity Sound, CC BY 4.0 (creativecommons.org/licenses/by/4.0), via Wikimedia Commons, edited (cut into short grains, filtered).",
  },
  {
    title: "Dropping rocks on ground",
    author: "Gravity Sound (gravitysound.studio)",
    licence: "CC BY 4.0",
    licenceUrl: BY4,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Dropping_rocks_on_ground_(Gravity_Sound).wav",
    usedIn: USED_IN,
    attribution:
      "\u201CDropping rocks on ground\u201D by Gravity Sound, CC BY 4.0 (creativecommons.org/licenses/by/4.0), via Wikimedia Commons, edited (cut into short grains, filtered).",
  },
  {
    title: "Rocks hitting together",
    author: "Gravity Sound (gravitysound.studio)",
    licence: "CC BY 4.0",
    licenceUrl: BY4,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rocks_hitting_together_(Gravity_Sound).wav",
    usedIn: USED_IN,
    attribution:
      "\u201CRocks hitting together\u201D by Gravity Sound, CC BY 4.0 (creativecommons.org/licenses/by/4.0), via Wikimedia Commons, edited (cut into short grains, filtered).",
  },
];

let grainBuffer: AudioBuffer | null = null;
let loading: Promise<AudioBuffer | null> | null = null;

/** Currently decoded grain buffer (null until loaded, or when loading failed). */
export function getDebrisGrainBuffer(): AudioBuffer | null {
  return grainBuffer;
}

/** Fetch + decode the grain pack once; failures resolve to null (dry noise clicks are used). */
export function loadDebrisGrains(ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  if (grainBuffer) return Promise.resolve(grainBuffer);
  if (loading) return loading;
  loading = (async () => {
    try {
      if (typeof fetch !== "function" || typeof location === "undefined") return null;
      const res = await fetch(DEBRIS_GRAINS_URL, { credentials: "same-origin" });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      grainBuffer = await ctx.decodeAudioData(ab);
      return grainBuffer;
    } catch {
      return null;
    } finally {
      if (!grainBuffer) loading = null;
    }
  })();
  return loading;
}

/** Test hook. */
export function setDebrisGrainBufferForTest(buf: AudioBuffer | null) {
  grainBuffer = buf;
  loading = null;
}
