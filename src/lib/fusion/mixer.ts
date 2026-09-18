import type { FusionMixGains } from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Perceptual Machine ↔ Music crossfade.
 * Not linear - approximate equal-power with headroom so both can sit together.
 *
 * mix 0 → machine dominant; mix 1 → music dominant.
 * Default 0.6 ≈ 40% machine / 60% music intent.
 */
export function perceptualFusionGains(mix: number): FusionMixGains {
  const m = clamp01(mix);
  const machineLin = 1 - m;
  const musicLin = m;
  const machine = Math.sqrt(machineLin) * 0.7;
  const music = Math.sqrt(musicLin) * 0.78;
  // Atmosphere bus: slight bed under both; peaks when either side is mid-mix
  const atmosphere = 0.12 + 0.18 * (1 - Math.abs(m - 0.5) * 2);
  // Event accents stay quieter than body
  const events = 0.45 + musicLin * 0.2;
  return { machine, music, atmosphere, events };
}

/**
 * Dynamic accommodation: engine more present on demand/accel;
 * at musical climax leave a little space for drivetrain without dance-style pumping.
 */
export function machinePresenceScale(opts: {
  driverDemand: number;
  tension: number;
  movementState: string;
  softPump: boolean;
}): number {
  const demandBoost = 1 + clamp01(opts.driverDemand) * 0.28 + clamp01(opts.tension) * 0.12;
  let climax = 1;
  if (opts.movementState === "peak" || opts.movementState === "energetic") {
    climax = opts.softPump ? 0.82 : 0.92;
  }
  return demandBoost * climax;
}

export function musicSpaceScale(opts: { movementState: string; driverDemand: number }): number {
  // Strong tip-in: leave a hair more room for machine without ducking music hard
  if (opts.driverDemand > 0.75) return 0.94;
  if (opts.movementState === "peak") return 1.05;
  return 1;
}

export interface FusionMixer {
  machine: GainNode;
  music: GainNode;
  atmosphere: GainNode;
  events: GainNode;
  output: GainNode;
  setGains(gains: FusionMixGains, audioTime: number): void;
  dispose(): void;
}

export function createFusionMixer(ctx: BaseAudioContext, destination: AudioNode): FusionMixer {
  const output = ctx.createGain();
  output.gain.value = 0.92;
  output.connect(destination);

  const machine = ctx.createGain();
  const music = ctx.createGain();
  const atmosphere = ctx.createGain();
  const events = ctx.createGain();

  machine.gain.value = 0.0001;
  music.gain.value = 0.0001;
  atmosphere.gain.value = 0.0001;
  events.gain.value = 0.0001;

  machine.connect(output);
  music.connect(output);
  atmosphere.connect(output);
  events.connect(output);

  return {
    machine,
    music,
    atmosphere,
    events,
    output,
    setGains(gains, audioTime) {
      const tau = 0.09;
      try {
        machine.gain.setTargetAtTime(Math.max(0.0001, gains.machine), audioTime, tau);
        music.gain.setTargetAtTime(Math.max(0.0001, gains.music), audioTime, tau);
        atmosphere.gain.setTargetAtTime(Math.max(0.0001, gains.atmosphere), audioTime, tau);
        events.gain.setTargetAtTime(Math.max(0.0001, gains.events), audioTime, tau);
      } catch {
        /* ignore scheduling races during teardown */
      }
    },
    dispose() {
      for (const n of [machine, music, atmosphere, events, output]) {
        try {
          n.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    },
  };
}
