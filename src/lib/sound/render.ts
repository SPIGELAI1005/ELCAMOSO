import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import type { DriveTrace } from "@/lib/drive/traces";
import { DEFAULT_CABIN_EQ } from "@/lib/drive/types-extra";

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

function rampStates(duration: number, profileId: string): DriveState[] {
  const profile = getProfile(profileId);
  const frames = Math.floor(duration * 60);
  const out: DriveState[] = [];
  let previous = IDLE_STATE;
  let speed = 0;
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames;
    const target = (8 + t * 28);
    speed += (target - speed) * 0.08;
    previous = computeDriveState({
      speed,
      acceleration: 1.4 * (1 - t),
      previous,
      profile,
      dt: 1 / 60,
    });
    out.push(previous);
  }
  return out;
}

export async function renderToBuffer(opts: {
  profileId: string;
  trace?: DriveTrace | null;
  duration?: number;
  seed?: number;
}): Promise<AudioBuffer> {
  const duration = Math.min(20, opts.trace ? opts.trace.durationMs / 1000 : (opts.duration ?? 15));
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);
  const engine = new SoundEngine();
  engine.setRenderTime(0);
  await engine.start(getProfile(opts.profileId), {
    signature: false,
    context: ctx,
    seed: opts.seed ?? 1,
  });
  engine.setCabinEq(DEFAULT_CABIN_EQ);
  engine.setVolume(0.55);
  const states = opts.trace?.samples?.length
    ? opts.trace.samples
    : rampStates(duration, opts.profileId);
  const step = duration / Math.max(1, states.length);
  states.forEach((state, i) => {
    engine.setRenderTime(i * step);
    engine.update(state);
  });
  const buffer = await ctx.startRendering();
  await engine.stop();
  return buffer;
}

export async function renderToAudio(opts: {
  profileId: string;
  trace?: DriveTrace | null;
  duration?: number;
}): Promise<Blob> {
  const buffer = await renderToBuffer(opts);
  return encodeWav(buffer);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
