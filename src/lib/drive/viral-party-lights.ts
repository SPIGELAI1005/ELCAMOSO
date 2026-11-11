/**
 * Viral Epic Party light show: beat-synced colour wash on the Drive page.
 * Palette is hot pink, violet, electric cyan and gold. Never white, no hard
 * strobe — soft cosine fades only. A header ON/OFF toggle (default ON)
 * runs the show at 60% peak. Off under reduced motion.
 *
 * Screen-edge glows stay as a soft colour wash. The per-section light show
 * also plays through the background stage fixtures, clipped above the car
 * and crowd so nothing lights up on the vehicle itself.
 */
import { VIRAL_MIX_PACK } from "@/lib/symphony/packs/viral-mix";
import {
  clearViralEdmTransport,
  publishViralEdmTransport,
  readViralEdmTransport,
  VIRAL_EDM_LIGHTS_PACK_ID,
  type ViralEdmReadPhase,
  type ViralEdmTransport,
} from "@/lib/symphony/viral-edm-read";

export const VIRAL_PARTY_LIGHT_PROFILE_ID = VIRAL_EDM_LIGHTS_PACK_ID;
export const VIRAL_PARTY_BPM = 120;
export const VIRAL_PARTY_BEATS_PER_BAR = 4;
export const VIRAL_PARTY_BARS_PER_LOOP = 4;
export const VIRAL_PARTY_CONFETTI_COUNT = 12;
export const VIRAL_PARTY_BUILD_BARS = 8;

/** Accordion hook gate (piano stem). */
export const VIRAL_PARTY_ROLL_KMH = VIRAL_MIX_PACK.speedGates!.piano!.inKmh;
/** ElCA / MOSO chant gate (cello stem). */
export const VIRAL_PARTY_CHANT_KMH = VIRAL_MIX_PACK.speedGates!.cello!.inKmh;

/** Stored as "on" / "off". Legacy "60" and "85" values still read as on. */
const STORAGE_KEY = "elcamoso.viral-party.lights";
/** Peak brightness while the Light Show toggle is on. */
export const VIRAL_PARTY_LIGHT_ON_PEAK = 0.6;

const lightOnListeners = new Set<() => void>();

export type ViralPartyColor = "pink" | "violet" | "cyan" | "gold";
export const VIRAL_PARTY_COLOR_NAMES: readonly ViralPartyColor[] = [
  "pink",
  "violet",
  "cyan",
  "gold",
];

/** CSS / SVG fills. Light tints are used as glow cores — never white. */
export const VIRAL_PARTY_COLORS = {
  pink: "#ff2dad",
  pinkSoft: "#ff6ec8",
  violet: "#8a2cff",
  violetSoft: "#b57aff",
  cyan: "#00d9ff",
  cyanSoft: "#6ef0ff",
  gold: "#ffc400",
  goldSoft: "#ffe27a",
} as const;

export const VIRAL_PARTY_HERO_SIZE = { w: 1672, h: 941 } as const;

/**
 * Clip stage beams and background confetti above this image Y so they stay
 * over the truss / crowd haze and never cover the car body.
 */
export const VIRAL_PARTY_BEAM_CLIP_Y = 400;

/** Stage fixtures whose beams we pulse. Coordinates are lamp centres in image pixels. */
export const VIRAL_PARTY_SPOTS = [
  { cx: 154, cy: 72, rx: 22, ry: 14, beam: 260 },
  { cx: 269, cy: 84, rx: 24, ry: 14, beam: 280 },
  { cx: 391, cy: 111, rx: 20, ry: 12, beam: 240 },
  { cx: 715, cy: 128, rx: 22, ry: 14, beam: 250 },
  { cx: 930, cy: 104, rx: 22, ry: 14, beam: 260 },
  { cx: 1051, cy: 87, rx: 24, ry: 14, beam: 270 },
  { cx: 1163, cy: 80, rx: 22, ry: 13, beam: 260 },
  { cx: 1307, cy: 52, rx: 24, ry: 14, beam: 280 },
  { cx: 1424, cy: 51, rx: 22, ry: 14, beam: 260 },
  { cx: 1546, cy: 18, rx: 22, ry: 14, beam: 240 },
] as const;

