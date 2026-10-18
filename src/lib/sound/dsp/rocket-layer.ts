/**
 * Rocket Car voice: inspired by the cold-gas-thruster Tesla Roadster (Oct 2026 reveal).
 *
 * Layers (all synthesized, all randomized so nothing repeats):
 * - thrust roar: pink noise through a load-driven low-pass + body band, plus a deep rumble
 * - turbine whine: two detuned tones rising with speed, slow random drift
 * - crackle: sparse random noise ticks whose density follows load
 * - ignition burst: thump + downward-swept roar on hard launches from low speed
 * - cold-gas "pssht": high-passed air bursts on very hard acceleration
 * Lift-off decays slowly (long release tau) so the roar tails off smoothly.
 */
import { createBassEnhancer, getBassEnhancerConfig } from "./bass-enhancer";
import { createLiftOffThunder, ROCKET_LIFTOFF_THUNDER } from "./liftoff-thunder";
import { clamp } from "@/lib/sound/dsp/math";
import { createLoopingNoise, getNoiseBuffer } from "@/lib/sound/dsp/noise";
import { targetParam } from "@/lib/sound/dsp/smoother";
import { audioRandom } from "@/lib/sound/rng";
import type { LayerHandle } from "@/lib/sound/dsp/layers";
import type { MotionFrame } from "@/lib/sound/realism/types";

export interface RocketLayerOpts {
  id: string;
  destination: AudioNode;
  accents?: AudioNode;
  level?: number;
}

function stopSafe(node: AudioScheduledSourceNode) {
  try {
    node.stop();
  } catch {
    /* already stopped */
  }
}

/** Load the rocket reacts to: GPS-derived accel plus the engine's synthetic intent. */
export function rocketLoad(m: Pick<MotionFrame, "accelFast" | "syntheticLoad" | "throttle">): number {
  return clamp(Math.max(m.accelFast * 1.15, m.syntheticLoad * 0.9, m.throttle * 0.7));
}

