/**
 * Coach-voice trigger and cooldown logic. Pure: the player decides *when*
 * and *which* line to speak; audio I/O lives in the page.
 */
import type { CoachLineId, CoachMode } from "./types";
export type { CoachLineId, CoachMode } from "./types";

export interface CoachLine {
  id: CoachLineId;
  text: string;
  /** Public path to the pre-rendered clip. */
  src: string;
}

export const COACH_LINES: readonly CoachLine[] = [
  { id: "push-for-it", text: "Push for it", src: "/audio/rumoso/voices/push-for-it.m4a" },
  { id: "go-for-it", text: "Go for it", src: "/audio/rumoso/voices/go-for-it.m4a" },
  { id: "you-can-do-it", text: "You can do it", src: "/audio/rumoso/voices/you-can-do-it.m4a" },
  {
    id: "nice-pace-hold-it",
    text: "Nice pace, hold it",
    src: "/audio/rumoso/voices/nice-pace-hold-it.m4a",
  },
  {
    id: "last-minute",
    text: "Last minute, give it everything",
    src: "/audio/rumoso/voices/last-minute.m4a",
  },
];

export const COACH_LINE_BY_ID: Record<CoachLineId, CoachLine> = Object.fromEntries(
  COACH_LINES.map((l) => [l.id, l]),
) as Record<CoachLineId, CoachLine>;

/** Minimum gap between lines. Hype is the 45 s floor from the brief; calm is a little quieter. */
export const COACH_COOLDOWN_MS: Record<CoachMode, number> = {
  off: Number.POSITIVE_INFINITY,
  hype: 45_000,
  calm: 60_000,
};

export const DEFAULT_SESSION_TARGET_MS = 20 * 60 * 1000;
const HARD_PUSH_ENTER = 70;
const HARD_PUSH_RESET = 60;
const DROP_FROM = 50;
const DROP_DELTA = 12;
const NICE_PACE_MIN = 40;
const NICE_PACE_MAX = 70;
const NICE_PACE_HOLD_MS = 20_000;

export interface CoachState {
  mode: CoachMode;
  lastVoiceAtMs: number | null;
  lastLine: CoachLineId | null;
  sessionStartedAtMs: number;
  sessionTargetMs: number;
  saidLastMinute: boolean;
  /** Effort was below the push-reset threshold, so a new push can fire. */
  wasBelowPush: boolean;
  /** When effort first entered the nice-pace band. */
  nicePaceSinceMs: number | null;
  recentPeakEffort: number;
}

export interface CoachFrame {
  nowMs: number;
  effort: number;
}

export interface CoachTrigger {
  line: CoachLineId;
  reason: "hard-push" | "effort-drop" | "nice-pace" | "last-minute";
  text: string;
}

export function createCoachState(
  mode: CoachMode,
  sessionStartedAtMs: number,
  sessionTargetMs = DEFAULT_SESSION_TARGET_MS,
): CoachState {
  return {
    mode,
    lastVoiceAtMs: null,
    lastLine: null,
    sessionStartedAtMs,
    sessionTargetMs,
    saidLastMinute: false,
    wasBelowPush: true,
    nicePaceSinceMs: null,
    recentPeakEffort: 0,
  };
}

export function cooldownMs(mode: CoachMode): number {
  return COACH_COOLDOWN_MS[mode];
}

function inCooldown(state: CoachState, nowMs: number): boolean {
  if (state.mode === "off") return true;
  if (state.lastVoiceAtMs == null) return false;
  return nowMs - state.lastVoiceAtMs < cooldownMs(state.mode);
}

export function evaluateCoach(state: CoachState, frame: CoachFrame): CoachTrigger | null {
  if (state.mode === "off") return null;
  const { nowMs, effort } = frame;

  if (effort < NICE_PACE_MIN || effort > NICE_PACE_MAX) {
    state.nicePaceSinceMs = null;
  } else if (state.nicePaceSinceMs == null) {
    state.nicePaceSinceMs = nowMs;
  }
  state.recentPeakEffort = Math.max(state.recentPeakEffort * 0.98, effort);
  if (effort < HARD_PUSH_RESET) state.wasBelowPush = true;

  if (inCooldown(state, nowMs)) return null;

  const elapsed = nowMs - state.sessionStartedAtMs;
  const lastMinuteAt = state.sessionTargetMs - 60_000;
  if (!state.saidLastMinute && state.sessionTargetMs >= 60_000 && elapsed >= lastMinuteAt) {
    return { line: "last-minute", reason: "last-minute", text: COACH_LINE_BY_ID["last-minute"].text };
  }

  if (state.wasBelowPush && effort >= HARD_PUSH_ENTER) {
    const line: CoachLineId = state.mode === "hype" ? "push-for-it" : "go-for-it";
    return { line, reason: "hard-push", text: COACH_LINE_BY_ID[line].text };
  }

  if (state.recentPeakEffort >= DROP_FROM && state.recentPeakEffort - effort >= DROP_DELTA) {
    const line: CoachLineId = state.mode === "hype" ? "you-can-do-it" : "go-for-it";
    return { line, reason: "effort-drop", text: COACH_LINE_BY_ID[line].text };
  }

  if (
    state.nicePaceSinceMs != null &&
    nowMs - state.nicePaceSinceMs >= NICE_PACE_HOLD_MS &&
    effort >= NICE_PACE_MIN &&
    effort <= NICE_PACE_MAX
  ) {
    return {
      line: "nice-pace-hold-it",
      reason: "nice-pace",
      text: COACH_LINE_BY_ID["nice-pace-hold-it"].text,
    };
  }

  return null;
}

export function applyCoachFire(state: CoachState, trigger: CoachTrigger, nowMs: number): void {
  state.lastVoiceAtMs = nowMs;
  state.lastLine = trigger.line;
  if (trigger.reason === "last-minute") state.saidLastMinute = true;
  if (trigger.reason === "hard-push") state.wasBelowPush = false;
  if (trigger.reason === "effort-drop") state.recentPeakEffort = trigger.line ? 0 : state.recentPeakEffort;
  // Reset peak so we don't immediately re-trigger drop after firing.
  if (trigger.reason === "effort-drop") state.recentPeakEffort = 0;
  if (trigger.reason === "nice-pace") state.nicePaceSinceMs = null;
}

/** Music duck: 0.22 of the music gain while a line is playing, plus short ramps. */
export const VOICE_DUCK_GAIN = 0.22;
export const VOICE_DUCK_ATTACK_S = 0.15;
export const VOICE_DUCK_RELEASE_S = 0.4;
export const VOICE_DUCK_TAIL_S = 0.2;