const IMAGE_MID_X = VIRAL_PARTY_HERO_SIZE.w / 2;
export const VIRAL_PARTY_LEFT_SPOTS = VIRAL_PARTY_SPOTS.filter((s) => s.cx < IMAGE_MID_X);
export const VIRAL_PARTY_RIGHT_SPOTS = VIRAL_PARTY_SPOTS.filter((s) => s.cx >= IMAGE_MID_X);

export type ViralPartySection = "idle" | "roll" | "chant" | "build" | "drop" | "melodic";

export type ColorMix = Record<ViralPartyColor, number>;

export interface ViralPartyLightFrame {
  edges: { left: ColorMix; right: ColorMix; top: ColorMix; bottom: ColorMix };
  beams: { left: ColorMix; right: ColorMix };
  climb: number;
  climbOpacity: number;
  confetti: boolean;
}

export const EMPTY_COLOR_MIX: ColorMix = { pink: 0, violet: 0, cyan: 0, gold: 0 };

export function emptyColorMix(): ColorMix {
  return { pink: 0, violet: 0, cyan: 0, gold: 0 };
}

export function viralPartyLightPeak(on: boolean): number {
  return on ? VIRAL_PARTY_LIGHT_ON_PEAK : 0;
}

/** True unless the user has stored "off". Missing / legacy "60" / "85" count as on. */
export function isViralPartyLightOn(
  storage: Storage | undefined = globalThis.localStorage,
): boolean {
  try {
    const v = storage?.getItem(STORAGE_KEY);
    return v !== "off";
  } catch {
    return true;
  }
}

export function setViralPartyLightOn(
  on: boolean,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
  setViralPartyLivePeak(viralPartyLightPeak(on));
  for (const listener of lightOnListeners) listener();
}

/** Subscribe to Light Show on/off changes (used by the header toggle and the show). */
export function subscribeViralPartyLightOn(listener: () => void): () => void {
  lightOnListeners.add(listener);
  return () => {
    lightOnListeners.delete(listener);
  };
}

export function resolveViralPartySection(phase: ViralEdmReadPhase, kmh: number): ViralPartySection {
  if (phase === "build") return "build";
  if (phase === "drop") return "drop";
  if (phase === "melodic") return "melodic";
  const speed = Number.isFinite(kmh) ? kmh : 0;
  if (speed >= VIRAL_PARTY_CHANT_KMH) return "chant";
  if (speed >= VIRAL_PARTY_ROLL_KMH) return "roll";
  return "idle";
}

/**
 * Soft 0..1 cosine. When peakAtZero is true, the value is 1 on integer phase
 * and 0 at the half-cycle — a smooth pulse, never a hard edge.
 */
export function cosineFade(phase: number, peakAtZero = false): number {
  const p = phase - Math.floor(phase);
  const t = peakAtZero ? p : p - 0.5;
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * t);
}

/** Raised-cosine window: 0 at the ends, 1 at the midpoint, 0 outside [0, duration]. */
export function cosineWindow(t: number, duration: number): number {
  if (duration <= 0 || t <= 0 || t >= duration) return 0;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / duration);
}

/** ElCA on bars 1 and 3 (0-indexed 0, 2); MOSO on bars 2 and 4. See VOICES.txt. */
export function chantCallOnBar(barInLoop: number): "elca" | "moso" {
  const bar =
    ((Math.floor(barInLoop) % VIRAL_PARTY_BARS_PER_LOOP) + VIRAL_PARTY_BARS_PER_LOOP) %
    VIRAL_PARTY_BARS_PER_LOOP;
  return bar % 2 === 0 ? "elca" : "moso";
}

function scaleMix(mix: ColorMix, peak: number): ColorMix {
  const p = Math.min(0.85, Math.max(0, peak));
  return {
    pink: mix.pink * p,
    violet: mix.violet * p,
    cyan: mix.cyan * p,
    gold: mix.gold * p,
  };
}

