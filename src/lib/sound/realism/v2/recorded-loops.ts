/**
 * Recorded engine material (free-licence, same-origin) for the hybrid sample layer.
 * Round 2: granular, de-looped playback from longer steady regions of the source
 * recordings (random grain offsets, two decorrelated streams, pitch/level jitter),
 * per-region RPM tracks so each grain is pitched from its own measured RPM, and an
 * acceleration-driven load character (cruise / on-load / aggressive / overrun).
 * Shifts, pops and gear logic stay procedural. Licences: RECORDED_LOOP_CREDITS and /credits.
 */

export const RECORDED_LOOPS_VERSION = "v3";
const BASE = `/sample-packs/recorded/${RECORDED_LOOPS_VERSION}`;

/** A steady stretch inside a source file with its measured RPM track (one value per 0.1 s). */
export interface RecordedRegion {
  start: number;
  end: number;
  rpm: number[];
}

export interface RecordedSource {
  id: string;
  url: string;
  regions: RecordedRegion[];
  /** Mix weight of this source inside the bank. */
  weight: number;
  /** Optional per-source grain pitch range (defaults MIN_GRAIN_RATE / MAX_GRAIN_RATE). */
  minRate?: number;
  maxRate?: number;
}

export const RPM_TRACK_STEP = 0.1;

const MASERATI_REGIONS: RecordedRegion[] = [
  {
    start: 0.0,
    end: 6.2,
    rpm: [
      830, 836, 835, 835, 835, 835, 824, 823, 823, 819, 819, 818, 818, 817, 816, 815, 814, 814, 814,
      820, 820, 820, 823, 828, 828, 828, 830, 831, 829, 833, 833, 833, 833, 834, 833, 832, 833, 833,
      833, 838, 839, 839, 838, 835, 831, 831, 835, 837, 837, 837, 826, 823, 823, 820, 820, 820, 822,
      823, 825, 827, 830,
    ],
  },
  {
    start: 6.25,
    end: 13.55,
    rpm: [
      840, 838, 837, 836, 831, 827, 818, 818, 818, 818, 821, 821, 824, 824, 824, 822, 822, 822, 827,
      834, 834, 834, 827, 826, 823, 820, 820, 820, 828, 829, 831, 834, 834, 834, 834, 834, 828, 828,
      828, 835, 835, 835, 835, 841, 841, 841, 841, 838, 838, 838, 841, 841, 841, 842, 842, 842, 841,
      839, 839, 839, 839, 840, 840, 840, 840, 841, 840, 840, 839, 835, 834, 834,
    ],
  },
  { start: 13.6, end: 14.7, rpm: [853, 852, 852, 852, 852, 850, 846, 846, 845, 844] },
  {
    start: 14.75,
    end: 17.55,
    rpm: [
      913, 906, 898, 898, 888, 875, 847, 847, 847, 847, 847, 853, 856, 858, 861, 861, 860, 860, 855,
      843, 843, 843, 847, 847, 848, 848, 849,
    ],
  },
  {
    start: 17.6,
    end: 19.05,
    rpm: [1239, 1248, 1258, 1263, 1263, 1269, 1272, 1276, 1278, 1278, 1285, 1303, 1321],
  },
  {
    start: 19.1,
    end: 21.85,
    rpm: [
      1718, 1730, 1743, 1743, 1747, 1747, 1747, 1760, 1769, 1786, 1800, 1809, 1818, 1855, 1894,
      1940, 1967, 1967, 1967, 1951, 1935, 1930, 1930, 1930, 1927, 1930,
    ],
  },
  {
    start: 21.9,
    end: 23.35,
    rpm: [2168, 2192, 2215, 2250, 2250, 2333, 2376, 2404, 2440, 2461, 2465, 2478, 2491],
  },
  {
    start: 23.4,
    end: 25.0,
    rpm: [2513, 2524, 2513, 2535, 2539, 3022, 3063, 3063, 3022, 2539, 2539, 2539, 2595, 2651],
  },
];

