/**
 * Recorded engine loops (free-licence, same-origin) for the hybrid sample layer.
 * Real recordings carry idle + cruise; the procedural synth takes over above
 * ~2,200 rpm and at high load. Shifts, pops and gear logic stay procedural.
 * Licences: see RECORDED_LOOP_CREDITS and /credits.
 */

export const RECORDED_LOOPS_VERSION = "v1";
const BASE = `/sample-packs/recorded/${RECORDED_LOOPS_VERSION}`;

export interface RecordedLoop {
  id: string;
  url: string;
  rpmRef: number;
  /** "idle" loops cover low rpm; "cruise" loops the 1.3k-2.2k band. */
  band: "idle" | "cruise";
  loopStart: number;
  loopEnd: number;
  /** Mix weight inside its band. */
  weight: number;
}

const MAS_IDLE: Omit<RecordedLoop, "weight"> = {
  id: "maserati_idle_830",
  url: `${BASE}/maserati_idle_830.m4a`,
  rpmRef: 830,
  band: "idle",
  loopStart: 0.25,
  loopEnd: 7.1,
};
const MAS_HOLD: Omit<RecordedLoop, "weight"> = {
  id: "maserati_hold_1770",
  url: `${BASE}/maserati_hold_1770.m4a`,
  rpmRef: 1770,
  band: "cruise",
  loopStart: 0.25,
  loopEnd: 2.35,
};
const ROVER_IDLE: Omit<RecordedLoop, "weight"> = {
  id: "rover_idle_840",
  url: `${BASE}/rover_idle_840.m4a`,
  rpmRef: 840,
  band: "idle",
  loopStart: 0.25,
  loopEnd: 1.95,
};

export interface RecordedLoopBank {
  personalityId: string;
  loops: RecordedLoop[];
  /** Overall sample-layer level at full sample weight. */
  level: number;
}

export const RECORDED_LOOP_BANKS: Record<string, RecordedLoopBank> = {
  "american-v8": {
    personalityId: "american-v8",
    loops: [
      { ...ROVER_IDLE, weight: 0.6 },
      { ...MAS_IDLE, weight: 0.8 },
      { ...MAS_HOLD, weight: 0.45 },
    ],
    level: 0.85,
  },
  "gt-v8": {
    personalityId: "gt-v8",
    loops: [
      { ...MAS_IDLE, weight: 1 },
      { ...MAS_HOLD, weight: 0.8 },
    ],
    level: 0.46,
  },
};

export function getRecordedLoopBank(personalityId: string): RecordedLoopBank | null {
  return RECORDED_LOOP_BANKS[personalityId] ?? null;
}

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * Hand-over curve: 1 = recordings carry the sound, 0 = procedural synth only.
 * Recordings own idle/cruise; fade out 1,800 → 2,300 rpm and as demand rises
 * past ~0.55 (GPS-estimated load), so pulls stay on the synth.
 */
export function recordedSampleWeight(rpm: number, demand: number): number {
  const byRpm = 1 - smooth((rpm - 1800) / 500);
  const byLoad = 1 - smooth((demand - 0.45) / 0.3);
  return Math.max(0, Math.min(1, byRpm * byLoad));
}

/** Idle ↔ cruise band blend (0 = idle loops, 1 = cruise loop). */
export function recordedCruiseBlend(rpm: number): number {
  return smooth((rpm - 950) / 650);
}

/** Pitch range kept natural: never below 0.8x or above 1.4x of the recording. */
export function recordedPlaybackRate(loop: RecordedLoop, rpm: number): number {
  return Math.min(1.4, Math.max(0.8, rpm / loop.rpmRef));
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
    usedIn: "American Muscle V8, GT V8 (idle and cruise loops)",
    attribution:
      "\u201CMaserati GranTurismo S Exhaust\u201D by lmartins, CC BY 4.0 (creativecommons.org/licenses/by/4.0), edited (trimmed, filtered, looped).",
  },
  {
    title: "Rover-v8-rr79 (3.5 L Rover V8, 1979 Range Rover)",
    author: "Collard (English Wikipedia)",
    licence: "Public domain",
    licenceUrl: "https://commons.wikimedia.org/wiki/File:Rover-v8-rr79.ogg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rover-v8-rr79.ogg",
    usedIn: "American Muscle V8 (idle loop)",
    attribution: "\u201CRover-v8-rr79\u201D by Collard, public domain.",
  },
];
