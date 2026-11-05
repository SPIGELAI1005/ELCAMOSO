import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { DEFAULT_CABIN_EQ } from "@/lib/drive/types-extra";
import { preloadMusicBank } from "@/lib/symphony/adaptive";
import type { JourneyTraceSampleV1, JourneyTraceV1 } from "@/lib/journey-trace/types";
import type { DriveSongMeta, JourneySummary, TimelinePoint } from "./types";

/** Peak below this is treated as a silent (failed) render. */
export const SILENT_RENDER_PEAK = 0.0005;

export class SilentRenderError extends Error {
  constructor() {
    super("The song came out silent. Please try again or pick another genre.");
    this.name = "SilentRenderError";
  }
}

/** Map a song position (s) to the drive position (s) using the composition sections. */
export function songToSourceSec(song: DriveSongMeta, songT: number): number {
  const sections = song.sections;
  if (!sections.length) return songT;
  const section =
    sections.find((s) => songT >= s.songStartSec && songT < s.songEndSec) ??
    sections[sections.length - 1]!;
  const local = Math.min(
    1,
    Math.max(
      0,
      (songT - section.songStartSec) / Math.max(0.01, section.songEndSec - section.songStartSec),
    ),
  );
  return section.sourceStartSec + local * (section.sourceEndSec - section.sourceStartSec);
}

/** Linear interpolation of the recorded samples at drive time tMs. */
export function sampleTraceAt(
  samples: JourneyTraceSampleV1[],
  tMs: number,
): Pick<
  JourneyTraceSampleV1,
  "speedKmh" | "acceleration" | "driverDemandEstimate" | "regenEstimate" | "jerk"
> {
  if (!samples.length) {
    return { speedKmh: 0, acceleration: 0, driverDemandEstimate: 0, regenEstimate: 0, jerk: 0 };
  }
  let lo = 0;
  let hi = samples.length - 1;
  if (tMs <= samples[0]!.t) return samples[0]!;
  if (tMs >= samples[hi]!.t) return samples[hi]!;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.t <= tMs) lo = mid;
    else hi = mid;
  }
  const a = samples[lo]!;
  const b = samples[hi]!;
  const f = (tMs - a.t) / Math.max(1, b.t - a.t);
  const mix = (x: number, y: number) => x + (y - x) * f;
  return {
    speedKmh: mix(a.speedKmh, b.speedKmh),
    acceleration: mix(a.acceleration, b.acceleration),
    driverDemandEstimate: mix(a.driverDemandEstimate, b.driverDemandEstimate),
    regenEstimate: mix(a.regenEstimate, b.regenEstimate),
    jerk: mix(a.jerk, b.jerk),
  };
}

/**
 * DriveState sequence for the condensed song, driven by the REAL recorded motion
 * (speed, acceleration, braking) of each chosen drive moment.
 */
export function buildSongDriveStatesFromTrace(
  song: DriveSongMeta,
  trace: Pick<JourneyTraceV1, "samples">,
  fps = 30,
): DriveState[] {
  const frames = Math.max(1, Math.floor(song.durationSec * fps));
  const out: DriveState[] = [];
  for (let i = 0; i < frames; i++) {
    const songT = (i / frames) * song.durationSec;
    const s = sampleTraceAt(trace.samples, songToSourceSec(song, songT) * 1000);
    const speed = Math.max(0, s.speedKmh / 3.6);
    const accel = s.acceleration;
    const throttle = Math.min(1, Math.max(0, s.driverDemandEstimate || (accel > 0 ? accel / 3 : 0)));
    const regen = Math.min(1, Math.max(0, s.regenEstimate));
    const load = Math.min(1, throttle * 0.65 + Math.min(1, speed / 45) * 0.25);
    out.push({
      ...IDLE_STATE,
      speed,
      acceleration: accel,
      throttle,
      regen,
      load,
      rpm: 900 + Math.min(1, speed / 40) * 3000 + throttle * 1500,
      gear: speed < 8 ? 1 : speed < 15 ? 2 : speed < 22 ? 3 : 4,
      jerk: Math.max(-1, Math.min(1, s.jerk)),
      timestamp: i * (1000 / fps),
      speedNormalized: Math.min(1, speed / 44),
      accelerationNormalized: Math.min(1, Math.abs(accel) / 4.5),
      isShifting: false,
    });
  }
  return out;
}

