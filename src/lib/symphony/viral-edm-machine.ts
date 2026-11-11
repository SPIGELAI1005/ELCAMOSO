import type { MovementState, StemGainTargets, StemId } from "./types";

export type EdmPhase = "bed" | "build" | "drop" | "melodic";

export interface EdmConfig {
  bpm: number;
  buildBars: number;
  dropBars: number;
  melodicBars: number;
  phraseBars: number;
  triggerEnterKmh: number;
  triggerBandTopKmh: number;
  triggerThrottle: number;
  triggerThrottleHoldSec: number;
  stayKmh: number;
  exitKmh: number;
  cooldownSec: number;
}

export const VIRAL_EDM_CONFIG: EdmConfig = {
  bpm: 120,
  buildBars: 8,
  dropBars: 8,
  melodicBars: 16,
  phraseBars: 8,
  triggerEnterKmh: 100,
  triggerBandTopKmh: 130,
  triggerThrottle: 0.72,
  triggerThrottleHoldSec: 1.2,
  stayKmh: 110,
  exitKmh: 88,
  cooldownSec: 16,
};

export interface EdmDriveInput {
  kmh: number;
  throttle: number;
  movement: MovementState;
  audioTime: number;
  clockOrigin: number;
  barDuration: number;
}

export interface EdmSnapshot {
  phase: EdmPhase;
  scheduledPhase: EdmPhase | null;
  scheduledAt: number | null;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  barsIntoPhase: number;
  buildProgress: number;
  lastBarOfBuild: boolean;
  filterHz: number;
  makeup: number;
  stemScale: StemGainTargets;
  sidechainDepth: number;
  kitGate: number;
  dropGain: number;
  melodicGain: number;
  acousticPianoGain: number;
  choirGain: number;
}

const OPEN_HP = 30;
const BUILD_HP_START = 90;
const BUILD_HP_END = 2600;

export function nextPhraseTime(
  audioTime: number,
  origin: number,
  barDuration: number,
  phraseBars: number,
): number {
  const step = barDuration * phraseBars;
  const elapsed = Math.max(0, audioTime - origin);
  const next = Math.ceil((elapsed + 1e-4) / step) * step;
  return origin + next;
}

export function phraseStartIfEarly(
  audioTime: number,
  origin: number,
  barDuration: number,
  phraseBars: number,
): number {
  const elapsed = Math.max(0, audioTime - origin);
  if (elapsed < barDuration * 0.55) return origin;
  return nextPhraseTime(audioTime, origin, barDuration, phraseBars);
}

function scale(
  drumsLow: number,
  kit: number,
  bass: number,
  drumsHigh: number,
  rhythm: number,
  lead: number,
  brass: number,
  strings: number,
  piano: number,
  cello: number,
  fx: number,
  atmosphere = 1,
): StemGainTargets {
  return {
    drumsLow,
    kit,
    bass,
    drumsHigh,
    rhythm,
    lead,
    brass,
    strings,
    piano,
    cello,
    fx,
    atmosphere,
  };
}

