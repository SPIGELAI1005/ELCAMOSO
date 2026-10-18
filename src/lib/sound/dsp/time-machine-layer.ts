/**
 * Time Machine voice: temporal flux, crystalline hum, and jump-arc events.
 *
 * Layers (all synthesized, lightly randomized):
 * - flux bed: brown/pink noise through a load-driven band, stereo wander
 * - chrono drone: two detuned low tones that climb with energy
 * - crystal shimmer: high partials that bloom with speed
 * - tick lattice: sparse clockwork clicks whose density follows load
 * - jump arc: upward chirp + whoosh on hard launches from low speed
 */
import { createBassEnhancer, getBassEnhancerConfig } from "./bass-enhancer";
import { createLiftOffThunder, TIME_MACHINE_LIFTOFF_THUNDER } from "./liftoff-thunder";
import { clamp } from "@/lib/sound/dsp/math";
import { createLoopingNoise, getNoiseBuffer } from "@/lib/sound/dsp/noise";
import { targetParam } from "@/lib/sound/dsp/smoother";
import { audioRandom } from "@/lib/sound/rng";
import type { LayerHandle } from "@/lib/sound/dsp/layers";
import type { MotionFrame } from "@/lib/sound/realism/types";

export interface TimeMachineLayerOpts {
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

/** Energy the time machine reacts to: accel + synthetic load + throttle intent. */
export function timeMachineLoad(
  m: Pick<MotionFrame, "accelFast" | "syntheticLoad" | "throttle">,
): number {
  return clamp(Math.max(m.accelFast * 1.05, m.syntheticLoad * 0.95, m.throttle * 0.75));
}

export function createTimeMachineLayer(
  ctx: BaseAudioContext,
  opts: TimeMachineLayerOpts,
): LayerHandle {
  const level = opts.level ?? 0.95;
  const input = ctx.createGain();
  input.gain.value = 0.0001;
  const output = ctx.createGain();
  output.gain.value = 1;
  input.connect(output);
  const bassCfg = getBassEnhancerConfig("time-machine");
  const bass = bassCfg ? createBassEnhancer(ctx, opts.destination, bassCfg) : null;
  output.connect(bass ? bass.input : opts.destination);
  // Decel thunder: cut-off thump + lift-off bass bloom (routed through the bass enhancer).
  const thunder = createLiftOffThunder(ctx, input, TIME_MACHINE_LIFTOFF_THUNDER);
  const accentOut = ctx.createGain();
  accentOut.gain.value = 1;
  accentOut.connect(opts.accents ?? opts.destination);

  // Flux bed -----------------------------------------------------------------
  const fluxSrc = createLoopingNoise(ctx, "pink", 0.91);
  const fluxBp = ctx.createBiquadFilter();
  fluxBp.type = "bandpass";
  fluxBp.frequency.value = 420;
  fluxBp.Q.value = 0.55;
  const fluxG = ctx.createGain();
  fluxG.gain.value = 0.0001;
  const fluxPan = ctx.createStereoPanner();
  fluxSrc.connect(fluxBp).connect(fluxG).connect(fluxPan).connect(input);

  const rumbleSrc = createLoopingNoise(ctx, "brown", 1.07);
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = 110;
  const rumbleG = ctx.createGain();
  rumbleG.gain.value = 0.0001;
  rumbleSrc.connect(rumbleLp).connect(rumbleG).connect(input);

  // Chrono drone -------------------------------------------------------------
  const droneA = ctx.createOscillator();
  droneA.type = "triangle";
  droneA.frequency.value = 55;
  const droneB = ctx.createOscillator();
  droneB.type = "sine";
  droneB.frequency.value = 82.5;
  const droneLp = ctx.createBiquadFilter();
  droneLp.type = "lowpass";
  droneLp.frequency.value = 520;
  droneLp.Q.value = 0.7;
  const droneG = ctx.createGain();
  droneG.gain.value = 0.0001;
  droneA.connect(droneLp);
  droneB.connect(droneLp);
  droneLp.connect(droneG).connect(input);

  // Crystal shimmer ----------------------------------------------------------
  const crystalA = ctx.createOscillator();
  crystalA.type = "sine";
  crystalA.frequency.value = 1480;
  const crystalB = ctx.createOscillator();
  crystalB.type = "sine";
  crystalB.frequency.value = 2220;
  const crystalHp = ctx.createBiquadFilter();
  crystalHp.type = "highpass";
  crystalHp.frequency.value = 900;
  const crystalG = ctx.createGain();
  crystalG.gain.value = 0.0001;
  const crystalPan = ctx.createStereoPanner();
  crystalA.connect(crystalHp);
  crystalB.connect(crystalHp);
  crystalHp.connect(crystalG).connect(crystalPan).connect(input);

  // Tick lattice -------------------------------------------------------------
  const tickSrc = createLoopingNoise(ctx, "white", 1.19);
  const tickBp = ctx.createBiquadFilter();
  tickBp.type = "bandpass";
  tickBp.frequency.value = 3200;
  tickBp.Q.value = 4.5;
  const tickG = ctx.createGain();
  tickG.gain.value = 0;
  const tickPan = ctx.createStereoPanner();
  tickSrc.connect(tickBp).connect(tickG).connect(tickPan).connect(accentOut);

  const sources: AudioScheduledSourceNode[] = [
    fluxSrc,
    rumbleSrc,
    droneA,
    droneB,
    crystalA,
    crystalB,
    tickSrc,
  ];
  sources.forEach((s) => s.start());

  const white = getNoiseBuffer(ctx, "white");
  const pink = getNoiseBuffer(ctx, "pink");

  function jumpArc(t: number, strength: number) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(2400 + audioRandom() * 800, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.85);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.22 * strength, t + 0.02);
    og.gain.setTargetAtTime(0, t + 0.14, 0.22);
    o.connect(og).connect(accentOut);
    o.start(t);
    o.stop(t + 1.4);