export function bufferPeak(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i += 7) {
      const v = Math.abs(d[i]!);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const samples = buffer.length;
  const bytes = samples * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, bytes, true);
  let offset = 44;
  for (let i = 0; i < samples; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

/**
 * Build a condensed DriveState sequence from composition sections + energy timeline.
 * No GPS - energy intensity only.
 */
export function buildSongDriveStates(
  song: DriveSongMeta,
  energyTimeline: TimelinePoint[],
  fps = 30,
): DriveState[] {
  const frames = Math.max(1, Math.floor(song.durationSec * fps));
  const out: DriveState[] = [];
  let prev = IDLE_STATE;
  for (let i = 0; i < frames; i++) {
    const songT = (i / frames) * song.durationSec;
    const section =
      song.sections.find((s) => songT >= s.songStartSec && songT < s.songEndSec) ??
      song.sections[song.sections.length - 1]!;
    const local =
      (songT - section.songStartSec) / Math.max(0.01, section.songEndSec - section.songStartSec);
    const sourceT =
      section.sourceStartSec + local * (section.sourceEndSec - section.sourceStartSec);
    const energy = sampleEnergy(energyTimeline, sourceT) * (0.55 + section.intensity * 0.55);
    const speed = energy * 28;
    const throttle =
      section.chapter === "RELEASE" || section.chapter === "OUTRO"
        ? energy * 0.25
        : Math.min(1, energy * 0.85 + 0.1);
    const regen =
      section.chapter === "RELEASE" || section.chapter === "OUTRO"
        ? Math.min(0.7, 0.2 + energy * 0.4)
        : 0;
    const accel = (throttle - 0.3) * 2.2 - regen * 1.5;
    prev = {
      ...IDLE_STATE,
      speed,
      acceleration: accel,
      throttle,
      regen,
      load: energy,
      rpm: 900 + energy * 4200,
      gear: section.chapter === "PEAK" ? 4 : section.chapter === "RISE" ? 3 : 2,
      jerk: Math.max(-1, Math.min(1, accel * 0.2)),
      timestamp: i * (1000 / fps),
      speedNormalized: Math.min(1, speed / 44),
      accelerationNormalized: Math.min(1, Math.abs(accel) / 4.5),
      isShifting: false,
    };
    out.push(prev);
  }
  return out;
}

function sampleEnergy(timeline: TimelinePoint[], t: number) {
  if (!timeline.length) return 0.35;
  let closest = timeline[0]!;
  for (const p of timeline) {
    if (Math.abs(p.t - t) < Math.abs(closest.t - t)) closest = p;
  }
  return closest.energy;
}

/**
 * OfflineAudioContext render of a Drive Song via Symphony (or fusion music pack) profile.
 * Client-side only - does not upload telemetry.
 */
export async function renderDriveSong(
  journey: JourneySummary,
  song: DriveSongMeta,
  opts?: { trace?: Pick<JourneyTraceV1, "samples"> | null },
): Promise<Blob> {
  const duration = Math.min(180, Math.max(30, song.durationSec));
  const sampleRate = 44100;
  const OfflineCtx =
    typeof OfflineAudioContext !== "undefined"
      ? OfflineAudioContext
      : (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
  if (!OfflineCtx) {
    throw new Error("OfflineAudioContext is not available in this browser.");
  }

  const ctx = new OfflineCtx(2, Math.floor(sampleRate * duration), sampleRate);
  // Root cause of silent Drive Songs: the music packs play pre-recorded note sprites that
  // are fetched in the background. An offline render finishes in ~2 s, before they arrive,
  // so every note was skipped and the file was pure silence. Load them first.
  await preloadMusicBank(ctx).catch(() => undefined);
  const engine = new SoundEngine();
  engine.setRenderTime(0);
  await engine.start(getProfile(song.symphonyPackId), {
    signature: false,
    context: ctx,
    seed: song.seed,
  });
  engine.setCabinEq(DEFAULT_CABIN_EQ);
  engine.setVolume(0.55);
  await engine.whenSamplesReady().catch(() => undefined);

  const renderSong = { ...song, durationSec: duration };
  const states = opts?.trace?.samples.length
    ? buildSongDriveStatesFromTrace(renderSong, opts.trace)
    : buildSongDriveStates(renderSong, journey.energyTimeline);
  const step = duration / Math.max(1, states.length);
  states.forEach((state, i) => {
    engine.setRenderTime(i * step);
    engine.update(state);
  });

  const buffer = await ctx.startRendering();
  await engine.stop().catch(() => undefined);
  if (bufferPeak(buffer) < SILENT_RENDER_PEAK) throw new SilentRenderError();
  return encodeWav(buffer);
}

export { encodeWav };
