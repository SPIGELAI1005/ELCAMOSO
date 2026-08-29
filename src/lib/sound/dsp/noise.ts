import { audioRandom } from "@/lib/sound/rng";

export type NoiseColor = "white" | "pink" | "brown";

const cache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColor, AudioBuffer>>>();

function whiteNoise(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = audioRandom() * 2 - 1;
  return buffer;
}

function pinkNoise(ctx: BaseAudioContext, seconds = 3): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < data.length; i += 1) {
    const w = audioRandom() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buffer;
}

function brownNoise(ctx: BaseAudioContext, seconds = 3): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const w = audioRandom() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function getNoiseBuffer(ctx: BaseAudioContext, color: NoiseColor = "pink") {
  let map = cache.get(ctx);
  if (!map) {
    map = {};
    cache.set(ctx, map);
  }
  if (!map[color]) {
    map[color] =
      color === "white" ? whiteNoise(ctx) : color === "brown" ? brownNoise(ctx) : pinkNoise(ctx);
  }
  return map[color]!;
}

export function createLoopingNoise(ctx: BaseAudioContext, color: NoiseColor = "pink", rate = 1) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, color);
  src.loop = true;
  src.playbackRate.value = rate;
  return src;
}