function add(mix: ColorMix, color: ViralPartyColor, amount: number): void {
  mix[color] = Math.min(1, mix[color] + Math.max(0, amount));
}

function cycleColor(t: number): ViralPartyColor {
  const i = Math.floor((((t % 1) + 1) % 1) * VIRAL_PARTY_COLOR_NAMES.length);
  return VIRAL_PARTY_COLOR_NAMES[i] ?? "pink";
}

export interface ViralPartyLightParams {
  section: ViralPartySection;
  peak: number;
  absoluteBeat: number;
  beatPhase: number;
  barInLoop: number;
  barPhase: number;
  barsIntoPhase: number;
  buildProgress: number;
  lastBarOfBuild: boolean;
}

export function viralPartyLightFrame(params: ViralPartyLightParams): ViralPartyLightFrame {
  const peak = Math.min(0.85, Math.max(0, params.peak));
  const left = emptyColorMix();
  const right = emptyColorMix();
  const top = emptyColorMix();
  const bottom = emptyColorMix();
  const leftBeams = emptyColorMix();
  const rightBeams = emptyColorMix();
  let climb = 0;
  let climbOpacity = 0;
  let confetti = false;

  if (peak <= 0) {
    return {
      edges: { left, right, top, bottom },
      beams: { left: leftBeams, right: rightBeams },
      climb,
      climbOpacity,
      confetti,
    };
  }

  switch (params.section) {
    case "idle": {
      // One breath every two bars (8 beats) — slow violet wash on all edges.
      const breath = 0.35 + 0.65 * cosineFade(params.absoluteBeat / 8, true);
      add(left, "violet", breath);
      add(right, "violet", breath);
      add(top, "violet", breath * 0.7);
      add(bottom, "violet", breath * 0.85);
      add(leftBeams, "violet", breath);
      add(rightBeams, "violet", breath);
      break;
    }
    case "roll": {
      // Pink and violet swap left/right over a two-beat cosine.
      const swap = cosineFade(params.absoluteBeat / 2, true);
      add(left, "pink", swap);
      add(left, "violet", 1 - swap);
      add(right, "violet", swap);
      add(right, "pink", 1 - swap);
      add(leftBeams, "pink", swap);
      add(leftBeams, "violet", 1 - swap);
      add(rightBeams, "violet", swap);
      add(rightBeams, "pink", 1 - swap);
      break;
    }
    case "chant": {
      // Soft flash covering the first two beats of the bar (the sung word).
      const beatsIntoBar = params.barPhase * VIRAL_PARTY_BEATS_PER_BAR;
      const flash = cosineWindow(beatsIntoBar, 2);
      if (chantCallOnBar(params.barInLoop) === "elca") {
        add(left, "pink", flash);
        add(leftBeams, "pink", flash);
      } else {
        add(right, "gold", flash);
        add(rightBeams, "gold", flash);
      }
      break;
    }
    case "build": {
      const lastBeatOfBuild = params.lastBarOfBuild && params.barPhase >= 0.75;
      if (lastBeatOfBuild) {
        climb = 1;
        climbOpacity = 0;
        break;
      }
      if (params.lastBarOfBuild) {
        // Near-dark last bar, a faint residual that dies into the gap.
        const residual = 0.08 * (1 - params.barPhase);
        add(bottom, "violet", residual);
        add(leftBeams, "violet", residual);
        add(rightBeams, "violet", residual);
        climb = 1;
        climbOpacity = residual;
        break;
      }
      const bars = Math.max(0, params.barsIntoPhase);
      let subdiv = 1;
      if (bars >= 6) subdiv = 8;
      else if (bars >= 4) subdiv = 4;
      else if (bars >= 2) subdiv = 2;
      // Raised floor so fast rolls shimmer rather than strobe.
      const pulse = 0.28 + 0.72 * cosineFade(bars * 4 * subdiv, true);
      const bright = pulse * (0.45 + 0.55 * Math.min(1, params.buildProgress));
      climb = Math.min(1, Math.max(0, params.buildProgress));
      climbOpacity = bright;
      const color = cycleColor(params.buildProgress * 2 + params.absoluteBeat / 16);
      add(bottom, color, bright * (1 - climb * 0.65));
      add(top, color, bright * climb);
      add(left, color, bright * 0.7);
      add(right, color, bright * 0.7);
      add(leftBeams, color, bright);
      add(rightBeams, color, bright);
      break;
    }
    case "drop": {
      confetti = true;
      // All four edges, colours cycling once per beat with a soft crossfade.
      const cycle = (params.absoluteBeat / 2) % 1;
      const a = cycleColor(cycle);
      const b = cycleColor(cycle + 0.25);
      const fade = cosineFade(params.absoluteBeat, true);
      const burst = 0.55 + 0.45 * fade;
      add(left, a, burst);
      add(right, b, burst);
      add(top, b, burst * 0.9);
      add(bottom, a, burst * 0.9);
      // Crossfade the neighbour colour in so the swap is never a hard cut.
      add(left, b, burst * (1 - fade) * 0.5);
      add(right, a, burst * (1 - fade) * 0.5);
      add(leftBeams, a, burst);
      add(leftBeams, b, burst * (1 - fade) * 0.5);
      add(rightBeams, b, burst);
      add(rightBeams, a, burst * (1 - fade) * 0.5);
      break;
    }
    case "melodic": {
      // Slow, wide waves — one cycle every four bars, pink / cyan / gold phase-offset.
      const wave = params.absoluteBeat / 16;
      const pink = 0.25 + 0.75 * cosineFade(wave, true);
      const cyan = 0.25 + 0.75 * cosineFade(wave + 1 / 3, true);
      const gold = 0.25 + 0.75 * cosineFade(wave + 2 / 3, true);
      add(left, "pink", pink);
      add(right, "cyan", cyan);
      add(top, "gold", gold * 0.85);
      add(bottom, "pink", pink * 0.5);
      add(bottom, "gold", gold * 0.5);
      add(top, "cyan", cyan * 0.35);
      add(right, "gold", gold * 0.3);
      add(left, "cyan", cyan * 0.3);
      add(leftBeams, "pink", pink);
      add(leftBeams, "cyan", cyan * 0.45);
      add(leftBeams, "gold", gold * 0.25);
      add(rightBeams, "cyan", cyan);
      add(rightBeams, "gold", gold * 0.7);
      add(rightBeams, "pink", pink * 0.25);
      break;
    }
  }

  const edges = {
    left: scaleMix(left, peak),
    right: scaleMix(right, peak),
    top: scaleMix(top, peak),
    bottom: scaleMix(bottom, peak),
  };
  const beams = {
    left: scaleMix(leftBeams, peak),
    right: scaleMix(rightBeams, peak),
  };
  return {
    edges,
    beams,
    climb,
    climbOpacity: climbOpacity * peak,
    confetti,
  };
}

