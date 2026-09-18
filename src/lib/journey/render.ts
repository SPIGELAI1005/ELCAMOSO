import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { DEFAULT_CABIN_EQ } from "@/lib/drive/types-extra";
import type { DriveSongMeta, JourneySummary, TimelinePoint } from "./types";

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
export async function renderDriveSong(journey: JourneySummary, song: DriveSongMeta): Promise<Blob> {
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
  const engine = new SoundEngine();
  engine.setRenderTime(0);
  await engine.start(getProfile(song.symphonyPackId), {
    signature: false,
    context: ctx,
    seed: song.seed,
  });
  engine.setCabinEq(DEFAULT_CABIN_EQ);
  engine.setVolume(0.55);

  const states = buildSongDriveStates(song, journey.energyTimeline);
  const step = duration / Math.max(1, states.length);
  states.forEach((state, i) => {
    engine.setRenderTime(i * step);
    engine.update(state);
  });

  const buffer = await ctx.startRendering();
  await engine.stop();
  return encodeWav(buffer);
}

export { encodeWav };