const ROVER_REGIONS: RecordedRegion[] = [
  {
    start: 0.0,
    end: 1.95,
    rpm: [887, 864, 842, 841, 807, 807, 841, 841, 842, 848, 853, 853, 863, 868, 870, 871, 879, 871],
  },
  {
    start: 2.0,
    end: 6.1,
    rpm: [
      1032, 1032, 1032, 1031, 1031, 1031, 1057, 1028, 1057, 1142, 1144, 1144, 1159, 1163, 1168,
      1170, 1170, 1170, 1170, 1228, 1230, 1232, 1232, 1232, 1192, 1190, 1190, 1190, 1188, 1184,
      1114, 1037, 1024, 1022, 1022, 1022, 1126, 1126, 1137, 1126,
    ],
  },
];

/**
 * Superbike (motorcycle-inline-4): steady and pulling stretches from two CC0 Freesound
 * recordings, RPM measured from the firing order (rpm / 30 Hz). Real material covers idle to
 * ~5,100 rpm; grains may be pitched up to 2.4x (inline-4 harmonics stay musical) and hand over
 * to the synth's high-rev scream between ~6k and ~12.5k rpm.
 * Sources: 578059 (Joe.L85, BMW S1000R road test) and 181161 (martian, Honda Hornet 600 onboard).
 */
const SUPERBIKE_REGIONS: RecordedRegion[] = [
  { start: 0.08, end: 0.88, rpm: [1599, 1599, 1529, 1469, 1469, 1478, 1486, 1478] },
  {
    start: 0.96,
    end: 2.06,
    rpm: [1453, 1520, 1555, 1572, 1572, 1555, 1529, 1520, 1494, 1511, 1511],
  },
  {
    start: 2.14,
    end: 5.84,
    rpm: [
      1478, 1503, 1546, 1555, 1555, 1563, 1572, 1563, 1563, 1563, 1572, 1581, 1590, 1581, 1581,
      1590, 1581, 1572, 1572, 1563, 1563, 1555, 1590, 1590, 1581, 1572, 1563, 1537, 1537, 1555,
      1590, 1608, 1599, 1599, 1599, 1599, 1626,
    ],
  },
  {
    start: 5.92,
    end: 7.32,
    rpm: [1673, 1663, 1645, 1645, 1617, 1590, 1581, 1572, 1563, 1537, 1520, 1520, 1503, 1486],
  },
  {
    start: 7.4,
    end: 8.8,
    rpm: [1626, 1654, 1692, 1692, 1711, 1721, 1721, 1711, 1663, 1617, 1636, 1692, 1760, 1760],
  },
  {
    start: 8.88,
    end: 12.88,
    rpm: [
      1740, 1721, 1721, 1721, 1730, 1750, 1750, 1750, 1750, 1740, 1740, 1760, 1780, 1790, 1800,
      1800, 1810, 1810, 1810, 1810, 1821, 1821, 1831, 1821, 1821, 1821, 1831, 1831, 1831, 1831,
      1831, 1852, 1841, 1831, 1831, 1852, 1862, 1862, 1862, 1841,
    ],
  },
  {
    start: 12.96,
    end: 16.96,
    rpm: [
      1852, 1841, 1780, 1750, 1750, 1750, 1790, 1790, 1770, 1760, 1760, 1750, 1760, 1770, 1790,
      1800, 1800, 1810, 1821, 1841, 1862, 1862, 1862, 1852, 1883, 1894, 1894, 1905, 1926, 1959,
      1992, 2015, 2015, 2026, 2049, 2061, 2084, 2073, 2084, 2108,
    ],
  },
  {
    start: 17.04,
    end: 20.14,
    rpm: [
      2193, 2181, 2156, 2156, 2168, 2132, 2156, 2156, 2181, 2156, 2168, 2168, 2168, 2181, 2193,
      2193, 2193, 2193, 2193, 2205, 2205, 2218, 2218, 2230, 2230, 2243, 2243, 2243, 2281, 2307,
      2333,
    ],
  },
  {
    start: 20.22,
    end: 22.22,
    rpm: [
      2144, 2144, 2168, 2156, 2168, 2144, 2168, 2181, 2205, 2243, 2281, 2333, 2360, 2400, 2414,
      2427, 2455, 2469, 2483, 2483,
    ],
  },
  {
    start: 22.3,
    end: 23.5,
    rpm: [2193, 2205, 2243, 2256, 2268, 2268, 2281, 2333, 2333, 2333, 2373, 2427],
  },
  {
    start: 23.58,
    end: 25.48,
    rpm: [
      2230, 2243, 2268, 2281, 2281, 2307, 2307, 2360, 2414, 2414, 2427, 2469, 2469, 2469, 2469,
      2483, 2525, 2539, 2539,
    ],
  },
  {
    start: 25.56,
    end: 28.66,
    rpm: [
      2268, 2256, 2256, 2268, 2294, 2294, 2307, 2307, 2307, 2307, 2320, 2307, 2307, 2346, 2386,
      2386, 2373, 2400, 2441, 2427, 2427, 2455, 2469, 2483, 2568, 2612, 2641, 2671, 2687, 2717,
      2748,
    ],
  },
  {
    start: 28.74,
    end: 30.04,
    rpm: [3182, 3164, 3128, 3076, 3059, 3059, 3007, 3007, 2990, 2957, 2940, 2891, 2891],
  },
  {
    start: 30.12,
    end: 31.22,
    rpm: [3329, 3347, 3366, 3404, 3385, 3404, 3424, 3424, 3443, 3424, 3385],
  },
  {
    start: 31.3,
    end: 32.4,
    rpm: [3562, 3562, 3522, 3542, 3542, 3463, 3385, 3347, 3347, 3310, 3182],
  },
  { start: 32.48, end: 33.28, rpm: [3705, 3705, 3663, 3663, 3622, 3582, 3582, 3602] },
  {
    start: 33.36,
    end: 36.56,
    rpm: [
      3643, 3622, 3643, 3643, 3643, 3684, 3684, 3643, 3643, 3643, 3684, 3747, 3768, 3811, 3854,
      3898, 3920, 3964, 4009, 4055, 4078, 4124, 4171, 4218, 4218, 4266, 4290, 4363, 4388, 4463,
      4488, 4463,
    ],
  },
  {
    start: 36.64,
    end: 38.64,
    rpm: [
      3811, 3832, 3898, 3964, 4032, 4124, 4194, 4218, 4314, 4363, 4438, 4539, 4642, 4722, 4802,
      4884, 4939, 4995, 5109, 5109,
    ],
  },
];