export function createRocketLayer(ctx: BaseAudioContext, opts: RocketLayerOpts): LayerHandle {
  const level = opts.level ?? 0.6;
  const input = ctx.createGain();
  input.gain.value = 0.0001;
  const output = ctx.createGain();
  output.gain.value = 1;
  input.connect(output);
  const bassCfg = getBassEnhancerConfig("rocket-car");
  const bass = bassCfg ? createBassEnhancer(ctx, opts.destination, bassCfg) : null;
  output.connect(bass ? bass.input : opts.destination);
  // Decel thunder: cut-off thump + lift-off bass bloom (routed through the bass enhancer).
  const thunder = createLiftOffThunder(ctx, input, ROCKET_LIFTOFF_THUNDER);
  const accentOut = ctx.createGain();
  accentOut.gain.value = 1;
  accentOut.connect(opts.accents ?? opts.destination);

  // Thrust roar ---------------------------------------------------------------
  const roarSrc = createLoopingNoise(ctx, "pink", 0.97);
  const roarLp = ctx.createBiquadFilter();
  roarLp.type = "lowpass";
  roarLp.frequency.value = 400;
  roarLp.Q.value = 0.6;
  const roarBody = ctx.createBiquadFilter();
  roarBody.type = "peaking";
  roarBody.frequency.value = 160;
  roarBody.Q.value = 0.9;
  roarBody.gain.value = 6;
  const roarG = ctx.createGain();
  roarG.gain.value = 0.0001;
  const roarPan = ctx.createStereoPanner();
  roarSrc.connect(roarLp).connect(roarBody).connect(roarG).connect(roarPan).connect(input);
  // second, brown-noise rumble bed decorrelates the roar. It is the main idle hum, so it gets
  // its own 11 s buffer (the shared 3 s one was audibly repeating every ~2.9 s).
  const rumbleSrc = createLoopingNoise(ctx, "brown", 1.03, 11);
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = 140;
  const rumbleHp = ctx.createBiquadFilter();
  rumbleHp.type = "highpass";
  rumbleHp.frequency.value = 38;
  const rumbleG = ctx.createGain();
  rumbleG.gain.value = 0.0001;
  rumbleSrc.connect(rumbleHp).connect(rumbleLp).connect(rumbleG).connect(input);
  const subOsc = ctx.createOscillator();
  subOsc.type = "triangle";
  subOsc.frequency.value = 52;
  const subG = ctx.createGain();
  subG.gain.value = 0.0001;
  subOsc.connect(subG).connect(input);

  // Turbine whine -------------------------------------------------------------
  const whineA = ctx.createOscillator();
  whineA.type = "sine";
  const whineB = ctx.createOscillator();
  // Discreet turbine: pure sines an exact octave apart (no detune beating), low-passed.
  whineB.type = "sine";
  whineA.frequency.value = 300;
  whineB.frequency.value = 600;
  const whineBp = ctx.createBiquadFilter();
  whineBp.type = "lowpass";
  whineBp.Q.value = 0.5;
  whineBp.frequency.value = 700;
  const whineG = ctx.createGain();
  whineG.gain.value = 0.0001;
  whineA.connect(whineBp);
  whineB.connect(whineBp);
  whineBp.connect(whineG).connect(input);

  // Crackle bed (random-gated noise) -----------------------------------------
  const crackSrc = createLoopingNoise(ctx, "white", 1.11);
  const crackBp = ctx.createBiquadFilter();
  crackBp.type = "bandpass";
  crackBp.frequency.value = 2600;
  crackBp.Q.value = 1.1;
  const crackG = ctx.createGain();
  crackG.gain.value = 0;
  const crackPan = ctx.createStereoPanner();
  crackSrc.connect(crackBp).connect(crackG).connect(crackPan).connect(input);

  const sources: AudioScheduledSourceNode[] = [roarSrc, rumbleSrc, subOsc, whineA, whineB, crackSrc];
  sources.forEach((s) => s.start());

  const white = getNoiseBuffer(ctx, "white");
  const pink = getNoiseBuffer(ctx, "pink");

  function burst(
    t: number,
    kind: "ignition" | "pssht",
    strength: number,
  ) {
    const src = ctx.createBufferSource();
    src.buffer = kind === "ignition" ? pink : white;
    src.loop = true;
    src.playbackRate.value = 0.85 + audioRandom() * 0.3;
    const offset = audioRandom() * 1.5;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    g.gain.setValueAtTime(0, t);
    if (kind === "ignition") {
      f.type = "lowpass";
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(260, t + 1.6);
      const peak = 0.3 * strength;
      g.gain.linearRampToValueAtTime(peak, t + 0.025);
      g.gain.setTargetAtTime(0, t + 0.08, 0.45);
      p.pan.value = (audioRandom() - 0.5) * 0.3;
      // low thump
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.28 * strength, t + 0.012);
      og.gain.setTargetAtTime(0, t + 0.03, 0.12);
      o.connect(og).connect(accentOut);
      o.start(t);
      o.stop(t + 1.2);
      src.start(t, offset);
      src.stop(t + 3.2);
    } else {
      f.type = "highpass";
      f.Q.value = 0.7;
      f.frequency.setValueAtTime(1800 + audioRandom() * 1400, t);
      f.frequency.linearRampToValueAtTime(900 + audioRandom() * 400, t + 0.5);
      const dur = 0.22 + audioRandom() * 0.35;
      g.gain.linearRampToValueAtTime(0.2 * strength, t + 0.018);
      g.gain.setTargetAtTime(0, t + dur * 0.4, dur * 0.45);
      p.pan.value = (audioRandom() - 0.5) * 1.2;
      src.start(t, offset);
      src.stop(t + dur * 4 + 0.2);
    }
    src.connect(f).connect(g).connect(p).connect(accentOut);
  }

  let muted = false;
  let soloed: boolean | null = null;
  let identity = 1;
  const applyGate = () => {
    output.gain.value = muted || soloed === false ? 0.0001 : identity;
    accentOut.gain.value = muted || soloed === false ? 0 : identity;
  };

  let disposed = false;
  let load = 0;
  let prevLoad = 0;
  let drift = audioRandom() * 10;
  let nextCrackle = 0;
  let nextIgnitionOk = 0;
  let nextPsshtOk = 0;
  let launchArmed = true;

  return {
    id: opts.id,
    input,
    output,
    update(m, t) {
      if (disposed) return;
      const dt = Math.max(0.001, Math.min(0.1, m.dt || 1 / 60));
      const target = rocketLoad(m);
      // quick attack, slow lift-off decay
      const tau = target > load ? 0.18 : 0.9;
      load += (target - load) * (1 - Math.exp(-dt / tau));
      const speed = clamp(m.speedKmh / 160);
      drift += dt * (0.21 + audioRandom() * 0.08);
      const wander = Math.sin(drift) * Math.sin(drift * 0.43 + 1.3);

      // master: always-on idle hum so standstill is audible
      targetParam(input.gain, level, t, 0.3);
      const roar = 0.12 + 0.42 * Math.pow(load, 0.8) + 0.24 * speed;
      targetParam(roarG.gain, roar * (0.94 + 0.06 * wander), t, load > prevLoad ? 0.12 : 0.6);
      targetParam(roarLp.frequency, 280 + 2400 * load + 900 * speed + 120 * wander, t, 0.25);
      targetParam(roarBody.frequency, 120 + 80 * load + 30 * wander, t, 0.5);
      roarPan.pan.setTargetAtTime(0.18 * wander * m.stereoWidth, t, 0.8);
      // Deep thrust is the main effect: rumble + sub swell with acceleration (chest feel).
      targetParam(rumbleG.gain, 0.2 + 0.6 * load, t, load > prevLoad ? 0.15 : 0.7);
      targetParam(subG.gain, 0.04 + 0.12 * load, t, 0.4);
      targetParam(subOsc.frequency, 46 + 14 * load + 6 * speed + 1.5 * wander, t, 0.6);

      // Turbine: smooth and discreet (~-15 dB vs before), capped below ~1.5 kHz, slow glides.
      const whineHz = Math.min(700, 300 + 400 * Math.pow(speed, 0.85) + 40 * load);
      targetParam(whineA.frequency, whineHz, t, 1.5);
      targetParam(whineB.frequency, whineHz * 2, t, 1.5);
      targetParam(whineBp.frequency, Math.min(1500, whineHz * 1.6), t, 1.5);
      targetParam(whineG.gain, 0.002 + 0.012 * Math.pow(speed, 0.9) * (0.7 + 0.3 * load), t, 1.2);
      bass?.setDrive(load, thunder.update(target, m.speedMps, t), t);

      // crackle: random ticks, density with load
      if (t >= nextCrackle) {
        const density = 2 + 26 * load * load; // per second
        nextCrackle = t + (0.3 + audioRandom() * 1.4) / density;
        if (load > 0.12) {
          const a = (0.04 + 0.22 * load) * (0.4 + audioRandom() * 0.6);
          crackG.gain.cancelScheduledValues(t);
          crackG.gain.setValueAtTime(crackG.gain.value, t);
          crackG.gain.linearRampToValueAtTime(a, t + 0.003);
          crackG.gain.setTargetAtTime(0, t + 0.004, 0.006 + audioRandom() * 0.012);
          crackBp.frequency.setValueAtTime(1600 + audioRandom() * 3400, t);
          crackPan.pan.setValueAtTime((audioRandom() - 0.5) * 0.8, t);
        }
      }

      // ignition / launch burst: hard intent from (near) standstill
      if (m.speedKmh < 6) launchArmed = true;
      const rising = target - prevLoad > 0.004 || m.accelFast > 0.35;
      if (launchArmed && m.speedKmh < 28 && target > 0.42 && rising && t >= nextIgnitionOk) {
        burst(t, "ignition", 0.7 + 0.3 * target);
        launchArmed = false;
        nextIgnitionOk = t + 8;
        nextPsshtOk = t + 0.6 + audioRandom() * 0.5;
      }
      // cold-gas pssht on very hard acceleration, randomized cooldown
      if (target > 0.66 && t >= nextPsshtOk) {
        burst(t, "pssht", 0.6 + 0.4 * audioRandom());
        nextPsshtOk = t + 2.5 + audioRandom() * 4;
      }
      prevLoad = target;
    },
    dispose() {
      disposed = true;
      sources.forEach(stopSafe);
      bass?.dispose();
    },
    setMuted(v) {
      muted = v;
      applyGate();
    },
    setSoloed(v) {
      soloed = v;
      applyGate();
    },
    setIdentityGain(gain) {
      identity = gain;
      applyGate();
    },
  };
}


