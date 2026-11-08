/**
 * RetroArcadeSynth - Speed-responsive procedural music synth for Retro Arcade.
 *
 * Uses the approved procedural stem design (glassy bells, ethereal pads, warm bass,
 * bouncing plucks, sparse drums) with smooth speed-to-energy mapping across 0-220 km/h.
 *
 * Speed-Energy Mapping:
 * - 0 km/h: energy 0 (idle/stopped) - pads + bells only
 * - 50 km/h: energy 0.23 - + bass enters
 * - 100 km/h: energy 0.45 - + plucks enter
 * - 150 km/h: energy 0.68 - drums begin
 * - 200 km/h: energy 0.91 - full intensity approaching
 * - 220 km/h: energy 1.0 - maximum intensity
 *
 * No clipping, no grotesque pitch-shifting, smooth progressive arrangement.
 */
import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import {
  generateRetroArcadeBellBuffer,
  generateRetroArcadePadBuffer,
  generateRetroArcadeBassBuffer,
  generateRetroArcadePluckBuffer,
  generateRetroArcadeKickBuffer,
  generateRetroArcadeHihatBuffer,
  type RetroArcadeClock,
} from "./procedural-stems";

const BPM = 140;
const BEATS_PER_BAR = 4;
const BARS_PER_LOOP = 8;
const MAX_SPEED_KMH = 220;

export interface RetroArcadeDiagnostics {
  energy: number;
  speedKmh: number;
  stemGains: {
    bells: number;
    pads: number;
    bass: number;
    plucks: number;
    kick: number;
    hihats: number;
  };
  loopPosition: number;
}

