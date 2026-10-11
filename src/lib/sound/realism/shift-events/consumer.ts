import type { DrivetrainShiftEvent } from "@/lib/powertrain/types";
import type { ShiftConsumeResult } from "@/lib/sound/realism/shift-events/types";

/** Discard events older than this vs the audio clock (ms). */
export const DEFAULT_SHIFT_EVENT_MAX_STALE_MS = 350;

/** After a suspend/resume gap this large, flush pending sequence history. */
export const DEFAULT_TIMELINE_GAP_FLUSH_MS = 200;

const MAX_CONSUMED_IDS = 64;

/**
 * Exactly-once consumer for Prompt 03 `shiftEvent.sequenceId`.
 * Maps telemetry timestamps against the audio clock; never replays a backlog
 * after tab suspension, resume, or reconnection.
 */
export class ShiftEventConsumer {
  private consumed = new Set<number>();
  private consumedOrder: number[] = [];
  private lastAudioNowMs = 0;
  private flushPending = false;

  constructor(
    private readonly maxStaleMs = DEFAULT_SHIFT_EVENT_MAX_STALE_MS,
    private readonly gapFlushMs = DEFAULT_TIMELINE_GAP_FLUSH_MS,
  ) {}

  /** Call on profile switch or engine rebuild. */
  reset(): void {
    this.consumed.clear();
    this.consumedOrder = [];
    this.lastAudioNowMs = 0;
    this.flushPending = false;
  }

  /**
   * Notify a discontinuity in the audio timeline (suspend/resume, context restart).
   * Next consume discards stale events; history is cleared so overdue bursts cannot fire.
   */
  markTimelineGap(gapMs: number): void {
    if (gapMs >= this.gapFlushMs) {
      this.consumed.clear();
      this.consumedOrder = [];
      this.flushPending = true;
    }
  }

  /**
   * Attempt to consume a one-tick shift event.
   * `audioNowMs` is AudioContext currentTime mapped to ms (same clock as scheduling).
   */
  consume(
    event: DrivetrainShiftEvent | null | undefined,
    audioNowMs: number,
  ): ShiftConsumeResult {
    if (this.lastAudioNowMs > 0) {
      const gap = audioNowMs - this.lastAudioNowMs;
      if (gap > this.gapFlushMs * 2) this.markTimelineGap(gap);
    }
    this.lastAudioNowMs = audioNowMs;

    if (!event) {
      this.flushPending = false;
      return { accepted: false, reason: "null-event", sequenceId: null };
    }
    if (!Number.isFinite(event.sequenceId) || event.sequenceId <= 0) {
      return { accepted: false, reason: "invalid-id", sequenceId: event.sequenceId ?? null };
    }

    if (this.flushPending) {
      this.flushPending = false;
      // After a gap, only accept events that are still fresh vs audio now.
      const age = audioNowMs - event.atMs;
      if (age > this.maxStaleMs || age < -500) {
        this.remember(event.sequenceId);
        return { accepted: false, reason: "timeline-gap", sequenceId: event.sequenceId };
      }
    }

    if (this.consumed.has(event.sequenceId)) {
      return { accepted: false, reason: "duplicate", sequenceId: event.sequenceId };
    }

    const age = audioNowMs - event.atMs;
    // Future events within a small skew are ok (telemetry ahead of audio).
    if (age > this.maxStaleMs || age < -500) {
      this.remember(event.sequenceId);
      return { accepted: false, reason: "stale", sequenceId: event.sequenceId };
    }

    this.remember(event.sequenceId);
    return { accepted: true, reason: "accepted", sequenceId: event.sequenceId };
  }

  hasConsumed(sequenceId: number): boolean {
    return this.consumed.has(sequenceId);
  }

  consumedCount(): number {
    return this.consumed.size;
  }

  private remember(sequenceId: number): void {
    if (this.consumed.has(sequenceId)) return;
    this.consumed.add(sequenceId);
    this.consumedOrder.push(sequenceId);
    while (this.consumedOrder.length > MAX_CONSUMED_IDS) {
      const oldest = this.consumedOrder.shift();
      if (oldest != null) this.consumed.delete(oldest);
    }
  }
}