/** Big Twin (v-twin-cruiser): warm idle of a Harley-Davidson V-twin, CC0 Freesound 850565. */
const BIG_TWIN_REGIONS: RecordedRegion[] = [
  {
    start: 0.08,
    end: 7.48,
    rpm: [
      1559, 1540, 1448, 1451, 1424, 1400, 1403, 1386, 1388, 1376, 1379, 1379, 1316, 1316, 1331,
      1335, 1338, 1338, 1345, 1362, 1374, 1393, 1395, 1400, 1403, 1403, 1403, 1403, 1355, 1355,
      1352, 1362, 1359, 1379, 1391, 1391, 1391, 1391, 1391, 1391, 1408, 1403, 1403, 1400, 1400,
      1383, 1383, 1364, 1338, 1343, 1331, 1321, 1311, 1309, 1309, 1282, 1285, 1297, 1287, 1287,
      1292, 1278, 1278, 1278, 1282, 1285, 1304, 1302, 1299, 1299, 1299, 1299, 1292, 1287,
    ],
  },
];

export interface RecordedHandover {
  rpmStart: number;
  rpmSpan: number;
  accelKeep: number;
  /** Share of recording kept above the rpm hand-over (texture continuity), faded out above ~4,400 rpm. */
  rpmKeep?: number;
  /** Where the rpmKeep texture fades out (default 4,400 rpm over 700 rpm, V8 tuning). */
  topRpm?: number;
  topSpan?: number;
}

