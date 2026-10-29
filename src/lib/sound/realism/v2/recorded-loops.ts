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
const BIG_TWIN_RIDE_BASE = "/sample-packs/recorded/v5";
const F1_LEVEL = 0.4;

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
  /**
   * Optional RPM window for this source inside a multi-source bank: gain ramps in from
   * inFrom to inFull and out from outFull to outTo (smoothstep). Unset = full gain everywhere.
   */
  rpmWindow?: { inFrom?: number; inFull?: number; outFull?: number; outTo?: number };
  /**
   * Optional load role inside a load-mixed bank: the source plays when the ride matches
   * (standstill idle, steady cruise, on-throttle growl, hard pull / shifts, engine braking).
   * Load-mixed banks are equal-power normalised across their sources.
   */
  load?: SourceLoad;
}

export type SourceLoad = "idle" | "cruise" | "growl" | "hard" | "overrun";

/** Load state read from AccelerationCharacter plus vehicle speed. */
export interface LoadState {
  speedMs: number;
  onLoad: number;
  aggression: number;
  overrun: number;
}

/** Raw (un-normalised) gain of a load role. */
export function sourceLoadGain(load: SourceLoad, st: LoadState): number {
  const moving = smoothstep((st.speedMs - 0.6) / 2.2);
  const on = Math.min(1, Math.max(0, st.onLoad));
  const ag = Math.min(1, Math.max(0, st.aggression));
  const ov = Math.min(1, Math.max(0, st.overrun));
  switch (load) {
    case "idle":
      return (1 - moving) * (1 - 0.8 * on);
    case "cruise":
      return moving * (1 - on) * (1 - ov);
    case "growl":
      return on * (1 - ag);
    case "hard":
      return ag;
    case "overrun":
      return moving * ov * (1 - on);
  }
}

/** Equal-power gains for every source of a load-mixed bank (sum of squares = 1). */
export function loadMixGains(sources: RecordedSource[], st: LoadState): number[] {
  const raw = sources.map((src) => (src.load ? sourceLoadGain(src.load, st) : 1));
  const total = Math.sqrt(raw.reduce((sum, g) => sum + g * g, 0));
  if (total < 1e-3) return sources.map((src) => (src.load === "idle" || !src.load ? 1 : 0));
  return raw.map((g) => g / total);
}

/** Per-source gain (0..1) at an RPM from its optional rpmWindow. */
export function sourceRpmGain(source: RecordedSource, rpm: number): number {
  const win = source.rpmWindow;
  if (!win) return 1;
  const ss = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  };
  let g = 1;
  if (win.inFrom !== undefined && win.inFull !== undefined) {
    g *= ss((rpm - win.inFrom) / Math.max(1, win.inFull - win.inFrom));
  }
  if (win.outFull !== undefined && win.outTo !== undefined) {
    g *= 1 - ss((rpm - win.outFull) / Math.max(1, win.outTo - win.outFull));
  }
  return g;
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

/** Big Twin (v-twin-cruiser): warm idle of a big V-twin, CC0 Freesound 850565. */
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

/**
 * Big Twin riding layers: CC0 Freesound recordings (502690 demodave, 81068 allencote,
 * 869327 valeriocn, 657763 Tom_Kaszuba, 743981 BranCorvus, 35537 johnmcd). Trimmed, 30 Hz
 * high-pass, +3 dB low shelf below 110 Hz, level-matched. RPM tracks are coarse ramps per
 * region (growl blips, pulls through the gears, roll-off, steady cruise).
 */
