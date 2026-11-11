import type { StemGainTargets, StemId, SymphonyPack } from "./types";
import type { MusicClock } from "./music-clock";
import { generateProceduralStemBuffer } from "./procedural-stems";
import { isSymphonyPackProductionReady } from "./asset-manifest";
import { SYMPHONY_INTRO_BUFFER_ID } from "./pack-loader";

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
  const shelfGain = pack.lowShelfGain ?? -8;
  let shelf: BiquadFilterNode | null = null;
  if (shelfGain === 0) {
    bus.connect(destination);
  } else {
    shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = 65;
    shelf.gain.value = shelfGain;
    bus.connect(shelf);
    shelf.connect(destination);
  }

  const voices: StemVoice[] = [];
  const targets: StemGainTargets = {};
  let late = 0;
  const introNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];

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
    /** Seconds after `audioTime` when looping stems start (0 if no intro). */
    introDuration(playIntro = pack.playIntroOnStart ?? Boolean(pack.intro)): number {
      const introBuf = preloaded?.get(SYMPHONY_INTRO_BUFFER_ID);
      if (!playIntro || !introBuf) return 0;
      return pack.intro?.durationSeconds ?? introBuf.duration;
    },
    start(audioTime: number, opts?: { playIntro?: boolean }) {
      if (started) return;
      started = true;
      const playIntro = opts?.playIntro ?? pack.playIntroOnStart ?? Boolean(pack.intro);
      const introBuf = preloaded?.get(SYMPHONY_INTRO_BUFFER_ID);
      let loopAt = audioTime;
      if (playIntro && introBuf) {
        const gain = ctx.createGain();
        gain.gain.value = 1;
        const source = ctx.createBufferSource();
        source.buffer = introBuf;
        source.connect(gain);
        gain.connect(bus);
        try {
          source.start(audioTime);
        } catch {
          late += 1;
        }
        introNodes.push({ source, gain });
        loopAt = audioTime + (pack.intro?.durationSeconds ?? introBuf.duration);
      }
      for (const v of voices) {
        try {
          v.source.start(loopAt);
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
      for (const node of introNodes) {
        try {
          node.source.stop();
        } catch {
          /* already stopped */
        }
        try {
          node.source.disconnect();
          node.gain.disconnect();
        } catch {
          /* */
        }
      }
      introNodes.length = 0;
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
      if (shelf) {
        try {
          shelf.disconnect();
        } catch {
          /* */
        }
      }
      voices.length = 0;
    },
  };
}

export type StemPlayer = ReturnType<typeof createStemPlayer>;
