/**
 * Recorded engine material (free-licence, same-origin) for the hybrid sample layer.
 * Round 2: granular, de-looped playback from longer steady regions of the source
 * recordings (random grain offsets, two decorrelated streams, pitch/level jitter),
 * per-region RPM tracks so each grain is pitched from its own measured RPM, and an
 * acceleration-driven load character (cruise / on-load / aggressive / overrun).
 * Shifts, pops and gear logic stay procedural. Licences: RECORDED_LOOP_CREDITS and /credits.
 */

export const RECORDED_LOOPS_VERSION = "v2";
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

export interface RecordedLoopBank {
  personalityId: string;
  sources: RecordedSource[];
  /** Overall sample-layer level at full sample weight. */
  level: number;
  /** Match-EQ on the recorded layer toward the synth timbre (dB). */
  eq: {
    lowShelfDb: number;
    midDb: number;
    midHz: number;
    highShelfDb: number;
    highShelfHz: number;
    lowpassHz: number;
  };
}

const maserati = (weight: number): RecordedSource => ({
  id: "maserati",
  url: `${BASE}/maserati_v8_regions.m4a`,
  regions: MASERATI_REGIONS,
  weight,
});
const rover = (weight: number): RecordedSource => ({
  id: "rover",
  url: `${BASE}/rover_v8_regions.m4a`,
  regions: ROVER_REGIONS,
  weight,
});

export const RECORDED_LOOP_BANKS: Record<string, RecordedLoopBank> = {
  "american-v8": {
    personalityId: "american-v8",
    sources: [maserati(1), rover(0.55)],
    level: 0.36,
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
    eq: {
      lowShelfDb: 12,
      midDb: -2,
      midHz: 450,
      highShelfDb: 6,
      highShelfHz: 2200,
      lowpassHz: 7000,
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
export function recordedSampleWeight(rpm: number, demand: number, aggression = 0): number {
  const byRpm = 1 - smoothstep((rpm - 2400) / 900);
  const byDemand = 1 - smoothstep((demand - 0.6) / 0.3);
  const byAccel = 1 - 0.85 * smoothstep(aggression);
  return Math.max(0, Math.min(1, byRpm * byDemand * byAccel));
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
): RecordedRegion | null {
  const cands = regions
    .map((r) => {
      const mean = regionMeanRpm(r);
      const rate = rpm / mean;
      if (rate < MIN_GRAIN_RATE || rate > MAX_GRAIN_RATE || r.end - r.start < 0.6) return null;
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
];