const BIG_TWIN_GROWL_REGIONS: RecordedRegion[] = [
  { start: 0.08, end: 4.58, rpm: [2300,  2313,  2327,  2340,  2354,  2368,  2381,  2395,  2409,  2422,  2436,  2450,  2463,  2477,  2490,  2504,  2518,  2531,  2545,  2559,  2572,  2586,  2600,  2613,  2627,  2640,  2654,  2668,  2681,  2695,  2709,  2722,  2736,  2750,  2763,  2777,  2790,  2804,  2818,  2831,  2845,  2859,  2872,  2886,  2900] },
  { start: 4.66, end: 9.16, rpm: [2400,  2413,  2427,  2440,  2454,  2468,  2481,  2495,  2509,  2522,  2536,  2550,  2563,  2577,  2590,  2604,  2618,  2631,  2645,  2659,  2672,  2686,  2700,  2713,  2727,  2740,  2754,  2768,  2781,  2795,  2809,  2822,  2836,  2850,  2863,  2877,  2890,  2904,  2918,  2931,  2945,  2959,  2972,  2986,  3000] },
  { start: 9.24, end: 14.24, rpm: [2200,  2220,  2240,  2261,  2281,  2302,  2322,  2342,  2363,  2383,  2404,  2424,  2444,  2465,  2485,  2506,  2526,  2546,  2567,  2587,  2608,  2628,  2648,  2669,  2689,  2710,  2730,  2751,  2771,  2791,  2812,  2832,  2853,  2873,  2893,  2914,  2934,  2955,  2975,  2995,  3016,  3036,  3057,  3077,  3097,  3118,  3138,  3159,  3179,  3200] },
  { start: 14.32, end: 19.32, rpm: [2600,  2616,  2632,  2648,  2665,  2681,  2697,  2714,  2730,  2746,  2763,  2779,  2795,  2812,  2828,  2844,  2861,  2877,  2893,  2910,  2926,  2942,  2959,  2975,  2991,  3008,  3024,  3040,  3057,  3073,  3089,  3106,  3122,  3138,  3155,  3171,  3187,  3204,  3220,  3236,  3253,  3269,  3285,  3302,  3318,  3334,  3351,  3367,  3383,  3400] },
];
const BIG_TWIN_ACCEL_REGIONS: RecordedRegion[] = [
  { start: 0.08, end: 5.08, rpm: [1300,  1340,  1381,  1422,  1463,  1504,  1544,  1585,  1626,  1667,  1708,  1748,  1789,  1830,  1871,  1912,  1953,  1993,  2034,  2075,  2116,  2157,  2197,  2238,  2279,  2320,  2361,  2402,  2442,  2483,  2524,  2565,  2606,  2646,  2687,  2728,  2769,  2810,  2851,  2891,  2932,  2973,  3014,  3055,  3095,  3136,  3177,  3218,  3259,  3300] },
  { start: 5.16, end: 10.66, rpm: [2200,  2237,  2274,  2311,  2348,  2385,  2422,  2459,  2496,  2533,  2570,  2607,  2644,  2681,  2718,  2755,  2792,  2829,  2866,  2903,  2940,  2977,  3014,  3051,  3088,  3125,  3162,  3200,  3237,  3274,  3311,  3348,  3385,  3422,  3459,  3496,  3533,  3570,  3607,  3644,  3681,  3718,  3755,  3792,  3829,  3866,  3903,  3940,  3977,  4014,  4051,  4088,  4125,  4162,  4200] },
  { start: 10.74, end: 16.24, rpm: [2600,  2637,  2674,  2711,  2748,  2785,  2822,  2859,  2896,  2933,  2970,  3007,  3044,  3081,  3118,  3155,  3192,  3229,  3266,  3303,  3340,  3377,  3414,  3451,  3488,  3525,  3562,  3600,  3637,  3674,  3711,  3748,  3785,  3822,  3859,  3896,  3933,  3970,  4007,  4044,  4081,  4118,  4155,  4192,  4229,  4266,  4303,  4340,  4377,  4414,  4451,  4488,  4525,  4562,  4600] },
  { start: 16.32, end: 22.82, rpm: [1400,  1434,  1468,  1503,  1537,  1571,  1606,  1640,  1675,  1709,  1743,  1778,  1812,  1846,  1881,  1915,  1950,  1984,  2018,  2053,  2087,  2121,  2156,  2190,  2225,  2259,  2293,  2328,  2362,  2396,  2431,  2465,  2500,  2534,  2568,  2603,  2637,  2671,  2706,  2740,  2775,  2809,  2843,  2878,  2912,  2946,  2981,  3015,  3050,  3084,  3118,  3153,  3187,  3221,  3256,  3290,  3325,  3359,  3393,  3428,  3462,  3496,  3531,  3565,  3600] },
  { start: 22.9, end: 29.4, rpm: [2400,  2431,  2462,  2493,  2525,  2556,  2587,  2618,  2650,  2681,  2712,  2743,  2775,  2806,  2837,  2868,  2900,  2931,  2962,  2993,  3025,  3056,  3087,  3118,  3150,  3181,  3212,  3243,  3275,  3306,  3337,  3368,  3400,  3431,  3462,  3493,  3525,  3556,  3587,  3618,  3650,  3681,  3712,  3743,  3775,  3806,  3837,  3868,  3900,  3931,  3962,  3993,  4025,  4056,  4087,  4118,  4150,  4181,  4212,  4243,  4275,  4306,  4337,  4368,  4400] },
  { start: 29.48, end: 37.98, rpm: [2400,  2417,  2435,  2453,  2471,  2489,  2507,  2525,  2542,  2560,  2578,  2596,  2614,  2632,  2650,  2667,  2685,  2703,  2721,  2739,  2757,  2775,  2792,  2810,  2828,  2846,  2864,  2882,  2900,  2917,  2935,  2953,  2971,  2989,  3007,  3025,  3042,  3060,  3078,  3096,  3114,  3132,  3150,  3167,  3185,  3203,  3221,  3239,  3257,  3275,  3292,  3310,  3328,  3346,  3364,  3382,  3400,  3417,  3435,  3453,  3471,  3489,  3507,  3525,  3542,  3560,  3578,  3596,  3614,  3632,  3650,  3667,  3685,  3703,  3721,  3739,  3757,  3775,  3792,  3810,  3828,  3846,  3864,  3882,  3900] },
  { start: 38.06, end: 46.56, rpm: [2300,  2317,  2335,  2353,  2371,  2389,  2407,  2425,  2442,  2460,  2478,  2496,  2514,  2532,  2550,  2567,  2585,  2603,  2621,  2639,  2657,  2675,  2692,  2710,  2728,  2746,  2764,  2782,  2800,  2817,  2835,  2853,  2871,  2889,  2907,  2925,  2942,  2960,  2978,  2996,  3014,  3032,  3050,  3067,  3085,  3103,  3121,  3139,  3157,  3175,  3192,  3210,  3228,  3246,  3264,  3282,  3300,  3317,  3335,  3353,  3371,  3389,  3407,  3425,  3442,  3460,  3478,  3496,  3514,  3532,  3550,  3567,  3585,  3603,  3621,  3639,  3657,  3675,  3692,  3710,  3728,  3746,  3764,  3782,  3800] },
  { start: 46.64, end: 55.64, rpm: [2200,  2216,  2233,  2250,  2267,  2284,  2301,  2317,  2334,  2351,  2368,  2385,  2402,  2419,  2435,  2452,  2469,  2486,  2503,  2520,  2537,  2553,  2570,  2587,  2604,  2621,  2638,  2655,  2671,  2688,  2705,  2722,  2739,  2756,  2773,  2789,  2806,  2823,  2840,  2857,  2874,  2891,  2907,  2924,  2941,  2958,  2975,  2992,  3008,  3025,  3042,  3059,  3076,  3093,  3110,  3126,  3143,  3160,  3177,  3194,  3211,  3228,  3244,  3261,  3278,  3295,  3312,  3329,  3346,  3362,  3379,  3396,  3413,  3430,  3447,  3464,  3480,  3497,  3514,  3531,  3548,  3565,  3582,  3598,  3615,  3632,  3649,  3666,  3683,  3700] },
];
const BIG_TWIN_DECEL_REGIONS: RecordedRegion[] = [
  { start: 0.08, end: 4.08, rpm: [3400,  3382,  3364,  3346,  3328,  3310,  3292,  3274,  3256,  3238,  3220,  3202,  3184,  3166,  3148,  3130,  3112,  3094,  3076,  3058,  3041,  3023,  3005,  2987,  2969,  2951,  2933,  2915,  2897,  2879,  2861,  2843,  2825,  2807,  2789,  2771,  2753,  2735,  2717,  2700] },
  { start: 4.16, end: 8.16, rpm: [2900,  2882,  2864,  2846,  2828,  2810,  2792,  2774,  2756,  2738,  2720,  2702,  2684,  2666,  2648,  2630,  2612,  2594,  2576,  2558,  2541,  2523,  2505,  2487,  2469,  2451,  2433,  2415,  2397,  2379,  2361,  2343,  2325,  2307,  2289,  2271,  2253,  2235,  2217,  2200] },
  { start: 8.24, end: 12.24, rpm: [2500,  2482,  2464,  2446,  2428,  2410,  2392,  2374,  2356,  2338,  2320,  2302,  2284,  2266,  2248,  2230,  2212,  2194,  2176,  2158,  2141,  2123,  2105,  2087,  2069,  2051,  2033,  2015,  1997,  1979,  1961,  1943,  1925,  1907,  1889,  1871,  1853,  1835,  1817,  1800] },
  { start: 12.32, end: 15.82, rpm: [2800,  2773,  2747,  2720,  2694,  2667,  2641,  2614,  2588,  2561,  2535,  2508,  2482,  2455,  2429,  2402,  2376,  2350,  2323,  2297,  2270,  2244,  2217,  2191,  2164,  2138,  2111,  2085,  2058,  2032,  2005,  1979,  1952,  1926,  1900] },
  { start: 15.9, end: 19.4, rpm: [2200,  2179,  2158,  2138,  2117,  2097,  2076,  2055,  2035,  2014,  1994,  1973,  1952,  1932,  1911,  1891,  1870,  1850,  1829,  1808,  1788,  1767,  1747,  1726,  1705,  1685,  1664,  1644,  1623,  1602,  1582,  1561,  1541,  1520,  1500] },
];
const BIG_TWIN_CRUISE_REGIONS: RecordedRegion[] = [
  { start: 0.08, end: 5.08, rpm: [2200,  2201,  2202,  2203,  2204,  2205,  2206,  2207,  2208,  2209,  2210,  2211,  2212,  2213,  2214,  2215,  2216,  2217,  2218,  2219,  2220,  2221,  2222,  2223,  2224,  2225,  2226,  2227,  2228,  2229,  2230,  2231,  2232,  2233,  2234,  2235,  2236,  2237,  2238,  2239,  2240,  2241,  2242,  2243,  2244,  2245,  2246,  2247,  2248,  2250] },
  { start: 5.16, end: 10.16, rpm: [2250,  2248,  2247,  2246,  2245,  2244,  2243,  2242,  2241,  2240,  2239,  2238,  2237,  2236,  2235,  2234,  2233,  2232,  2231,  2230,  2229,  2228,  2227,  2226,  2225,  2224,  2223,  2222,  2221,  2220,  2219,  2218,  2217,  2216,  2215,  2214,  2213,  2212,  2211,  2210,  2209,  2208,  2207,  2206,  2205,  2204,  2203,  2202,  2201,  2200] },
  { start: 10.24, end: 15.24, rpm: [2150,  2152,  2154,  2156,  2158,  2160,  2162,  2164,  2166,  2168,  2170,  2172,  2174,  2176,  2178,  2180,  2182,  2184,  2186,  2188,  2190,  2192,  2194,  2196,  2198,  2201,  2203,  2205,  2207,  2209,  2211,  2213,  2215,  2217,  2219,  2221,  2223,  2225,  2227,  2229,  2231,  2233,  2235,  2237,  2239,  2241,  2243,  2245,  2247,  2250] },
  { start: 15.32, end: 20.32, rpm: [2200,  2198,  2197,  2196,  2195,  2194,  2193,  2192,  2191,  2190,  2189,  2188,  2187,  2186,  2185,  2184,  2183,  2182,  2181,  2180,  2179,  2178,  2177,  2176,  2175,  2174,  2173,  2172,  2171,  2170,  2169,  2168,  2167,  2166,  2165,  2164,  2163,  2162,  2161,  2160,  2159,  2158,  2157,  2156,  2155,  2154,  2153,  2152,  2151,  2150] },
];

