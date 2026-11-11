import type { StemGainTargets, StemId, SymphonyPack, SymphonySemanticEvent } from "./types";
import type { MusicClock } from "./music-clock";
import { generateProceduralStemBuffer } from "./procedural-stems";
import { isSymphonyPackProductionReady } from "./asset-manifest";
import { SYMPHONY_INTRO_BUFFER_ID, oneshotBufferId } from "./pack-loader";

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
  let limiter: DynamicsCompressorNode | null = null;
  const bedDuck = ctx.createGain();
  const hookDuck = ctx.createGain();
  bedDuck.gain.value = 1;
  hookDuck.gain.value = 1;
  bedDuck.connect(bus);
  hookDuck.connect(bus);
  let mixHp: BiquadFilterNode | null = null;
  let makeup: GainNode | null = null;
  let output: AudioNode = bus;
  const needsLimiter = Boolean(pack.electronicLayers || pack.busLimiter || pack.edmArrangement);
  if (pack.edmArrangement) {
    mixHp = ctx.createBiquadFilter();
    mixHp.type = "highpass";
    mixHp.frequency.value = 30;
    mixHp.Q.value = 0.7;
    makeup = ctx.createGain();
    makeup.gain.value = 1;
    bus.connect(mixHp);
    if (needsLimiter) {
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2.8;
      limiter.knee.value = 4;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.14;
      mixHp.connect(limiter);
      limiter.connect(makeup);
    } else {
      mixHp.connect(makeup);
    }
    output = makeup;
  } else if (needsLimiter) {
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3.5;
    limiter.knee.value = 4;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    bus.connect(limiter);
    output = limiter;
  }
  if (shelfGain === 0) {
    output.connect(destination);
  } else {
    shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = 65;
    shelf.gain.value = shelfGain;
    output.connect(shelf);
    shelf.connect(destination);
  }

  const voices: StemVoice[] = [];
  const targets: StemGainTargets = {};
  let late = 0;
  const introNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  const oneShotNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  const lastOneShotAt = new Map<string, number>();
  const groupIndex = new Map<string, number>();
  const gainTau = pack.gainTauSeconds ?? 0.08;

  for (const stem of pack.stems) {
    const buffer =
      preloaded?.get(stem.id) ?? generateProceduralStemBuffer(ctx, clock.config, stem, seed);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    const duckBeds = pack.electronicLayers || pack.edmArrangement;
    if (duckBeds && (stem.id === "atmosphere" || stem.id === "piano" || stem.id === "strings")) {
      gain.connect(bedDuck);
    } else if (duckBeds && stem.id === "lead") {
      gain.connect(hookDuck);
    } else {
      gain.connect(bus);
    }
    voices.push({ id: stem.id, gain, source, buffer });
    targets[stem.id] = 0;
  }

  let started = false;

  return {
    get lateEvents() {
      return late;
    },
    get bus() {
      return bus;
    },
    get ducks() {
      return { bed: bedDuck, hook: hookDuck };
    },
    get mixHp() {
      return mixHp;
    },
    setMixHp(hz: number, audioTime: number, tau = 0.08) {
      if (!mixHp) return;
      try {
        mixHp.frequency.setTargetAtTime(Math.max(20, hz), audioTime, tau);
      } catch {
        late += 1;
      }
    },
    snapMixHp(hz: number, audioTime: number) {
      if (!mixHp) return;
      try {
        mixHp.frequency.cancelScheduledValues(audioTime);
        mixHp.frequency.setValueAtTime(Math.max(20, hz), audioTime);
      } catch {
        late += 1;
      }
    },
    setMakeup(gain: number, audioTime: number, tau = 0.12) {
      if (!makeup) return;
      try {
        makeup.gain.setTargetAtTime(Math.max(0.3, gain), audioTime, tau);
      } catch {
        late += 1;
      }
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
          v.gain.gain.setTargetAtTime(g, audioTime, gainTau);
        } catch {
          late += 1;
        }
      }
    },
    triggerOneShots(type: SymphonySemanticEvent, audioTime: number) {
      const shots = pack.oneShots ?? [];
      if (!shots.length) return;
      const firedGroups = new Set<string>();
      for (const shot of shots) {
        if (!shot.triggers.includes(type)) continue;
        if (shot.group && firedGroups.has(shot.group)) continue;
        const key = shot.group ?? shot.id;
        const cooldown = shot.cooldownSeconds ?? 3;
        const last = lastOneShotAt.get(key) ?? -Infinity;
        if (audioTime - last < cooldown) continue;
        let chosen = shot;
        if (shot.group) {
          const group = shots.filter((s) => s.group === shot.group && s.triggers.includes(type));
          const idx = groupIndex.get(shot.group) ?? 0;
          chosen = group[idx % group.length] ?? shot;
          groupIndex.set(shot.group, idx + 1);
          firedGroups.add(shot.group);
        }
        const buffer = preloaded?.get(oneshotBufferId(chosen.id));
        if (!buffer) continue;
        const gain = ctx.createGain();
        gain.gain.value = chosen.gain ?? 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(bus);
        try {
          source.start(audioTime);
        } catch {
          late += 1;
          continue;
        }
        oneShotNodes.push({ source, gain });
        lastOneShotAt.set(key, audioTime);
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
      for (const node of oneShotNodes) {
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
      oneShotNodes.length = 0;
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
      for (const node of [bedDuck, hookDuck, mixHp, makeup, limiter]) {
        if (!node) continue;
        try {
          node.disconnect();
        } catch {
          /* */
        }
      }
      voices.length = 0;
    },
  };
}

export type StemPlayer = ReturnType<typeof createStemPlayer>;