export interface ViralPartyClock {
  section: ViralPartySection;
  absoluteBeat: number;
  beatPhase: number;
  barInLoop: number;
  barPhase: number;
  barsIntoPhase: number;
  buildProgress: number;
  lastBarOfBuild: boolean;
  kmh: number;
  bpm: number;
  fromEngine: boolean;
}

function clockFromElapsed(
  elapsed: number,
  bpm: number,
  beatsPerBar: number,
  barsPerLoop: number,
): Pick<ViralPartyClock, "absoluteBeat" | "beatPhase" | "barInLoop" | "barPhase"> {
  const beatDur = 60 / Math.max(bpm, 1);
  const absoluteBeat = Math.max(0, elapsed) / beatDur;
  const beatInBar = ((absoluteBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  const bar = Math.floor(elapsed / (beatDur * beatsPerBar));
  const barInLoop = ((bar % barsPerLoop) + barsPerLoop) % barsPerLoop;
  return {
    absoluteBeat,
    beatPhase: beatInBar - Math.floor(beatInBar),
    barInLoop,
    barPhase: beatInBar / beatsPerBar,
  };
}

/** 120 BPM wall-clock when the engine has not published a transport yet. */
export function fallbackViralPartyClock(nowMs: number, kmh: number): ViralPartyClock {
  const parts = clockFromElapsed(
    Math.max(0, nowMs) / 1000,
    VIRAL_PARTY_BPM,
    VIRAL_PARTY_BEATS_PER_BAR,
    VIRAL_PARTY_BARS_PER_LOOP,
  );
  return {
    ...parts,
    section: resolveViralPartySection("bed", kmh),
    barsIntoPhase: 0,
    buildProgress: 0,
    lastBarOfBuild: false,
    kmh,
    bpm: VIRAL_PARTY_BPM,
    fromEngine: false,
  };
}

export function viralPartyClockAt(nowMs: number, kmh: number): ViralPartyClock {
  const snap: Readonly<ViralEdmTransport> = readViralEdmTransport();
  if (!snap.ready || snap.packId !== VIRAL_PARTY_LIGHT_PROFILE_ID) {
    return fallbackViralPartyClock(nowMs, kmh);
  }
  const dt = snap.perfNow > 0 ? Math.max(0, Math.min(0.25, (nowMs - snap.perfNow) / 1000)) : 0;
  const audioNow = snap.audioTime + dt;
  const bpm = snap.bpm > 0 ? snap.bpm : VIRAL_PARTY_BPM;
  const beatsPerBar = snap.beatsPerBar > 0 ? snap.beatsPerBar : VIRAL_PARTY_BEATS_PER_BAR;
  const barsPerLoop = snap.barsPerLoop > 0 ? snap.barsPerLoop : VIRAL_PARTY_BARS_PER_LOOP;
  const barDur = snap.barDuration > 0 ? snap.barDuration : (60 / bpm) * beatsPerBar;
  const parts = clockFromElapsed(
    Math.max(0, audioNow - snap.origin),
    bpm,
    beatsPerBar,
    barsPerLoop,
  );
  const barsIntoPhase = snap.phase === "bed" ? 0 : snap.barsIntoPhase + dt / barDur;
  const buildProgress =
    snap.phase === "build"
      ? Math.min(1, Math.max(0, barsIntoPhase / VIRAL_PARTY_BUILD_BARS))
      : snap.buildProgress;
  const lastBarOfBuild = snap.phase === "build" && barsIntoPhase >= VIRAL_PARTY_BUILD_BARS - 1;
  const speed = Number.isFinite(snap.kmh) ? snap.kmh : kmh;
  return {
    ...parts,
    section: resolveViralPartySection(snap.phase, speed),
    barsIntoPhase,
    buildProgress,
    lastBarOfBuild,
    kmh: speed,
    bpm,
    fromEngine: true,
  };
}

/** Live peak written by the toggle so stage beams stay in lockstep without a React render. */
let livePeak = 0.6;
export function setViralPartyLivePeak(peak: number): void {
  livePeak = Math.min(0.85, Math.max(0, peak));
}
export function getViralPartyLivePeak(): number {
  return livePeak;
}

const frameCache = {
  now: -1,
  peak: -2,
  kmh: -1,
  frame: viralPartyLightFrame({
    section: "idle",
    peak: 0,
    absoluteBeat: 0,
    beatPhase: 0,
    barInLoop: 0,
    barPhase: 0,
    barsIntoPhase: 0,
    buildProgress: 0,
    lastBarOfBuild: false,
  }),
};

/** Idempotent per animation-frame timestamp so edge and stage-beam overlays stay in phase. */
export function viralPartyFrameAt(nowMs: number, peak: number, kmh: number): ViralPartyLightFrame {
  if (frameCache.now === nowMs && frameCache.peak === peak && frameCache.kmh === kmh) {
    return frameCache.frame;
  }
  const clock = viralPartyClockAt(nowMs, kmh);
  const frame = viralPartyLightFrame({ ...clock, peak });
  frameCache.now = nowMs;
  frameCache.peak = peak;
  frameCache.kmh = kmh;
  frameCache.frame = frame;
  return frame;
}

export { clearViralEdmTransport, publishViralEdmTransport, readViralEdmTransport };