/**
 * F1 (f1-v10): eleven near pass-bys from a CC0 trackside recording (Freesound 150337, 2012
 * Melbourne GP practice, 2.4 L V8s). RPM from the bank firing order (rpm / 30 Hz), 13k-19k,
 * Doppler included. Used as a high-rpm texture band under the V10 synth, not at idle.
 */
const F1_PASSBY_REGIONS: RecordedRegion[] = [
  {
    start: 0.08,
    end: 1.58,
    rpm: [
      18057, 16782, 16585, 16083, 15894, 15782, 15932, 15708, 15708, 16236, 16468, 16468, 16468,
      16121,
    ],
  },
  {
    start: 1.66,
    end: 3.16,
    rpm: [
      17845, 18314, 18576, 18664, 19020, 18930, 18314, 17635, 17061, 16545, 15894, 14983, 14359,
      13761,
    ],
  },
  {
    start: 3.24,
    end: 4.74,
    rpm: [
      18314, 18271, 18664, 18975, 19291, 19383, 19246, 18057, 16742, 16083, 15782, 15523, 15161,
      15233,
    ],
  },
  {
    start: 4.82,
    end: 6.32,
    rpm: [
      18708, 18708, 17719, 16742, 16121, 15671, 15341, 15233, 14983, 14807, 14737, 14702, 14668,
      14737,
    ],
  },
  {
    start: 6.4,
    end: 7.9,
    rpm: [
      15819, 15671, 15054, 14124, 13377, 13095, 13065, 13536, 13504, 13600, 13632, 13536, 13568,
      13345,
    ],
  },
  {
    start: 7.98,
    end: 9.48,
    rpm: [
      18532, 18620, 18445, 18445, 17971, 17677, 17428, 16351, 15597, 15125, 14842, 14702, 14461,
      14224,
    ],
  },
  {
    start: 9.56,
    end: 11.06,
    rpm: [
      18185, 18488, 18532, 18841, 18796, 18796, 18796, 18358, 17802, 16861, 15857, 15125, 14983,
      14912,
    ],
  },
  {
    start: 11.14,
    end: 12.64,
    rpm: [
      16313, 16313, 16429, 16429, 16390, 16351, 16045, 16007, 15819, 15708, 15745, 15819, 15487,
      15018,
    ],
  },
  {
    start: 12.72,
    end: 14.22,
    rpm: [
      17635, 17929, 18142, 18358, 18620, 18796, 18796, 18708, 18185, 17428, 16703, 16083, 15487,
      14947,
    ],
  },
  {
    start: 14.3,
    end: 15.8,
    rpm: [
      18271, 18488, 18576, 18358, 17971, 17971, 17469, 16045, 15450, 15450, 15054, 14877, 14842,
      14807,
    ],
  },
  {
    start: 15.88,
    end: 17.38,
    rpm: [
      18576, 17887, 17593, 17223, 17021, 16663, 16351, 16083, 16007, 15414, 15233, 15125, 15089,
      15089,
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
  /**
   * High-rpm texture band (F1 pass-by material): weight = level × smoothstep from fromRpm to
   * fullRpm, scaled 40-100 % by demand. Replaces the low-rpm hand-over curve when set.
   */
  band?: { fromRpm: number; fullRpm: number; level: number };
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

/**
 * Superbike high band: near-steady high-rev stretches (≈8,900–12,700 rpm) from two CC0
 * Freesound trackside / road pass recordings (361403 richwise "Sportsbike Flyby", 813521
 * danroka "sports motorcycle passing by at speed"). RPM from the inline-4 firing order
 * (rpm / 30 Hz) per 0.1 s, Doppler included; the pass-by peak itself and the gear change
 * are cut out. High-passed at 180 Hz (the synth keeps the body), RMS-normalised.
 */
/**
 * Superbike street layer (v4): idle, blips and revs from one CC0 Freesound recording of a
 * V4 superbike (#584115, rsn267). RPM tracked from the exhaust pulse (scaled so the idle sits
 * at ~1,500 rpm); covers idle to ~5,400 rpm, then hands over to the high-rev layer.
 */
const SUPERBIKE_STREET_REGIONS: RecordedRegion[] = [
  { start: 0.1, end: 2.1, rpm: [1717, 1890, 2050, 2050, 2009, 1928, 1838, 1734, 1671, 1587, 1558, 1529, 1529, 1613, 1697, 1781, 1869, 2048, 2227, 2317] },
  { start: 2.15, end: 4.15, rpm: [2154, 2049, 1964, 1874, 1756, 1674, 1642, 1639, 1639, 1639, 1639, 1639, 1639, 1639, 1639, 1635, 1627, 1620, 1584, 1521] },
  { start: 4.2, end: 6.2, rpm: [1426, 1426, 1407, 1407, 1407, 1440, 1453, 1467, 1467, 1467, 1467, 1467, 1467, 1467, 1467, 1467, 1467, 1467, 1467, 1467] },
  { start: 6.25, end: 8.25, rpm: [1467, 1467, 1495, 1553, 1634, 1714, 1824, 1990, 2182, 2342, 2422, 2530, 2691, 2852, 2702, 2242, 1784, 1561, 1568, 1572] },
  { start: 8.3, end: 10.3, rpm: [1609, 1663, 1749, 1842, 1918, 2029, 2180, 2452, 2779, 3688, 4561, 5312, 5397, 5397, 5143, 4634, 3927, 3269, 2690, 2192] },
  { start: 10.35, end: 12.35, rpm: [1835, 1768, 1760, 1737, 1697, 1640, 1584, 1547, 1571, 1713, 2076, 2565, 3047, 3486, 3847, 4115, 4205, 4074, 3717, 3222] },
  { start: 12.4, end: 14.4, rpm: [2608, 2419, 2318, 2178, 2070, 1825, 1825, 1933, 2199, 2350, 2394, 2416, 2416, 2405, 2201, 1942, 1694, 1686, 1742, 1979] },
  { start: 14.45, end: 16.45, rpm: [2363, 2712, 3021, 3325, 3573, 3771, 3870, 3870, 3771, 3477, 3039, 2601, 2253, 1994, 1834, 1834, 2011, 2257, 2449, 2518] },
  { start: 16.5, end: 18.5, rpm: [2484, 2417, 2350, 2138, 1960, 1960, 2149, 2533, 2738, 2933, 2933, 2760, 2504, 2247, 2162, 2162, 2304, 2722, 3140, 3416] },
  { start: 18.55, end: 20.55, rpm: [3363, 3155, 2844, 2581, 2450, 2364, 2243, 2185, 2226, 2272, 2241, 2168, 2132, 2132, 2132, 2168, 2252, 2466, 2763, 3013] },
  { start: 20.6, end: 22.6, rpm: [3394, 3771, 4148, 4264, 3981, 3565, 3149, 2815, 2521, 2188, 2037, 1980, 1980, 2018, 2055, 2055, 2018, 1999, 1999, 1884] },
];

const SUPERBIKE_HI_REGIONS: RecordedRegion[] = [
  { start: 0.08, end: 0.88, rpm: [9417, 9378, 9329, 9225, 9198, 9118, 8997, 8933] },
  { start: 0.96, end: 3.66, rpm: [8961, 9025, 9073, 9091, 9127, 9178, 9218, 9220, 9277, 9348, 9377, 9459, 9492, 9487, 9493, 9537, 9617, 9661, 9640, 9688, 9741, 9742, 9711, 9753, 9836, 9880, 9846] },
  { start: 3.74, end: 4.64, rpm: [9170, 9278, 9356, 9208, 9378, 9693, 9672, 9846, 9783] },
  { start: 4.72, end: 7.72, rpm: [9132, 9206, 9277, 9328, 9418, 9522, 9629, 9652, 9731, 9879, 9981, 10110, 10248, 10442, 10564, 10724, 10948, 11165, 11217, 11357, 11598, 11724, 11880, 12047, 12131, 12277, 12447, 12597, 12676, 12458] },
  { start: 7.8, end: 11.6, rpm: [10287, 10315, 10341, 10399, 10497, 10527, 10476, 10544, 10743, 10760, 10733, 10898, 10722, 11040, 11213, 11130, 11178, 11108, 11320, 11301, 11250, 11281, 11231, 11213, 11236, 11323, 11336, 11340, 11403, 11318, 11353, 11363, 11411, 11251, 11544, 11539, 11562, 11260] },
  { start: 11.68, end: 12.68, rpm: [11716, 11811, 11657, 11502, 11417, 11502, 11432, 11443, 11413, 11225] },
];

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
  // +4 dB more weight under ~120 Hz than before (2 -> 6 dB); peak protect keeps headroom.
  lowShelfDb: 6,
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
        url: "/sample-packs/recorded/v4/superbike_street_regions.m4a",
        regions: SUPERBIKE_STREET_REGIONS,
        weight: 1,
        minRate: 0.78,
        maxRate: 2.0,
        // Street material carries idle to mid revs, then hands over to the high band.
        rpmWindow: { outFull: 6200, outTo: 8600 },
      },
      {
        id: "superbike-hi",
        url: `${BASE}/superbike_hi_regions.m4a`,
        regions: SUPERBIKE_HI_REGIONS,
        weight: 1,
        minRate: 0.66,
        maxRate: 1.3,
        rpmWindow: { inFrom: 5600, inFull: 8000 },
      },
    ],
    level: 0.42,
    // Recordings now carry the whole rev range (street pulls low, trackside scream high);
    // the synth keeps the low-end body, quickshift ladder, blips and overrun crackle.
    handover: {
      rpmStart: 5200,
      rpmSpan: 2800,
      accelKeep: 0.6,
      rpmKeep: 0.6,
      topRpm: 15500,
      topSpan: 1000,
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
        load: "idle",
      },
      {
        id: "big-twin-cruise",
        url: `${BIG_TWIN_RIDE_BASE}/bt_cruise_regions.m4a`,
        regions: BIG_TWIN_CRUISE_REGIONS,
        weight: 1,
        minRate: 0.5,
        maxRate: 1.9,
        load: "cruise",
      },
      {
        id: "big-twin-growl",
        url: `${BIG_TWIN_RIDE_BASE}/bt_growl_regions.m4a`,
        regions: BIG_TWIN_GROWL_REGIONS,
        weight: 1.35,
        minRate: 0.5,
        maxRate: 1.8,
        load: "growl",
      },
      {
        id: "big-twin-hard",
        url: `${BIG_TWIN_RIDE_BASE}/bt_accel_regions.m4a`,
        regions: BIG_TWIN_ACCEL_REGIONS,
        weight: 1.4,
        minRate: 0.5,
        maxRate: 1.7,
        load: "hard",
      },
      {
        id: "big-twin-overrun",
        url: `${BIG_TWIN_RIDE_BASE}/bt_decel_regions.m4a`,
        regions: BIG_TWIN_DECEL_REGIONS,
        weight: 1,
        minRate: 0.5,
        maxRate: 1.9,
        load: "overrun",
      },
    ],
    level: 0.55,
    // Recordings now carry the whole ride (idle, cruise, growl, hard pulls, engine braking);
    // the synth keeps the low-end body, shift events and gear logic underneath.
    handover: {
      rpmStart: 3800,
      rpmSpan: 1200,
      accelKeep: 0.7,
      rpmKeep: 0.65,
      topRpm: 6000,
      topSpan: 600,
    },
    eq: BIG_TWIN_EQ,
  },
  "f1-v10": {
    personalityId: "f1-v10",
    sources: [
      {
        id: "f1-passby",
        url: `${BASE}/f1_passby_regions.m4a`,
        regions: F1_PASSBY_REGIONS,
        weight: 1,
        minRate: 0.7,
        maxRate: 1.3,
      },
    ],
    level: F1_LEVEL,
    // Screaming texture only on the way up: none below ~9k, full share from ~14k.
    handover: {
      rpmStart: 0,
      rpmSpan: 1,
      accelKeep: 1,
      band: { fromRpm: 9000, fullRpm: 14000, level: 0.45 },
    },
    eq: {
      lowShelfDb: 0,
      midDb: 0,
      midHz: 800,
      highShelfDb: -2,
      highShelfHz: 4000,
      lowpassHz: 11000,
    },
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
  if (handover.band) {
    const b = handover.band;
    const ramp = smoothstep((rpm - b.fromRpm) / Math.max(1, b.fullRpm - b.fromRpm));
    return b.level * ramp * (0.4 + 0.6 * Math.min(1, Math.max(0, demand) / 0.6));
  }
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
    title: "Big V-twin riding recording (Freesound #502690)",
    author: "demodave",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/502690/",
    usedIn: "Big Twin (rev growl)",
    attribution:
      "Big V-twin recording by demodave (Freesound #502690), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Big V-twin riding recording (Freesound #81068)",
    author: "allencote",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/81068/",
    usedIn: "Big Twin (rev growl)",
    attribution:
      "Big V-twin recording by allencote (Freesound #81068), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Big V-twin riding recording (Freesound #869327)",
    author: "valeriocn",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/869327/",
    usedIn: "Big Twin (hard acceleration)",
    attribution:
      "Big V-twin recording by valeriocn (Freesound #869327), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Big V-twin riding recording (Freesound #657763)",
    author: "Tom_Kaszuba",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/657763/",
    usedIn: "Big Twin (hard acceleration)",
    attribution:
      "Big V-twin recording by Tom_Kaszuba (Freesound #657763), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Big V-twin riding recording (Freesound #743981)",
    author: "BranCorvus",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/743981/",
    usedIn: "Big Twin (gear changes, engine braking, steady cruise)",
    attribution:
      "Big V-twin recording by BranCorvus (Freesound #743981), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Big V-twin riding recording (Freesound #35537)",
    author: "johnmcd",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/35537/",
    usedIn: "Big Twin (engine braking)",
    attribution:
      "Big V-twin recording by johnmcd (Freesound #35537), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Superbike V4 idle and revs (Freesound #584115)",
    author: "rsn267",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/584115/",
    usedIn: "Superbike (idle and revs)",
    attribution: "Superbike V4 recording by rsn267 (Freesound #584115), CC0 1.0, edited (trimmed, filtered, granular).",
  },
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
    title: "Sportsbike Flyby (Freesound #361403)",
    author: "richwise",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/361403/",
    usedIn: "Superbike (high revs, ~9,000-12,700 rpm)",
    attribution:
      "\u201CSportsbike Flyby\u201D by richwise (Freesound #361403), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "sports motorcycle passing by at speed (Freesound #813521)",
    author: "danroka",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/813521/",
    usedIn: "Superbike (high revs, ~9,200-11,800 rpm)",
    attribution:
      "\u201Csports motorcycle passing by at speed\u201D by danroka (Freesound #813521), CC0 1.0, edited (trimmed, filtered, re-sequenced, granular).",
  },
  {
    title: "Big V-twin starting and idling (Freesound #850565)",
    author: "Mariayolanda511",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/850565/",
    usedIn: "Big Twin (idle)",
    attribution:
      "Big V-twin idle recording by Mariayolanda511 (Freesound #850565), CC0 1.0, edited (trimmed, filtered, granular).",
  },
  {
    title: "F1practice3MelbGP2012DR066 (Freesound #150337)",
    author: "Ears68",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/150337/",
    usedIn: "F1 (high-rpm pass-by texture)",
    attribution:
      "F1practice3MelbGP2012DR066 by Ears68 (Freesound #150337), CC0 1.0, edited (short pass-by clips, filtered, granular).",
  },
];