    const src = ctx.createBufferSource();
    src.buffer = pink;
    src.loop = true;
    src.playbackRate.value = 0.9 + audioRandom() * 0.35;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.18);
    f.frequency.exponentialRampToValueAtTime(280, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18 * strength, t + 0.03);
    g.gain.setTargetAtTime(0, t + 0.2, 0.35);
    const p = ctx.createStereoPanner();
    p.pan.value = (audioRandom() - 0.5) * 0.9;
    src.connect(f).connect(g).connect(p).connect(accentOut);
    src.start(t, audioRandom() * 1.2);
    src.stop(t + 2.2);

    // Soft sparkle trail
    const spark = ctx.createBufferSource();
    spark.buffer = white;
    spark.loop = true;
    const sh = ctx.createBiquadFilter();
    sh.type = "highpass";
    sh.frequency.value = 2800 + audioRandom() * 1200;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.06 * strength, t + 0.05);
    sg.gain.setTargetAtTime(0, t + 0.25, 0.4);
    spark.connect(sh).connect(sg).connect(accentOut);
    spark.start(t, audioRandom());
    spark.stop(t + 1.6);
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
  let nextTick = 0;
  let nextJumpOk = 0;
  let jumpArmed = true;

  return {
    id: opts.id,
    input,
    output,
    update(m, t) {
      if (disposed) return;
      const dt = Math.max(0.001, Math.min(0.1, m.dt || 1 / 60));
      const target = timeMachineLoad(m);
      const tau = target > load ? 0.16 : 0.75;
      load += (target - load) * (1 - Math.exp(-dt / tau));
      const speed = clamp(m.speedKmh / 160);
      drift += dt * (0.28 + audioRandom() * 0.1);
      const wander = Math.sin(drift) * Math.sin(drift * 0.37 + 0.9);

      targetParam(input.gain, level, t, 0.28);
      const bed = 0.1 + 0.38 * Math.pow(load, 0.85) + 0.22 * speed;
      targetParam(fluxG.gain, bed * (0.92 + 0.08 * wander), t, load > prevLoad ? 0.12 : 0.55);
      targetParam(fluxBp.frequency, 280 + 1800 * load + 700 * speed + 90 * wander, t, 0.28);
      fluxPan.pan.setTargetAtTime(0.32 * wander * m.stereoWidth, t, 0.7);
      targetParam(rumbleG.gain, 0.14 + 0.48 * load, t, load > prevLoad ? 0.14 : 0.65);

      const droneHz = 48 + 36 * load + 22 * speed + 2.5 * wander;
      targetParam(droneA.frequency, droneHz, t, 0.55);
      targetParam(droneB.frequency, droneHz * 1.5, t, 0.55);
      targetParam(droneLp.frequency, 380 + 900 * load + 400 * speed, t, 0.4);
      targetParam(droneG.gain, 0.08 + 0.22 * load + 0.1 * speed, t, 0.35);

      const crystalHz = 1100 + 1600 * Math.pow(speed, 0.9) + 400 * load;
      targetParam(crystalA.frequency, crystalHz, t, 0.9);
      targetParam(crystalB.frequency, crystalHz * 1.5 + 40 * wander, t, 0.9);
      targetParam(
        crystalG.gain,
        0.004 + 0.055 * Math.pow(speed, 0.85) * (0.55 + 0.45 * load),
        t,
        0.8,
      );
      crystalPan.pan.setTargetAtTime(-0.25 * wander * m.stereoWidth, t, 0.9);
      bass?.setDrive(load, thunder.update(target, m.speedMps, t), t);

      if (t >= nextTick) {
        const density = 1.4 + 18 * load * load;
        nextTick = t + (0.25 + audioRandom() * 1.1) / density;
        if (load > 0.1) {
          const a = (0.03 + 0.16 * load) * (0.45 + audioRandom() * 0.55);
          tickG.gain.cancelScheduledValues(t);
          tickG.gain.setValueAtTime(tickG.gain.value, t);
          tickG.gain.linearRampToValueAtTime(a, t + 0.002);
          tickG.gain.setTargetAtTime(0, t + 0.003, 0.005 + audioRandom() * 0.01);
          tickBp.frequency.setValueAtTime(2200 + audioRandom() * 2800, t);
          tickPan.pan.setValueAtTime((audioRandom() - 0.5) * 1.1, t);
        }
      }

      if (m.speedKmh < 6) jumpArmed = true;
      const rising = target - prevLoad > 0.004 || m.accelFast > 0.35;
      if (jumpArmed && m.speedKmh < 30 && target > 0.4 && rising && t >= nextJumpOk) {
        jumpArc(t, 0.7 + 0.3 * target);
        jumpArmed = false;
        nextJumpOk = t + 7.5;
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