function smoothToward(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  const alpha = 1 - Math.exp(-dt / tau);
  return current + (target - current) * alpha;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function speedToEnergy(speedKmh: number): number {
  return clamp01(speedKmh / MAX_SPEED_KMH);
}

function energyToStemGains(energy: number): RetroArcadeDiagnostics["stemGains"] {
  const e = clamp01(energy);

  const bellsBase = 0.35;
  const bellsRange = 0.3;
  const bells = bellsBase + e * bellsRange;

  const padsBase = 0.55;
  const padsRange = -0.25;
  const pads = padsBase + e * padsRange;

  const bassThreshold = 0.15;
  const bass = e > bassThreshold ? clamp01((e - bassThreshold) / 0.4) * 0.55 : 0;

  const pluckThreshold = 0.35;
  const plucks = e > pluckThreshold ? clamp01((e - pluckThreshold) / 0.35) * 0.6 : 0;

  const kickThreshold = 0.55;
  const kick = e > kickThreshold ? clamp01((e - kickThreshold) / 0.3) * 0.5 : 0;

  const hihatThreshold = 0.7;
  const hihats = e > hihatThreshold ? clamp01((e - hihatThreshold) / 0.25) * 0.45 : 0;

  return { bells, pads, bass, plucks, kick, hihats };
}

export class RetroArcadeSynth {
  private ctx: BaseAudioContext | null = null;
  private bus: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private bellBuffer: AudioBuffer | null = null;
  private padBuffer: AudioBuffer | null = null;
  private bassBuffer: AudioBuffer | null = null;
  private pluckBuffer: AudioBuffer | null = null;
  private kickBuffer: AudioBuffer | null = null;
  private hihatBuffer: AudioBuffer | null = null;

  private bellSource: AudioBufferSourceNode | null = null;
  private padSource: AudioBufferSourceNode | null = null;
  private bassSource: AudioBufferSourceNode | null = null;
  private pluckSource: AudioBufferSourceNode | null = null;
  private kickSource: AudioBufferSourceNode | null = null;
  private hihatSource: AudioBufferSourceNode | null = null;

  private bellGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private pluckGain: GainNode | null = null;
  private kickGain: GainNode | null = null;
  private hihatGain: GainNode | null = null;

  private built = false;
  private seed = 1;
  private energy = 0;
  private targetEnergy = 0;
  private lastTs = 0;
  private lastSpeedKmh = 0;
  private loopStartTime = 0;

  build(
    ctx: BaseAudioContext,
    profile: SoundProfile,
    buses: StrategyBuses,
    seed?: number,
  ): boolean {
    this.dispose();

    if (profile.id !== "retro-arcade") return false;

    this.ctx = ctx;
    this.seed = seed ?? Date.now() & 0xffff;

    const clock: RetroArcadeClock = {
      bpm: BPM,
      beatsPerBar: BEATS_PER_BAR,
      barsPerLoop: BARS_PER_LOOP,
    };

    this.bellBuffer = generateRetroArcadeBellBuffer(ctx, clock, this.seed);
    this.padBuffer = generateRetroArcadePadBuffer(ctx, clock, this.seed);
    this.bassBuffer = generateRetroArcadeBassBuffer(ctx, clock, this.seed);
    this.pluckBuffer = generateRetroArcadePluckBuffer(ctx, clock, this.seed);
    this.kickBuffer = generateRetroArcadeKickBuffer(ctx, clock, this.seed);
    this.hihatBuffer = generateRetroArcadeHihatBuffer(ctx, clock, this.seed);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.65;
    this.masterGain.connect(buses.body);

    this.bellGain = ctx.createGain();
    this.padGain = ctx.createGain();
    this.bassGain = ctx.createGain();
    this.pluckGain = ctx.createGain();
    this.kickGain = ctx.createGain();
    this.hihatGain = ctx.createGain();

    this.bellGain.connect(this.masterGain);
    this.padGain.connect(this.masterGain);
    this.bassGain.connect(this.masterGain);
    this.pluckGain.connect(this.masterGain);
    this.kickGain.connect(this.masterGain);
    this.hihatGain.connect(this.masterGain);

    const initialGains = energyToStemGains(0);
    this.bellGain.gain.value = initialGains.bells;
    this.padGain.gain.value = initialGains.pads;
    this.bassGain.gain.value = initialGains.bass;
    this.pluckGain.gain.value = initialGains.plucks;
    this.kickGain.gain.value = initialGains.kick;
    this.hihatGain.gain.value = initialGains.hihats;

    const startTime = "currentTime" in ctx ? ctx.currentTime + 0.05 : 0;
    this.loopStartTime = startTime;
    this.startSources(startTime);

    this.built = true;
    return true;
  }

  private startSources(startTime: number) {
    if (!this.ctx) return;

    const createLoopingSource = (buffer: AudioBuffer | null, gain: GainNode | null): AudioBufferSourceNode | null => {
      if (!buffer || !gain || !this.ctx) return null;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start(startTime);
      return src;
    };

    this.bellSource = createLoopingSource(this.bellBuffer, this.bellGain);
    this.padSource = createLoopingSource(this.padBuffer, this.padGain);
    this.bassSource = createLoopingSource(this.bassBuffer, this.bassGain);
    this.pluckSource = createLoopingSource(this.pluckBuffer, this.pluckGain);
    this.kickSource = createLoopingSource(this.kickBuffer, this.kickGain);
    this.hihatSource = createLoopingSource(this.hihatBuffer, this.hihatGain);
  }

  update(state: DriveState, audioTime: number) {
    if (!this.built || !this.ctx) return;

    const dt = this.lastTs > 0
      ? Math.min(0.15, Math.max(0.001, (state.timestamp - this.lastTs) / 1000))
      : 1 / 60;
    this.lastTs = state.timestamp;

    const speedKmh = (state.speed ?? 0) * 3.6;
    this.lastSpeedKmh = speedKmh;
    this.targetEnergy = speedToEnergy(speedKmh);

    const accel = state.acceleration ?? 0;
    const accelBoost = accel > 0.5 ? Math.min(0.15, accel * 0.03) : 0;
    const targetWithBoost = clamp01(this.targetEnergy + accelBoost);

    const tau = accel > 0.2 ? 0.4 : accel < -0.3 ? 0.8 : 0.6;
    this.energy = smoothToward(this.energy, targetWithBoost, dt, tau);

    const gains = energyToStemGains(this.energy);
    const now = audioTime;
    const smoothTime = 0.15;

    this.bellGain?.gain.setTargetAtTime(gains.bells, now, smoothTime);
    this.padGain?.gain.setTargetAtTime(gains.pads, now, smoothTime);
    this.bassGain?.gain.setTargetAtTime(gains.bass, now, smoothTime);
    this.pluckGain?.gain.setTargetAtTime(gains.plucks, now, smoothTime);
    this.kickGain?.gain.setTargetAtTime(gains.kick, now, smoothTime);
    this.hihatGain?.gain.setTargetAtTime(gains.hihats, now, smoothTime);
  }

  getEnergy(): number {
    return this.energy;
  }

  getDiagnostics(): RetroArcadeDiagnostics {
    const loopDuration = (60 / BPM) * BEATS_PER_BAR * BARS_PER_LOOP;
    const currentTime = this.ctx && "currentTime" in this.ctx ? this.ctx.currentTime : 0;
    const elapsed = currentTime - this.loopStartTime;
    const loopPosition = (elapsed % loopDuration) / loopDuration;

    return {
      energy: this.energy,
      speedKmh: this.lastSpeedKmh,
      stemGains: energyToStemGains(this.energy),
      loopPosition,
    };
  }

  dispose() {
    const stopSource = (src: AudioBufferSourceNode | null) => {
      try {
        src?.stop();
        src?.disconnect();
      } catch {
        /* already stopped */
      }
    };

    stopSource(this.bellSource);
    stopSource(this.padSource);
    stopSource(this.bassSource);
    stopSource(this.pluckSource);
    stopSource(this.kickSource);
    stopSource(this.hihatSource);

    this.bellGain?.disconnect();
    this.padGain?.disconnect();
    this.bassGain?.disconnect();
    this.pluckGain?.disconnect();
    this.kickGain?.disconnect();
    this.hihatGain?.disconnect();
    this.masterGain?.disconnect();

    this.bellSource = null;
    this.padSource = null;
    this.bassSource = null;
    this.pluckSource = null;
    this.kickSource = null;
    this.hihatSource = null;

    this.bellGain = null;
    this.padGain = null;
    this.bassGain = null;
    this.pluckGain = null;
    this.kickGain = null;
    this.hihatGain = null;
    this.masterGain = null;

    this.bellBuffer = null;
    this.padBuffer = null;
    this.bassBuffer = null;
    this.pluckBuffer = null;
    this.kickBuffer = null;
    this.hihatBuffer = null;

    this.ctx = null;
    this.built = false;
    this.energy = 0;
    this.targetEnergy = 0;
  }
}

export function isRetroArcadeProfileId(id: string): boolean {
  return id === "retro-arcade";
}