export const DEFAULT_HANDOVER: RecordedHandover = { rpmStart: 2400, rpmSpan: 900, accelKeep: 0.15 };

export interface RecordedLoopBank {
  personalityId: string;
  sources: RecordedSource[];
  /** Overall sample-layer level at full sample weight. */
  level: number;
  /** Where recordings hand over to the synth: fade rpmStart → rpmStart+rpmSpan; accelKeep = share kept at full aggression. */
  handover: RecordedHandover;
  /**
   * RPM-interpolated match-EQ on the procedural synth toward the recording's measured
   * spectrum (dB per band: 100 Hz low shelf, 250 / 600 / 1400 Hz peaks, 3 kHz high shelf).
   */
  synthMatch?: { rpm: number[]; bandsDb: number[][] };
  /** Match-EQ on the recorded layer toward the synth timbre (dB). */
  eq: {
    lowShelfDb: number;
    midDb: number;
    midHz: number;
    highShelfDb: number;
    highShelfHz: number;
    lowpassHz: number;
    /**
     * Optional: above this RPM the 120 Hz low shelf follows the firing frequency
     * (120 Hz × rpm / lowShelfTrackFromRpm), so pitched-up grains keep their weight
     * instead of thinning out toward the top of each gear. Unset = fixed 120 Hz.
     */
    lowShelfTrackFromRpm?: number;
  };
}

/** Low-shelf corner for the recorded match-EQ at an RPM (fixed 120 Hz unless tracking is enabled). */
export function recordedLowShelfHz(eq: RecordedLoopBank["eq"], rpm: number): number {
  const from = eq.lowShelfTrackFromRpm;
  if (!from || rpm <= from) return 120;
  return Math.min(240, (120 * rpm) / from);
}

/** Idle/cruise regions only (the last two are free-rev regions used for GT V8 under load). */
const MASERATI_CRUISE_REGIONS = MASERATI_REGIONS.slice(0, 6);
const maserati = (weight: number, regions = MASERATI_REGIONS): RecordedSource => ({
  id: "maserati",
  url: `${BASE}/maserati_v8_regions.m4a`,
  regions,
  weight,
});
const rover = (weight: number): RecordedSource => ({
  id: "rover",
  url: `${BASE}/rover_v8_regions.m4a`,
  regions: ROVER_REGIONS,
  weight,
});

// Measured on real-chain renders (recording-only vs synth-only, std plan): the onboard/road
// recordings lack sub-150 Hz weight (~-9 dB) and carry extra 180-350 Hz; meet halfway.
const SUPERBIKE_EQ: RecordedLoopBank["eq"] = {
  lowShelfDb: 6,
  midDb: -3,
  midHz: 300,
  highShelfDb: 0,
  highShelfHz: 2500,
  lowpassHz: 12000,
};
// Measured the same way: the close-mic idle is thin at 200-800 Hz and ~7 dB hissier above 2.5 kHz.
const BIG_TWIN_EQ: RecordedLoopBank["eq"] = {
  lowShelfDb: 2,
  midDb: 5,
  midHz: 450,
  highShelfDb: -6,
  highShelfHz: 2500,
  lowpassHz: 6000,
};