// Thrust bass (reusable) ------------------------------------------------------------
/**
 * The Rocket Car's deep propulsion bed as a reusable overlay for other space voices:
 * brown-noise rumble (38-140 Hz), a sub triangle that rises with thrust and a low, dark roar.
 * Silent at rest (presence 0) so idles stay exactly as authored. Speaker-safe: everything is
 * high-passed at `highPassHz` (>= 32 Hz) and the roar is low-passed (no whistle).
 */
export interface ThrustBassOpts {
  /** Overall level (linear). */
  level: number;
  /** Sub triangle base frequency (Hz); rises ~14 Hz with thrust. */
  subHz?: number;
  /** Rumble low-pass (Hz). */
  rumbleHz?: number;
  /** Roar body centre (Hz). */
  roarHz?: number;
  /** Relative roar level (0..1). */
  roar?: number;
  /** Cruise presence of the rumble while moving with no thrust (0..1). */
  cruise?: number;
  highPassHz?: number;
}

export interface ThrustBass {
  /** load 0..1 (thrust), speed 0..1, presence 0..1 (0 = at rest, silent). */
  update(load: number, speed: number, presence: number, t: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export function createThrustBass(ctx: BaseAudioContext, destination: AudioNode, o: ThrustBassOpts): ThrustBass {
  const out = ctx.createGain();
  out.gain.value = 1;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = Math.max(32, o.highPassHz ?? 34);
  hp.Q.value = 0.7;
  out.connect(hp).connect(destination);

  const rumbleSrc = createLoopingNoise(ctx, "brown", 0.97, 13);
  const rumbleHp = ctx.createBiquadFilter();
  rumbleHp.type = "highpass";
  rumbleHp.frequency.value = 38;
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = o.rumbleHz ?? 140;
  const rumbleG = ctx.createGain();
  rumbleG.gain.value = 0;
  rumbleSrc.connect(rumbleHp).connect(rumbleLp).connect(rumbleG).connect(out);

  const subOsc = ctx.createOscillator();
  subOsc.type = "triangle";
  subOsc.frequency.value = o.subHz ?? 46;
  const subLp = ctx.createBiquadFilter();
  subLp.type = "lowpass";
  subLp.frequency.value = 160;
  const subG = ctx.createGain();
  subG.gain.value = 0;
  subOsc.connect(subLp).connect(subG).connect(out);

  const roarSrc = createLoopingNoise(ctx, "pink", 1.04, 11);
  const roarLp = ctx.createBiquadFilter();
  roarLp.type = "lowpass";
  roarLp.frequency.value = 200;
  roarLp.Q.value = 0.6;
  const roarBody = ctx.createBiquadFilter();
  roarBody.type = "peaking";
  roarBody.frequency.value = o.roarHz ?? 120;
  roarBody.Q.value = 0.9;
  roarBody.gain.value = 5;
  const roarG = ctx.createGain();
  roarG.gain.value = 0;
  roarSrc.connect(roarLp).connect(roarBody).connect(roarG).connect(out);

  const sources: AudioScheduledSourceNode[] = [rumbleSrc, subOsc, roarSrc];
  sources.forEach((s) => s.start());
  const nodes: AudioNode[] = [out, hp, rumbleSrc, rumbleHp, rumbleLp, rumbleG, subOsc, subLp, subG, roarSrc, roarLp, roarBody, roarG];
  const subHz = o.subHz ?? 46;
  const cruise = o.cruise ?? 0.2;
  const roarAmt = o.roar ?? 0.5;
  let drift = audioRandom() * 10;
  let lastT = 0;

  return {
    update(load, speed, presence, t) {
      const dt = lastT > 0 ? Math.min(0.1, Math.max(0.001, t - lastT)) : 1 / 60;
      lastT = t;
      drift += dt * 0.23;
      const wander = Math.sin(drift) * Math.sin(drift * 0.43 + 1.3);
      const p = clamp(presence);
      const l = clamp(load);
      const lv = o.level * p;
      targetParam(rumbleG.gain, lv * (cruise + 0.6 * l + 0.1 * speed), t, l > 0.05 ? 0.15 : 0.6);
      targetParam(subG.gain, lv * (0.03 + 0.14 * l), t, 0.4);
      targetParam(subOsc.frequency, subHz + 14 * l + 5 * speed + 1.5 * wander, t, 0.6);
      targetParam(roarG.gain, lv * roarAmt * (0.06 + 0.3 * Math.pow(l, 0.8) + 0.06 * speed), t, l > 0.05 ? 0.15 : 0.6);
      targetParam(roarLp.frequency, 180 + 320 * l + 60 * wander, t, 0.3);
    },
    setMuted(muted) {
      out.gain.value = muted ? 0 : 1;
    },
    dispose() {
      sources.forEach(stopSafe);
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    },
  };
}

/** Thrust bass as a layer for improved-synth strategies (UFO, Time Machine). */
export function createThrustBassLayer(
  ctx: BaseAudioContext,
  opts: { id: string; destination: AudioNode } & ThrustBassOpts,
): LayerHandle {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.connect(opts.destination);
  const thrust = createThrustBass(ctx, output, opts);
  let load = 0;
  let muted = false;
  let soloed: boolean | null = null;
  let identity = 1;
  const applyGate = () => {
    output.gain.value = muted || soloed === false ? 0 : identity;
  };
  return {
    id: opts.id,
    input,
    output,
    update(m, t) {
      const target = rocketLoad(m);
      const dt = Math.max(0.001, Math.min(0.1, m.dt || 1 / 60));
      load += (target - load) * (1 - Math.exp(-dt / (target > load ? 0.18 : 0.9)));
      // Load only counts once rolling, so a parked idle (incl. throttle blips) stays exactly as authored.
      const presence = Math.max(clamp((m.speedKmh - 2) / 12), clamp(load * 2) * clamp((m.speedKmh - 0.5) / 2));
      thrust.update(load, clamp(m.speedKmh / 160), presence, t);
    },
    dispose() {
      thrust.dispose();
      output.disconnect();
    },
    setMuted(v) {
      muted = v;
      applyGate();
    },
    setSoloed(v) {
      soloed = v;
      applyGate();
    },
    setIdentityGain(gain) {
      identity = gain;
      applyGate();
    },
  };
}
