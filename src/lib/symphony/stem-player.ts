import type { StemGainTargets, StemId, SymphonyPack } from "./types";
import { createMusicClock, type MusicClock } from "./music-clock";
import { generateProceduralStemBuffer } from "./procedural-stems";
import { isSymphonyPackProductionReady } from "./asset-manifest";

interface StemVoice {
  id: StemId;
  gain: GainNode;
  source: AudioBufferSourceNode;
  buffer: AudioBuffer;
}

/**
 * Gapless synchronized stem mixer.
 * Muted stems keep running silently so phase stays aligned.
 */
export function createStemPlayer(
  ctx: BaseAudioContext,
  destination: AudioNode,
  pack: SymphonyPack,
  clock: MusicClock,
  seed: number,
  preloaded?: Map<string, AudioBuffer>,
) {
  if (import.meta.env.PROD && !isSymphonyPackProductionReady(pack)) {
    throw new Error(`Symphony pack ${pack.id} is not approved for production playback.`);
  }

  const bus = ctx.createGain();
  bus.gain.value = pack.packGain;
  bus.connect(destination);

  const voices: StemVoice[] = [];
  const targets: StemGainTargets = {};
  let late = 0;

  for (const stem of pack.stems) {
    const buffer =
      preloaded?.get(stem.id) ?? generateProceduralStemBuffer(ctx, clock.config, stem, seed);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(bus);
    voices.push({ id: stem.id, gain, source, buffer });
    targets[stem.id] = 0;
  }

  let started = false;

  return {
    get lateEvents() {
      return late;
    },
    start(audioTime: number) {
      if (started) return;
      started = true;
      for (const v of voices) {
        try {
          v.source.start(audioTime);
        } catch {
          late += 1;
        }
      }
    },
    setTargets(next: StemGainTargets, audioTime: number) {
      for (const v of voices) {
        const g = Math.max(0.0001, next[v.id] ?? 0);
        targets[v.id] = g;
        try {
          v.gain.gain.setTargetAtTime(g, audioTime, 0.08);
        } catch {
          late += 1;
        }
      }
    },
    activeStems(): StemId[] {
      return voices.filter((v) => (targets[v.id] ?? 0) > 0.05).map((v) => v.id);
    },
    dispose() {
      for (const v of voices) {
        try {
          v.source.stop();
        } catch {
          /* already stopped */
        }
        try {
          v.source.disconnect();
          v.gain.disconnect();
        } catch {
          /* */
        }
      }
      try {
        bus.disconnect();
      } catch {
        /* */
      }
      voices.length = 0;
    },
  };
}

export type StemPlayer = ReturnType<typeof createStemPlayer>;