export const RECORDED_LOOP_BANKS: Record<string, RecordedLoopBank> = {
  "american-v8": {
    personalityId: "american-v8",
    sources: [maserati(1, MASERATI_CRUISE_REGIONS), rover(0.55)],
    level: 0.36,
    handover: DEFAULT_HANDOVER,
    // Synth match-EQ measured but not applied: it barely helped the American V8 (see round 3 notes).
    // Measured on real-chain renders: recording is far brighter and thinner than the V8 synth.
    eq: {
      lowShelfDb: 10,
      midDb: -4,
      midHz: 700,
      highShelfDb: -8,
      highShelfHz: 1500,
      lowpassHz: 1300,
    },
  },
  "gt-v8": {
    personalityId: "gt-v8",
    sources: [maserati(1)],
    level: 0.28,
    // GT V8: keep the Maserati texture under acceleration (rev grains up to ~4,300 rpm).
    handover: { rpmStart: 2800, rpmSpan: 1000, accelKeep: 0.5, rpmKeep: 0.5 },
    // Learned on real-chain renders (recording-only vs synth-only, 0.5 s frames, gentle+hard), 100 %.
    synthMatch: {
      rpm: [1400, 1800, 2200, 2600, 3000, 3500, 4000],
      bandsDb: [
        [0, 0, 0, 0, 0],
        [-1.1, 2.1, -2.7, -4.8, -4.3],
        [-0.7, 0.6, -0.2, -2.8, -2.7],
        [4.6, -0.4, 1.9, -2.0, -3.0],
        [1.7, -0.3, 1.5, -3.5, -5.1],
        [-3.9, -0.9, 2.6, 1.5, -4.2],
        [-10, -1.3, 3.2, 2.0, -5.9],
      ],
    },
    eq: {
      lowShelfDb: 12,
      midDb: -2,
      midHz: 450,
      highShelfDb: 6,
      highShelfHz: 2200,
      lowpassHz: 7000,
      // Keep the bass weight as revs climb in each gear (idle and early cruise up to 2,200 rpm unchanged).
      lowShelfTrackFromRpm: 2200,
    },
  },
  "motorcycle-inline-4": {
    personalityId: "motorcycle-inline-4",
    sources: [
      {
        id: "superbike",
        url: `${BASE}/superbike_i4_regions.m4a`,
        regions: SUPERBIKE_REGIONS,
        weight: 1,
        minRate: 0.78,
        maxRate: 2.4,
      },
    ],
    level: 0.38,
    // Recordings carry idle and street riding, keep 35 % texture under load and revs, and
    // fade out toward the top so the synth's 14k scream and quickshift ladder stay in charge.
    handover: {
      rpmStart: 5200,
      rpmSpan: 2800,
      accelKeep: 0.55,
      rpmKeep: 0.35,
      topRpm: 10000,
      topSpan: 2500,
    },
    eq: SUPERBIKE_EQ,
  },
  "v-twin-cruiser": {
    personalityId: "v-twin-cruiser",
    sources: [
      {
        id: "big-twin",
        url: `${BASE}/big_twin_regions.m4a`,
        regions: BIG_TWIN_REGIONS,
        weight: 1,
        // Recorded idle is ~1,300 rpm (cold); pitch down to the 900 rpm potato-potato idle.
        minRate: 0.62,
        maxRate: 1.75,
      },
    ],
    level: 0.5,
    handover: {
      rpmStart: 1700,
      rpmSpan: 900,
      accelKeep: 0.3,
      rpmKeep: 0.2,
      topRpm: 2300,
      topSpan: 700,
    },
    eq: BIG_TWIN_EQ,
  },
};

export function getRecordedLoopBank(personalityId: string): RecordedLoopBank | null {
  return RECORDED_LOOP_BANKS[personalityId] ?? null;
}

export const smoothstep = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * Hand-over curve: 1 = recordings carry the sound, 0 = procedural synth only.
 * Recordings now carry idle and relaxed cruise up to ~2,400 rpm and fade out
 * slowly to ~3,300 rpm; aggressive acceleration hands over to the synth's on-load
 * growl, very high demand too.
 */
export function recordedSampleWeight(
  rpm: number,
  demand: number,
  aggression = 0,
  handover: RecordedHandover = DEFAULT_HANDOVER,
): number {
  const rpmKeep = handover.rpmKeep ?? 0;
  const byRpm = 1 - (1 - rpmKeep) * smoothstep((rpm - handover.rpmStart) / handover.rpmSpan);
  const keep = handover.accelKeep;
  const byDemand = 1 - (1 - rpmKeep) * smoothstep((demand - 0.6) / 0.3);
  const byAccel = 1 - (1 - keep) * smoothstep(aggression);
  const top =
    rpmKeep > 0 ? 1 - smoothstep((rpm - (handover.topRpm ?? 4400)) / (handover.topSpan ?? 700)) : 1;
  // Texture floor: banks with rpmKeep keep that share of recording under load and revs.
  return Math.max(0, Math.min(1, Math.max(byRpm * byDemand * byAccel, rpmKeep)) * top);
}