function stemScaleFor(phase: EdmPhase, buildProgress: number, lastBar: boolean): StemGainTargets {
  if (phase === "build") {
    const last = lastBar ? 1 : 0;
    return scale(
      last ? 0.06 : 0.85,
      last ? 0.05 : 0.95,
      last ? 0.12 : 0.8,
      0.7,
      0.7,
      0.55,
      0.6,
      0.7,
      0.7,
      0.5,
      0.4,
    );
  }
  if (phase === "drop") {
    return scale(0.22, 0.12, 0.18, 0.3, 0.32, 0.18, 0.32, 0.38, 0.5, 0.42, 0.18, 0.7);
  }
  if (phase === "melodic") {
    return scale(0.22, 0.14, 0.2, 0.28, 0.28, 0.22, 0.28, 0.38, 0.55, 0.5, 0.18, 0.62);
  }
  void buildProgress;
  return scale(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
}

function buildFilterHz(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const eased = p * p;
  return BUILD_HP_START * Math.pow(BUILD_HP_END / BUILD_HP_START, eased);
}

export function kitGainFromSpeed(kmh: number, movement: MovementState): number {
  if (movement === "peak") return 1;
  const lo = 55;
  const hi = 90;
  if (kmh <= lo) return 0;
  if (kmh >= hi) return movement === "decelerating" ? 0.35 : 1;
  const t = (kmh - lo) / (hi - lo);
  const s = t * t * (3 - 2 * t);
  return movement === "decelerating" ? s * 0.35 : s;
}

/** Soft acoustic-piano entry 30–50 km/h; featured after the drop and on the last build bar. */
export function acousticPianoGain(
  kmh: number,
  movement: MovementState,
  phase: EdmPhase,
  lastBarOfBuild: boolean,
): number {
  let gate = 0;
  if (kmh <= 30) gate = 0;
  else if (kmh >= 50) gate = 1;
  else {
    const u = (kmh - 30) / 20;
    gate = u * u * (3 - 2 * u);
  }
  if (movement === "decelerating" && phase === "bed") gate *= 0.45;
  let scale = 0.85;
  if (lastBarOfBuild) scale = 1.55;
  else if (phase === "melodic") scale = 1.45;
  else if (phase === "build") scale = 1.05;
  else if (phase === "drop") scale = 0.7;
  return gate * scale;
}

/**
 * Choir enters around highway (~88–120 km/h), swells through the build,
 * and hits full power on the drop and melodic section.
 */
export function choirGain(
  kmh: number,
  movement: MovementState,
  phase: EdmPhase,
  buildProgress: number,
  lastBarOfBuild: boolean,
): number {
  let gate = 0;
  if (kmh <= 88) gate = 0;
  else if (kmh >= 120) gate = 1;
  else {
    const u = (kmh - 88) / 32;
    gate = u * u * (3 - 2 * u);
  }
  if (movement === "decelerating" && phase === "bed") gate *= 0.3;
  if (phase === "drop") return gate * 2.45;
  if (phase === "melodic") return gate * 2.15;
  if (phase === "build") {
    if (lastBarOfBuild) return gate * 0.6;
    return gate * (1.3 + 1.1 * Math.min(1, Math.max(0, buildProgress)));
  }
  return gate * 1.2;
}

export function createEdmMachine(config: EdmConfig = VIRAL_EDM_CONFIG) {
  let phase: EdmPhase = "bed";
  let scheduledPhase: EdmPhase | null = null;
  let scheduledAt: number | null = null;
  let phaseStartedAt: number | null = null;
  let phaseEndsAt: number | null = null;
  let lastKmh = 0;
  let throttleHold = 0;
  let lastTime = 0;
  let cooldownUntil = 0;
  let seenAudio = false;

  function phaseLength(p: EdmPhase, barDuration: number): number {
    if (p === "build") return config.buildBars * barDuration;
    if (p === "drop") return config.dropBars * barDuration;
    if (p === "melodic") return config.melodicBars * barDuration;
    return 0;
  }

  function enter(next: EdmPhase, at: number, barDuration: number) {
    phase = next;
    phaseStartedAt = at;
    phaseEndsAt = next === "bed" ? null : at + phaseLength(next, barDuration);
    scheduledPhase = null;
    scheduledAt = null;
  }

  function schedule(next: EdmPhase, at: number) {
    scheduledPhase = next;
    scheduledAt = at;
  }

  function shouldTrigger(input: EdmDriveInput, dt: number): boolean {
    if (phase !== "bed" || scheduledPhase) return false;
    if (input.audioTime < cooldownUntil) return false;
    if (input.kmh < config.triggerEnterKmh) return false;
    const climbing = input.kmh > lastKmh + 0.35;
    const bandClimb =
      climbing && lastKmh < config.triggerBandTopKmh && input.kmh >= config.triggerEnterKmh;
    if (input.throttle >= config.triggerThrottle) throttleHold += dt;
    else throttleHold = 0;
    const throttleTrig =
      input.kmh >= config.triggerEnterKmh && throttleHold >= config.triggerThrottleHoldSec;
    return bandClimb || throttleTrig;
  }

  function shouldExit(input: EdmDriveInput): boolean {
    if (phase === "bed" && !scheduledPhase) return false;
    if (input.movement === "decelerating" && input.kmh < config.stayKmh) return true;
    if (input.kmh < config.exitKmh) return true;
    return false;
  }

  function snapshot(input: EdmDriveInput): EdmSnapshot {
    const started = phaseStartedAt ?? input.audioTime;
    const into = input.audioTime - started;
    const barsIntoPhase = phase === "bed" ? 0 : Math.max(0, into / input.barDuration);
    const buildProgress =
      phase === "build"
        ? Math.min(1, Math.max(0, into / (config.buildBars * input.barDuration)))
        : 0;
    const lastBarOfBuild = phase === "build" && barsIntoPhase >= config.buildBars - 1;
    const filterHz = phase === "build" ? buildFilterHz(buildProgress) : OPEN_HP;
    const makeup =
      phase === "drop" ? 1.22 : phase === "melodic" ? 1.18 : phase === "build" ? 1.12 : 1;
    const kitGate = kitGainFromSpeed(input.kmh, input.movement);
    return {
      phase,
      scheduledPhase,
      scheduledAt,
      phaseStartedAt,
      phaseEndsAt,
      barsIntoPhase,
      buildProgress,
      lastBarOfBuild,
      filterHz,
      makeup,
      stemScale: stemScaleFor(phase, buildProgress, lastBarOfBuild),
      sidechainDepth:
        phase === "drop" ? 0.62 : phase === "melodic" ? 0.48 : phase === "build" ? 0.2 : 0,
      kitGate,
      dropGain: phase === "drop" ? 0.6 : 0,
      melodicGain: phase === "melodic" ? 1 : 0,
      acousticPianoGain: acousticPianoGain(input.kmh, input.movement, phase, lastBarOfBuild),
      choirGain: choirGain(input.kmh, input.movement, phase, buildProgress, lastBarOfBuild),
    };
  }

  return {
    tick(input: EdmDriveInput): EdmSnapshot {
      const dt = lastTime > 0 ? Math.min(0.12, Math.max(0, input.audioTime - lastTime)) : 1 / 60;
      if (!seenAudio) {
        seenAudio = true;
        lastKmh = input.kmh;
        lastTime = input.audioTime;
        // Already in the trigger band at start (preview holds): begin on this phrase.
        if (input.kmh >= config.triggerEnterKmh) {
          throttleHold = config.triggerThrottleHoldSec;
          const at = phraseStartIfEarly(
            input.audioTime,
            input.clockOrigin,
            input.barDuration,
            config.phraseBars,
          );
          schedule("build", at);
        }
        return snapshot(input);
      }

      if (shouldExit(input)) {
        const at = input.audioTime;
        enter("bed", at, input.barDuration);
        cooldownUntil = at + config.cooldownSec;
        scheduledPhase = null;
        scheduledAt = null;
        lastKmh = input.kmh;
        lastTime = input.audioTime;
        return snapshot(input);
      }

      if (scheduledAt != null && scheduledPhase && input.audioTime >= scheduledAt - 1e-4) {
        enter(scheduledPhase, scheduledAt, input.barDuration);
      }

      if (phase !== "bed" && phaseEndsAt != null && input.audioTime >= phaseEndsAt - 1e-4) {
        if (phase === "build") enter("drop", phaseEndsAt, input.barDuration);
        else if (phase === "drop") enter("melodic", phaseEndsAt, input.barDuration);
        else if (phase === "melodic") {
          if (input.kmh >= config.stayKmh && input.movement !== "decelerating") {
            const at = nextPhraseTime(
              input.audioTime,
              input.clockOrigin,
              input.barDuration,
              config.phraseBars,
            );
            // If the phrase boundary is this instant, roll straight into a new build.
            if (at <= input.audioTime + 1e-3) enter("build", at, input.barDuration);
            else {
              phase = "melodic";
              schedule("build", at);
            }
          } else {
            enter("bed", input.audioTime, input.barDuration);
            cooldownUntil = input.audioTime + config.cooldownSec;
          }
        }
      }

      if (shouldTrigger(input, dt)) {
        const at = nextPhraseTime(
          input.audioTime,
          input.clockOrigin,
          input.barDuration,
          config.phraseBars,
        );
        schedule("build", at);
      }

      lastKmh = input.kmh;
      lastTime = input.audioTime;
      return snapshot(input);
    },
    snapshot(input: EdmDriveInput) {
      return snapshot(input);
    },
    reset() {
      phase = "bed";
      scheduledPhase = null;
      scheduledAt = null;
      phaseStartedAt = null;
      phaseEndsAt = null;
      lastKmh = 0;
      throttleHold = 0;
      lastTime = 0;
      cooldownUntil = 0;
      seenAudio = false;
    },
  };
}

export type EdmMachine = ReturnType<typeof createEdmMachine>;

export function applyStemScale(targets: StemGainTargets, scale: StemGainTargets): StemGainTargets {
  const out: StemGainTargets = { ...targets };
  for (const key of Object.keys(scale) as StemId[]) {
    const s = scale[key];
    if (s == null) continue;
    out[key] = (out[key] ?? 0) * s;
  }
  return out;
}
