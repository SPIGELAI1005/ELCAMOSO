import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { DEFAULT_CABIN_EQ } from "@/lib/drive/types-extra";

/** 30 s demo speed curve (km/h): accelerate 0→60, cruise, slow to a stop. */
export function carriageDemoKmh(t: number): number {
  if (t < 1) return 0;
  if (t < 11) return 60 * Math.sin(((t - 1) / 10) * (Math.PI / 2)) ** 1.3;
  if (t < 21) return 60;
  if (t < 29) return 60 * (1 - (t - 21) / 8);
  return 0;
}

export async function renderCarriageDemo(profileId: string, duration = 30) {
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);
  const engine = new SoundEngine();
  engine.setRenderTime(0);
  const profile = getProfile(profileId);
  await engine.start(profile, { signature: false, context: ctx, seed: 1 });
  engine.setCabinEq(DEFAULT_CABIN_EQ);
  engine.setVolume(0.55);
  const fps = 60;
  let previous: DriveState = IDLE_STATE;
  let prevSpeed = 0;
  for (let i = 0; i < duration * fps; i += 1) {
    const t = i / fps;
    const speed = carriageDemoKmh(t) / 3.6;
    const acceleration = (speed - prevSpeed) * fps;
    prevSpeed = speed;
    previous = computeDriveState({ speed, acceleration, previous, profile, dt: 1 / fps });
    engine.setRenderTime(t);
    engine.update(previous);
  }
  const buffer = await ctx.startRendering();
  await engine.stop();
  const ch = [buffer.getChannelData(0), buffer.getChannelData(1)];
  const n = buffer.length;
  const pcm = new Int16Array(n * 2);
  for (let i = 0; i < n; i += 1)
    for (let c = 0; c < 2; c += 1) {
      const s = Math.max(-1, Math.min(1, ch[c]![i]!));
      pcm[i * 2 + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { sampleRate, pcmBase64: btoa(bin) };
}