/** Pitch range kept natural. */
export const MIN_GRAIN_RATE = 0.78;
export const MAX_GRAIN_RATE = 1.6;

export function regionRpmAt(region: RecordedRegion, offset: number): number {
  const i = Math.min(
    region.rpm.length - 1,
    Math.max(0, Math.floor((offset - region.start) / RPM_TRACK_STEP)),
  );
  return region.rpm[i] ?? region.rpm[0] ?? 1000;
}

function regionMeanRpm(region: RecordedRegion): number {
  return region.rpm.reduce((a, b) => a + b, 0) / Math.max(1, region.rpm.length);
}

/**
 * Pick a region for a target RPM: candidates within the natural pitch range, weighted
 * by log-RPM closeness and region length. Returns null when nothing fits.
 */
export function pickRegion(
  regions: RecordedRegion[],
  rpm: number,
  rand: () => number,
  minRate = MIN_GRAIN_RATE,
  maxRate = MAX_GRAIN_RATE,
): RecordedRegion | null {
  const cands = regions
    .map((r) => {
      const mean = regionMeanRpm(r);
      const rate = rpm / mean;
      if (rate < minRate || rate > maxRate || r.end - r.start < 0.6) return null;
      const d = Math.log2(rate);
      return { r, w: Math.exp(-(d * d) / (2 * 0.18 * 0.18)) * Math.sqrt(r.end - r.start) };
    })
    .filter((c): c is { r: RecordedRegion; w: number } => c !== null);
  if (!cands.length) {
    // Fall back to the closest region (rate will be clamped).
    let best: RecordedRegion | null = null;
    let bestD = Infinity;
    for (const r of regions) {
      const d = Math.abs(Math.log2(rpm / regionMeanRpm(r)));
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }
  const total = cands.reduce((s, c) => s + c.w, 0);
  let x = rand() * total;
  for (const c of cands) {
    x -= c.w;
    if (x <= 0) return c.r;
  }
  return cands[cands.length - 1]!.r;
}

/** Interpolate the synth match-EQ table at an RPM (flat outside data). */
export function synthMatchAt(
  table: { rpm: number[]; bandsDb: number[][] } | undefined,
  rpm: number,
): number[] {
  if (!table || !table.rpm.length) return [0, 0, 0, 0, 0];
  const r = table.rpm;
  if (rpm <= r[0]!) return [...table.bandsDb[0]!];
  if (rpm >= r[r.length - 1]!) return [...table.bandsDb[r.length - 1]!];
  let i = 0;
  while (rpm > r[i + 1]!) i += 1;
  const f = (rpm - r[i]!) / (r[i + 1]! - r[i]!);
  return table.bandsDb[i]!.map((g, k) => g + (table.bandsDb[i + 1]![k]! - g) * f);
}

export type LoadCharacter = "idle" | "cruise" | "on-load" | "aggressive" | "overrun";

/**
 * Acceleration-rate estimator robust to 1 Hz GPS: speed is smoothed, acceleration is
 * the slope over a ~1.5 s window, jerk its smoothed derivative. Outputs continuous
 * 0..1 amounts (onLoad, aggression, overrun) plus a discrete label for diagnostics.
 */
export class AccelerationCharacter {
  private v = 0;
  private a = 0;
  private j = 0;
  private hist: { t: number; v: number }[] = [];
  onLoad = 0;
  aggression = 0;
  overrun = 0;
  accel = 0;
  jerk = 0;

  update(speedMs: number, t: number, dt: number): void {
    const k = 1 - Math.exp(-dt / 0.35);
    this.v += (speedMs - this.v) * k;
    this.hist.push({ t, v: this.v });
    while (this.hist.length > 2 && t - this.hist[0]!.t > 1.5) this.hist.shift();
    const first = this.hist[0]!;
    const span = t - first.t;
    const slope = span > 0.3 ? (this.v - first.v) / span : 0;
    const prevA = this.a;
    this.a += (slope - this.a) * (1 - Math.exp(-dt / 0.5));
    const rawJ = (this.a - prevA) / Math.max(dt, 1e-3);
    this.j += (rawJ - this.j) * (1 - Math.exp(-dt / 0.6));
    this.accel = this.a;
    this.jerk = this.j;
    // Targets: gentle >0.25 m/s², strong >1.2 m/s² (or rising quickly), lift-off < -0.35 m/s².
    const onT = smoothstep((this.a - 0.2) / 0.6);
    const agT = Math.min(
      1,
      smoothstep((this.a - 1.0) / 1.4) + 0.6 * smoothstep((this.j - 0.4) / 1.2) * onT,
    );
    const ovT = smoothstep((-this.a - 0.3) / 0.7);
    const ease = (cur: number, tgt: number, up: number, down: number) =>
      cur + (tgt - cur) * (1 - Math.exp(-dt / (tgt > cur ? up : down)));
    this.onLoad = ease(this.onLoad, onT, 0.3, 0.8);
    this.aggression = ease(this.aggression, agT, 0.25, 1.0);
    this.overrun = ease(this.overrun, ovT, 0.3, 0.6);
  }

  label(speedMs: number): LoadCharacter {
    if (speedMs < 0.8 && this.onLoad < 0.3) return "idle";
    if (this.aggression > 0.5) return "aggressive";
    if (this.onLoad > 0.5) return "on-load";
    if (this.overrun > 0.5) return "overrun";
    return "cruise";
  }
}

export interface RecordedCredit {
  title: string;
  author: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  usedIn: string;
  attribution: string;
}

export const RECORDED_LOOP_CREDITS: RecordedCredit[] = [
  {
    title: "Maserati GranTurismo S Exhaust",
    author: "lmartins",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Maserati_GranTurismo_S_Exhaust.ogg",
    usedIn: "American Muscle V8, GT V8 (idle and cruise)",
    attribution:
      "\u201CMaserati GranTurismo S Exhaust\u201D by lmartins, CC BY 4.0 (creativecommons.org/licenses/by/4.0), edited (trimmed, filtered, re-sequenced).",
  },
  {
    title: "Rover-v8-rr79 (3.5 L Rover V8, 1979 Range Rover)",
    author: "Collard (English Wikipedia)",
    licence: "Public domain",
    licenceUrl: "https://commons.wikimedia.org/wiki/File:Rover-v8-rr79.ogg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rover-v8-rr79.ogg",
    usedIn: "American Muscle V8 (idle and low cruise)",
    attribution: "\u201CRover-v8-rr79\u201D by Collard, public domain.",
  },
  {
    title: "S1000R Black Widow Exhaust Road Test (Freesound #578059)",
    author: "Joe.L85",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/578059/",
    usedIn: "Superbike (idle, street riding, pulls up to ~3,400 rpm)",
    attribution:
      "\u201CS1000R Black Widow Exhaust Road Test\u201D by Joe.L85 (Freesound #578059), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "motorbike hornet 600 onboard.clip 0005.N3.F (Freesound #181161)",
    author: "martian",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/181161/",
    usedIn: "Superbike (idle and onboard pulls up to ~5,100 rpm)",
    attribution:
      "\u201Cmotorbike hornet 600 onboard.clip 0005.N3.F\u201D by martian (Freesound #181161), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Moto Harley Davidson Arrancando (Freesound #850565)",
    author: "Mariayolanda511",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/850565/",
    usedIn: "Big Twin (idle and low cruise)",
    attribution:
      "\u201CMoto Harley Davidson Arrancando\u201D by Mariayolanda511 (Freesound #850565), CC0 1.0, edited (trimmed, filtered, granular).",
  },
];
