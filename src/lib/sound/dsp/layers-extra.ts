/**
 * Extra DSP primitives for the 25-profile expansion.
 * Mobile-safe: few continuous oscillators, event-based where possible.
 */

import { clamp, lerp, softGate, smoothstep } from "@/lib/sound/dsp/math";
import { createLoopingNoise } from "@/lib/sound/dsp/noise";
import { targetParam } from "@/lib/sound/dsp/smoother";
import { createDriveShaper } from "@/lib/sound/dsp/waveshaper";
import { audioRandom } from "@/lib/sound/rng";
import type { LayerHandle } from "@/lib/sound/dsp/layers";

interface LayerBaseOpts {
  id: string;
  destination: AudioNode;
  level?: number;
  pan?: number;
}

function stopSafe(node: { stop: (when?: number) => void }) {
  try {
    node.stop();
  } catch {
    /* already stopped */
  }
}

function chain(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
  source: AudioNode,
): { gain: GainNode; handle: LayerHandle } {
  const gain = ctx.createGain();
  gain.gain.value = opts.level ?? 0.0001;
  const panner = ctx.createStereoPanner();
  panner.pan.value = opts.pan ?? 0;
  const output = ctx.createGain();
  output.gain.value = 1;
  source.connect(gain);
  gain.connect(panner);
  panner.connect(output);
  output.connect(opts.destination);
  let muted = false;
  let soloed: boolean | null = null;
  const apply = () => {
    output.gain.value = muted || soloed === false ? 0.0001 : 1;
  };
  return {
    gain,
    handle: {
      id: opts.id,
      input: gain,
      output,
      update: () => undefined,
      dispose: () => undefined,
      setMuted(m) {
        muted = m;
        apply();
      },
      setSoloed(s) {
        soloed = s;
        apply();
      },
    },
  };
}

const PENT = [0, 2, 4, 7, 9];

export function createHeartbeatLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, handle } = chain(ctx, opts, bus);
  let next = 0;
  let bpm = 62;
  let disposed = false;

  function beat(at: number, tone: number, level: number, which: "lub" | "dub") {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = "sine";
    const f0 = which === "lub" ? tone : tone * 0.78;
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, f0 * 0.55), at + 0.08);
    lp.type = "lowpass";
    lp.frequency.value = which === "lub" ? 180 : 140;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + (which === "lub" ? 0.12 : 0.16));
    osc.connect(lp);
    lp.connect(g);
    g.connect(bus);
    osc.start(at);
    osc.stop(at + 0.2);
  }

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const intensity = clamp(
        m.throttleFast * 0.55 + m.accelFast * 0.7 + Math.abs(m.jerk) * 0.25 + m.speedSlow * 0.15,
      );
      const targetBpm = 58 + intensity * 48;
      bpm += (targetBpm - bpm) * (m.dt / 1.4);
      const interval = 60 / Math.max(50, bpm);
      if (next < t) next = t;
      while (next < t + 0.2) {
        const amp = (opts.level ?? 0.35) * (0.45 + intensity * 0.7);
        beat(next, 78, amp, "lub");
        beat(next + interval * 0.28, 70, amp * 0.85, "dub");
        next += interval;
      }
      targetParam(gain.gain, softGate(0.85), t, 0.2);
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createArcadeLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { baseHz?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const toneLp = ctx.createBiquadFilter();
  toneLp.type = "lowpass";
  toneLp.frequency.value = 2200;
  toneLp.Q.value = 0.7;
  const sq = ctx.createOscillator();
  sq.type = "square";
  sq.frequency.value = opts.baseHz ?? 110;
  const sqG = ctx.createGain();
  sqG.gain.value = 0.12;
  const tri = ctx.createOscillator();
  tri.type = "triangle";
  tri.frequency.value = (opts.baseHz ?? 110) * 1.5;
  const triG = ctx.createGain();
  triG.gain.value = 0.08;
  const noise = createLoopingNoise(ctx, "white", 1);
  const nHp = ctx.createBiquadFilter();
  nHp.type = "bandpass";
  nHp.frequency.value = 1800;
  nHp.Q.value = 1.2;
  const nG = ctx.createGain();
  nG.gain.value = 0.0001;
  sq.connect(sqG);
  sqG.connect(toneLp);
  tri.connect(triG);
  triG.connect(toneLp);
  toneLp.connect(bus);
  noise.connect(nHp);
  nHp.connect(nG);
  nG.connect(bus);
  sq.start();
  tri.start();
  noise.start();
  const { gain, handle } = chain(ctx, opts, bus);
  let disposed = false;
  let lastAccel = 0;
  let pulsePhase = audioRandom() * 10;

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const reg = Math.floor(m.speedSlow * 4);
      const degree = PENT[Math.floor(m.speedSlow * 20) % PENT.length]!;
      const base = (opts.baseHz ?? 110) * Math.pow(2, reg / 12) * Math.pow(2, degree / 12);
      targetParam(sq.frequency, clamp(base, 80, 640), t, 0.05);
      targetParam(tri.frequency, clamp(base * 1.5, 100, 880), t, 0.05);
      // Phone-safe ceiling keeps the 8-bit character without piercing HF.
      targetParam(toneLp.frequency, 1100 + m.speedSlow * 600 + m.accelFast * 280, t, 0.14);
      pulsePhase += m.dt * (3.2 + m.speedSlow * 5.5);
      // Soft PWM feel without hard HF square edge.
      const duty = 0.55 + 0.35 * Math.abs(Math.sin(pulsePhase));
      const pulse = 0.07 + m.speedSlow * 0.1;
      targetParam(sqG.gain, softGate(pulse * duty * 0.7), t, 0.05);
      targetParam(triG.gain, softGate(pulse * 0.9), t, 0.06);
      if (m.accelFast > 0.55 && lastAccel <= 0.55) sq.frequency.setValueAtTime(base * 1.25, t);
      if (m.regen > 0.45) sq.frequency.setValueAtTime(base * 0.75, t);
      lastAccel = m.accelFast;
      targetParam(nG.gain, softGate(m.accelFast > 0.4 ? 0.035 : 0.008), t, 0.05);
      targetParam(gain.gain, softGate((opts.level ?? 0.35) * (0.35 + m.speedSlow * 0.5)), t, 0.08);
    },
    dispose() {
      disposed = true;
      stopSafe(sq);
      stopSafe(tri);
      stopSafe(noise);
    },
  };
}

export function createSynthwaveLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { rootHz?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const root = opts.rootHz ?? 65;
  const ratios = [1, 1.5, 2, 2.5];
  const voices = ratios.map((r, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? "sawtooth" : "triangle";
    osc.frequency.value = root * r;
    const g = ctx.createGain();
    g.gain.value = 0.08 / (i + 1);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    osc.connect(lp);
    lp.connect(g);
    g.connect(bus);
    osc.start();
    return { osc, g, lp, r };
  });
  const bass = ctx.createOscillator();
  bass.type = "sine";
  bass.frequency.value = root;
  const bassG = ctx.createGain();
  bassG.gain.value = 0.0001;
  bass.connect(bassG);
  bassG.connect(bus);
  bass.start();
  const { gain, handle } = chain(ctx, opts, bus);
  let disposed = false;
  let arp = 0;
  let filterEnv = 700;

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      // Slower arp + long filter glide so the pad evolves instead of chattering.
      arp += m.dt * (0.75 + m.speedSlow * 2.4 + m.accelFast * 0.6);
      const note = PENT[Math.floor(arp) % PENT.length]!;
      const targetCut =
        420 + m.speedSlow * 2000 + m.throttleFast * 500 + m.accelFast * 450 - m.regen * 350;
      filterEnv += (targetCut - filterEnv) * Math.min(1, m.dt / 1.6);
      voices.forEach(({ osc, g, lp, r }, i) => {
        const hz = root * r * Math.pow(2, note / 12);
        targetParam(osc.frequency, hz, t, 0.22);
        targetParam(lp.frequency, filterEnv * (1 - i * 0.08), t, 0.45);
        targetParam(
          g.gain,
          softGate((0.065 / (i + 1)) * (0.45 + m.speedSlow * 0.5 + m.accelFast * 0.12)),
          t,
          0.28,
        );
      });
      const pulse = 0.55 + 0.45 * Math.sin(t * (1.1 + m.speedSlow * 0.7));
      targetParam(bass.frequency, root * (0.5 + Math.floor(m.speedSlow * 2) * 0.25), t, 0.14);
      targetParam(bassG.gain, softGate((0.09 + m.accelFast * 0.1) * pulse), t, 0.1);
      targetParam(gain.gain, softGate((opts.level ?? 0.4) * (0.38 + m.speedSlow * 0.42)), t, 0.25);
    },
    dispose() {
      disposed = true;
      voices.forEach(({ osc }) => stopSafe(osc));
      stopSafe(bass);
    },
  };
}

/**
 * Recognizable deep bass = discrete 808-style booms, not a continuous drone.
 *
 * Research (sub-bass / bass-house practice):
 * - Pure sine sub + mid presence layer (phones hear ~100–160 Hz)
 * - Short click transient so each hit reads without a subwoofer
 * - Pitch drop on the hit (classic 808 envelope)
 * - Clear pulse rate that pumps with motion (sidechain-like gaps between hits)
 * - Between pulses nearly silent so the boom is the character
 */
export function createDeepBassPulseLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
): LayerHandle {
  const bus = ctx.createGain();
  // Tiny residual bed so cabin never goes fully dead between hits.
  const bed = ctx.createOscillator();
  bed.type = "sine";
  bed.frequency.value = 55;
  const bedG = ctx.createGain();
  bedG.gain.value = 0.0001;
  bed.connect(bedG);
  bedG.connect(bus);
  bed.start();

  const { gain, handle } = chain(ctx, opts, bus);
  let next = ctx.currentTime + 0.08;
  let bpm = 72;
  let disposed = false;

  function firePulse(at: number, amp: number, fundamental: number, long: boolean) {
    const dur = long ? 0.42 : 0.28;

    // Sub sine with 808 pitch drop
    const sub = ctx.createOscillator();
    const subLp = ctx.createBiquadFilter();
    const subG = ctx.createGain();
    sub.type = "sine";
    subLp.type = "lowpass";
    subLp.frequency.value = 140;
    sub.frequency.setValueAtTime(fundamental * 1.15, at);
    sub.frequency.exponentialRampToValueAtTime(Math.max(38, fundamental * 0.72), at + dur * 0.85);
    subG.gain.setValueAtTime(0.0001, at);
    subG.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), at + 0.01);
    subG.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    sub.connect(subLp);
    subLp.connect(subG);
    subG.connect(bus);
    sub.start(at);
    sub.stop(at + dur + 0.05);

    // Phone / cabin presence (100–170 Hz) — this is what makes the pulse audible
    const mid = ctx.createOscillator();
    const midLp = ctx.createBiquadFilter();
    const midG = ctx.createGain();
    mid.type = "triangle";
    midLp.type = "lowpass";
    midLp.frequency.value = 260;
    const midHz = fundamental * 1.85;
    mid.frequency.setValueAtTime(midHz * 1.08, at);
    mid.frequency.exponentialRampToValueAtTime(Math.max(70, midHz * 0.75), at + dur * 0.7);
    midG.gain.setValueAtTime(0.0001, at);
    midG.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.7), at + 0.008);
    midG.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.75);
    mid.connect(midLp);
    midLp.connect(midG);
    midG.connect(bus);
    mid.start(at);
    mid.stop(at + dur + 0.05);

    // Soft click so the attack is unmistakable on small speakers
    const click = ctx.createOscillator();
    const clickG = ctx.createGain();
    click.type = "sine";
    click.frequency.setValueAtTime(420, at);
    click.frequency.exponentialRampToValueAtTime(180, at + 0.04);
    clickG.gain.setValueAtTime(0.0001, at);
    clickG.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.22), at + 0.004);
    clickG.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    click.connect(clickG);
    clickG.connect(bus);
    click.start(at);
    click.stop(at + 0.07);
  }

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const intensity = clamp(
        m.throttleFast * 0.7 + Math.max(0, m.accelFast) * 0.95 + m.speedSlow * 0.45,
      );
      // Idle still pulses slowly so the title is obvious parked / at light throttle.
      const targetBpm = 58 + intensity * 72;
      bpm += (targetBpm - bpm) * Math.min(1, m.dt / 0.55);
      const interval = 60 / Math.max(52, bpm);
      if (next < t) next = t;
      const horizon = t + 0.22;
      while (next < horizon) {
        const amp = (opts.level ?? 0.7) * (0.55 + intensity * 0.85);
        const fund = 58 + intensity * 18;
        firePulse(next, amp, fund, intensity > 0.55);
        // Occasional double-hit under hard accel (pumping EDM feel)
        if (intensity > 0.7 && audioRandom() > 0.55) {
          firePulse(next + interval * 0.48, amp * 0.65, fund * 0.94, false);
        }
        next += interval;
      }

      targetParam(bed.frequency, 48 + intensity * 12, t, 0.2);
      targetParam(bedG.gain, softGate(0.03 + intensity * 0.04), t, 0.25);
      targetParam(gain.gain, softGate(0.9 + intensity * 0.25), t, 0.15);
    },
    dispose() {
      disposed = true;
      stopSafe(bed);
    },
  };
}

export function createVtwinPulseLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { tone?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, handle } = chain(ctx, opts, bus);
  let next = 0;
  let stroke = 0;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const rpm = Math.max(700, m.virtualRpm || 900 + m.speedSlow * 3500);
      const revHz = rpm / 60;
      const baseInterval = 1 / Math.max(1.5, revHz * 2);
      if (next < t) next = t;
      while (next < t + 0.15) {
        const at = next;
        const uneven = stroke % 2 === 0 ? 1 : 0.72;
        const strength =
          (opts.level ?? 0.4) *
          (0.5 + Math.pow(m.throttleFast, 1.2) * 0.7) *
          uneven *
          (0.85 + audioRandom() * 0.2);
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = "sine";
        const f0 = (opts.tone ?? 95) * (0.9 + audioRandom() * 0.15);
        osc.frequency.setValueAtTime(f0, at);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, at + 0.08);
        lp.type = "lowpass";
        lp.frequency.value = 320 + m.throttleFast * 280;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength), at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        osc.connect(lp);
        lp.connect(g);
        g.connect(bus);
        osc.start(at);
        osc.stop(at + 0.15);
        stroke += 1;
        next += baseInterval * (stroke % 2 === 0 ? 1.35 : 0.72) * (0.97 + audioRandom() * 0.06);
      }
      targetParam(gain.gain, softGate(0.8), t, 0.15);
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createTrackCadenceLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { tone?: number; midKnock?: boolean },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, handle } = chain(ctx, opts, bus);
  let next = 0;
  let knock = 0;
  let disposed = false;
  const midKnock = !!opts.midKnock;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const rate = 1.5 + m.speedSlow * 14;
      const interval = 1 / Math.max(0.5, rate);
      if (next < t) next = t + audioRandom() * interval;
      while (next < t + 0.18) {
        const at = next;
        const amp = (opts.level ?? 0.35) * (0.3 + m.speedSlow * 0.8) * (0.7 + audioRandom() * 0.4);
        const src = createLoopingNoise(ctx, "white", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = (opts.tone ?? 280) * (0.85 + audioRandom() * 0.35);
        bp.Q.value = 5;
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();
        pan.pan.value = (audioRandom() - 0.5) * 0.8;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        src.connect(bp);
        bp.connect(g);
        g.connect(pan);
        pan.connect(bus);
        src.start(at);
        src.stop(at + 0.08);
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 70 + audioRandom() * 30;
        og.gain.setValueAtTime(0.0001, at);
        og.gain.exponentialRampToValueAtTime(amp * 0.5, at + 0.005);
        og.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
        osc.connect(og);
        og.connect(bus);
        osc.start(at);
        osc.stop(at + 0.12);

        if (midKnock && audioRandom() < 0.45 + m.throttleFast * 0.35) {
          const kn = createLoopingNoise(ctx, "pink", 1);
          const kbp = ctx.createBiquadFilter();
          kbp.type = "bandpass";
          kbp.frequency.value = 520 + audioRandom() * 380;
          kbp.Q.value = 3.2;
          const kg = ctx.createGain();
          kg.gain.setValueAtTime(0.0001, at);
          kg.gain.exponentialRampToValueAtTime(amp * 0.55, at + 0.003);
          kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
          kn.connect(kbp);
          kbp.connect(kg);
          kg.connect(bus);
          kn.start(at);
          kn.stop(at + 0.09);
        }

        next += interval * (0.85 + audioRandom() * 0.35);
      }

      // Sparse slower hull knocks under load.
      if (midKnock) {
        if (knock < t) knock = t + 0.4 + audioRandom() * 0.8;
        while (knock < t + 0.15 && m.speedSlow > 0.08) {
          const at = knock;
          const amp =
            (opts.level ?? 0.35) * (0.2 + m.throttleFast * 0.45 + m.speedSlow * 0.25);
          const osc = ctx.createOscillator();
          const lp = ctx.createBiquadFilter();
          const g = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(140 + audioRandom() * 40, at);
          osc.frequency.exponentialRampToValueAtTime(70, at + 0.12);
          lp.type = "lowpass";
          lp.frequency.value = 480;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(amp * 0.4, at + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
          osc.connect(lp);
          lp.connect(g);
          g.connect(bus);
          osc.start(at);
          osc.stop(at + 0.18);
          knock += (0.55 + audioRandom() * 0.9) / (0.6 + m.speedSlow);
        }
      }

      targetParam(gain.gain, softGate(0.85), t, 0.2);
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createHydraulicLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
): LayerHandle {
  const whine = ctx.createOscillator();
  whine.type = "sawtooth";
  whine.frequency.value = 280;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 6;
  const hiss = createLoopingNoise(ctx, "white", 1);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2200;
  const wg = ctx.createGain();
  const hg = ctx.createGain();
  wg.gain.value = 0.0001;
  hg.gain.value = 0.0001;
  const bus = ctx.createGain();
  whine.connect(bp);
  bp.connect(wg);
  wg.connect(bus);
  hiss.connect(hp);
  hp.connect(hg);
  hg.connect(bus);
  whine.start();
  hiss.start();
  const { gain, handle } = chain(ctx, opts, bus);
  let pump = 0;
  let phase = audioRandom() * 20;
  let wander = 0;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const demand = clamp(m.throttleFast * 0.75 + m.accelFast * 0.95 + m.speedSlow * 0.15);
      pump += (demand - pump) * (m.dt / 0.32);
      // Irregular pump period: random-walk rate instead of fixed LFO.
      wander += (audioRandom() - 0.5) * m.dt * 2.8;
      wander *= 0.98;
      const rate = 1.6 + pump * 3.2 + wander * 1.1;
      phase += m.dt * Math.max(0.7, rate);
      const mod = 0.72 + 0.28 * Math.sin(phase * Math.PI * 2);
      targetParam(whine.frequency, 220 + pump * 520 + Math.sin(phase * 0.37) * 28, t, 0.1);
      targetParam(bp.frequency, 580 + pump * 950, t, 0.12);
      targetParam(wg.gain, softGate(pump * 0.28 * mod), t, 0.1);
      targetParam(hg.gain, softGate(pump * 0.14 * (0.65 + 0.35 * mod)), t, 0.12);
      targetParam(gain.gain, softGate((opts.level ?? 0.42) * (0.35 + pump * 1.15)), t, 0.12);
    },
    dispose() {
      disposed = true;
      stopSafe(whine);
      stopSafe(hiss);
    },
  };
}

export function createCreatureBreathLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { mythic?: boolean; dark?: boolean },
): LayerHandle {
  const mythic = !!opts.mythic;
  const dark = !!opts.dark;
  const bus = ctx.createGain();
  const breath = createLoopingNoise(ctx, dark ? "brown" : "pink", 0.9);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = dark ? 160 : 260;
  bp.Q.value = dark ? 0.55 : 0.75;
  const bg = ctx.createGain();
  breath.connect(bp);
  bp.connect(bg);
  bg.connect(bus);
  breath.start();

  const growl = ctx.createOscillator();
  growl.type = "sawtooth";
  growl.frequency.value = dark ? 42 : 52;
  const glp = ctx.createBiquadFilter();
  glp.type = "lowpass";
  glp.frequency.value = dark ? 160 : 200;
  const gg = ctx.createGain();
  gg.gain.value = 0.0001;
  const drive = createDriveShaper(ctx, dark ? 0.42 : 0.32);
  growl.connect(glp);
  glp.connect(drive);
  drive.connect(gg);
  gg.connect(bus);
  growl.start();

  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 36;
  const subG = ctx.createGain();
  subG.gain.value = 0.0001;
  sub.connect(subG);
  subG.connect(bus);
  sub.start();

  const wing = createLoopingNoise(ctx, "white", 1.1);
  const wingHp = ctx.createBiquadFilter();
  wingHp.type = "highpass";
  wingHp.frequency.value = mythic ? 900 : 1600;
  const wingG = ctx.createGain();
  wingG.gain.value = 0.0001;
  wing.connect(wingHp);
  wingHp.connect(wingG);
  wingG.connect(bus);
  wing.start();

  const { gain, handle } = chain(ctx, opts, bus);
  let disposed = false;
  let phase = audioRandom() * 10;
  let phase2 = audioRandom() * 7;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      // Slow primary breath + quieter secondary so it never feels like a siren.
      phase += m.dt * (0.22 + m.speedSlow * 0.28 + m.accelFast * 0.18);
      phase2 += m.dt * (0.11 + m.speedSlow * 0.08);
      const inhale = 0.55 + 0.35 * Math.sin(phase) + 0.1 * Math.sin(phase2 * 1.7);
      const idle = dark ? 0.14 : 0.1;
      const breathLevel =
        idle + inhale * (dark ? 0.14 : 0.2) + m.accelFast * 0.22 + m.throttleFast * 0.08;
      targetParam(bg.gain, softGate(breathLevel), t, 0.28);
      targetParam(
        bp.frequency,
        (dark ? 140 : 200) + inhale * (dark ? 70 : 110) + m.accelFast * 90 - m.regen * 40,
        t,
        0.32,
      );

      const growlBase = dark ? 38 : 48;
      targetParam(
        growl.frequency,
        growlBase + m.accelFast * (dark ? 28 : 36) + m.speedSlow * 14 - m.regen * 12,
        t,
        0.22,
      );
      // Always some presence at idle; open hard on throttle.
      const growlAmt =
        (dark ? 0.08 : 0.05) +
        m.accelFast * 0.28 +
        m.throttleFast * 0.14 +
        m.speedSlow * 0.06 -
        m.regen * 0.06;
      targetParam(gg.gain, softGate(Math.max(0.03, growlAmt)), t, 0.18);

      targetParam(sub.frequency, (dark ? 32 : 36) + m.speedSlow * 10, t, 0.35);
      targetParam(
        subG.gain,
        softGate((dark ? 0.1 : 0.05) + m.accelFast * 0.12 + m.bodyLevel * 0.06),
        t,
        0.25,
      );

      const wingAmt = mythic
        ? softGate(m.speedSlow * 0.16 + m.accelFast * 0.08 + 0.03)
        : softGate(m.speedSlow * 0.04);
      targetParam(wingG.gain, dark ? wingAmt * 0.35 : wingAmt, t, 0.35);

      const body =
        (opts.level ?? 0.4) *
        (0.32 + m.bodyLevel * 0.55 + m.accelFast * 0.12) *
        (1 - m.regen * 0.15);
      targetParam(gain.gain, softGate(body), t, 0.22);
    },
    dispose() {
      disposed = true;
      stopSafe(breath);
      stopSafe(growl);
      stopSafe(sub);
      stopSafe(wing);
    },
  };
}

export function createRainLayer(ctx: BaseAudioContext, opts: LayerBaseOpts): LayerHandle {
  const bus = ctx.createGain();
  const wash = createLoopingNoise(ctx, "pink", 1);
  const washBp = ctx.createBiquadFilter();
  washBp.type = "bandpass";
  washBp.frequency.value = 2400;
  washBp.Q.value = 0.6;
  const washG = ctx.createGain();
  wash.connect(washBp);
  washBp.connect(washG);
  washG.connect(bus);
  wash.start();
  const glass = createLoopingNoise(ctx, "white", 1.2);
  const glassHp = ctx.createBiquadFilter();
  glassHp.type = "highpass";
  glassHp.frequency.value = 4500;
  const glassG = ctx.createGain();
  glass.connect(glassHp);
  glassHp.connect(glassG);
  glassG.connect(bus);
  glass.start();
  // Mid-speed road spray (tires through standing water).
  const spray = createLoopingNoise(ctx, "white", 1.15);
  const sprayBp = ctx.createBiquadFilter();
  sprayBp.type = "bandpass";
  sprayBp.frequency.value = 1800;
  sprayBp.Q.value = 0.7;
  const sprayG = ctx.createGain();
  spray.connect(sprayBp);
  sprayBp.connect(sprayG);
  sprayG.connect(bus);
  spray.start();
  const { gain, handle } = chain(ctx, opts, bus);
  let nextDrop = 0;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const road = smoothstep(5, 70, m.speedKmh);
      const drops = 1 - road * 0.75;
      // Peak spray in the mid band (~20–55 km/h), not only at full highway wash.
      const midSpray =
        smoothstep(12, 28, m.speedKmh) * (1 - smoothstep(50, 85, m.speedKmh));
      targetParam(
        washG.gain,
        softGate(0.12 + road * 0.45 + midSpray * 0.32 + m.accelFast * 0.12),
        t,
        0.28,
      );
      targetParam(
        glassG.gain,
        softGate(0.06 + drops * 0.18 + midSpray * 0.22 + road * 0.08),
        t,
        0.32,
      );
      targetParam(
        sprayG.gain,
        softGate(midSpray * 0.45 + road * 0.12 + m.accelFast * 0.08),
        t,
        0.25,
      );
      washBp.frequency.setTargetAtTime(1400 + road * 1800 + midSpray * 400, t, 0.35);
      sprayBp.frequency.setTargetAtTime(1200 + midSpray * 900 + road * 600, t, 0.3);
      if (nextDrop < t) nextDrop = t;
      const dropRate = 4 + drops * 18;
      while (nextDrop < t + 0.12 && drops > 0.15) {
        const at = nextDrop;
        const src = createLoopingNoise(ctx, "white", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2000 + audioRandom() * 4000;
        bp.Q.value = 4;
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();
        pan.pan.value = (audioRandom() - 0.5) * 1.5;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.08 * drops, at + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
        src.connect(bp);
        bp.connect(g);
        g.connect(pan);
        pan.connect(bus);
        src.start(at);
        src.stop(at + 0.06);
        nextDrop += (1 / dropRate) * (0.6 + audioRandom() * 0.8);
      }
      targetParam(gain.gain, softGate((opts.level ?? 0.45) * (0.32 + road * 0.5 + midSpray * 0.2)), t, 0.28);
    },
    dispose() {
      disposed = true;
      stopSafe(wash);
      stopSafe(glass);
      stopSafe(spray);
    },
  };
}

export function createOceanWaveLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
): LayerHandle {
  const bus = ctx.createGain();
  const swell = createLoopingNoise(ctx, "brown", 0.7);
  const swellLp = ctx.createBiquadFilter();
  swellLp.type = "lowpass";
  swellLp.frequency.value = 200;
  const swellG = ctx.createGain();
  swell.connect(swellLp);
  swellLp.connect(swellG);
  swellG.connect(bus);
  swell.start();
  const foam = createLoopingNoise(ctx, "pink", 1);
  const foamBp = ctx.createBiquadFilter();
  foamBp.type = "bandpass";
  foamBp.frequency.value = 900;
  foamBp.Q.value = 0.5;
  const foamG = ctx.createGain();
  foam.connect(foamBp);
  foamBp.connect(foamG);
  foamG.connect(bus);
  foam.start();
  const { gain, handle } = chain(ctx, opts, bus);
  let disposed = false;
  let phase = audioRandom() * 20;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      // Swell period stays oceanic; speed mostly opens foam, accel lifts crest energy.
      phase += m.dt * (0.075 + m.accelFast * 0.2 + m.speedSlow * 0.035);
      const wave = 0.55 + 0.45 * Math.sin(phase) * Math.sin(phase * 0.37 + 1.2);
      targetParam(
        swellG.gain,
        softGate(0.28 + wave * 0.42 + m.accelFast * 0.25 + m.speedSlow * 0.06),
        t,
        0.45,
      );
      targetParam(
        foamG.gain,
        softGate(0.1 + m.speedSlow * 0.2 + wave * 0.28 + m.accelFast * 0.12),
        t,
        0.4,
      );
      foamBp.frequency.setTargetAtTime(550 + m.speedSlow * 700 + wave * 200, t, 0.55);
      swellLp.frequency.setTargetAtTime(140 + wave * 80 + m.accelFast * 60, t, 0.5);
      targetParam(
        gain.gain,
        softGate((opts.level ?? 0.45) * (0.38 + wave * 0.25 + m.speedSlow * 0.22)),
        t,
        0.4,
      );
    },
    dispose() {
      disposed = true;
      stopSafe(swell);
      stopSafe(foam);
    },
  };
}

export function createMaglevLayer(ctx: BaseAudioContext, opts: LayerBaseOpts): LayerHandle {
  const bus = ctx.createGain();
  const prop = ctx.createOscillator();
  prop.type = "sine";
  prop.frequency.value = 80;
  const pg = ctx.createGain();
  const guide = ctx.createOscillator();
  guide.type = "triangle";
  guide.frequency.value = 120;
  const gg = ctx.createGain();
  // Steady guideway hum so low speed is never silent.
  const idle = ctx.createOscillator();
  idle.type = "sine";
  idle.frequency.value = 52;
  const idleG = ctx.createGain();
  idleG.gain.value = 0.0001;
  pg.gain.value = 0.0001;
  gg.gain.value = 0.0001;
  prop.connect(pg);
  pg.connect(bus);
  guide.connect(gg);
  gg.connect(bus);
  idle.connect(idleG);
  idleG.connect(bus);
  prop.start();
  guide.start();
  idle.start();
  const air = createLoopingNoise(ctx, "pink", 1);
  const airHp = ctx.createBiquadFilter();
  airHp.type = "highpass";
  airHp.frequency.value = 800;
  const ag = ctx.createGain();
  air.connect(airHp);
  airHp.connect(ag);
  ag.connect(bus);
  air.start();
  const { gain, handle } = chain(ctx, opts, bus);
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const v = m.speedSlow;
      const idleAmt = 1 - v;
      targetParam(prop.frequency, 48 + v * 180, t, 0.25);
      targetParam(guide.frequency, 78 + v * 140, t, 0.3);
      targetParam(idle.frequency, 48 + v * 12, t, 0.4);
      targetParam(pg.gain, softGate(0.1 + v * 0.16), t, 0.25);
      targetParam(gg.gain, softGate(0.07 + v * 0.12), t, 0.3);
      targetParam(idleG.gain, softGate(0.06 + idleAmt * 0.08 + m.accelFast * 0.04), t, 0.35);
      targetParam(ag.gain, softGate(0.04 + v * 0.32), t, 0.35);
      airHp.frequency.setTargetAtTime(500 + v * 2400, t, 0.4);
      targetParam(gain.gain, softGate((opts.level ?? 0.45) * (0.32 + v * 0.62)), t, 0.3);
    },
    dispose() {
      disposed = true;
      stopSafe(prop);
      stopSafe(guide);
      stopSafe(idle);
      stopSafe(air);
    },
  };
}

/**
 * Night-drive neon: gated bass pulse + bright square energy.
 * No chord stabs or ringing accents (those read as bells).
 */
export function createNeonPulseLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
): LayerHandle {
  const bus = ctx.createGain();

  const bass = ctx.createOscillator();
  bass.type = "sine";
  bass.frequency.value = 70;
  const bassDrive = createDriveShaper(ctx, 0.35);
  const bg = ctx.createGain();
  bg.gain.value = 0.0001;
  bass.connect(bassDrive);
  bassDrive.connect(bg);
  bg.connect(bus);

  // Mid presence so phones hear the pulse without sub
  const punch = ctx.createOscillator();
  punch.type = "triangle";
  punch.frequency.value = 140;
  const punchG = ctx.createGain();
  punchG.gain.value = 0.0001;
  punch.connect(punchG);
  punchG.connect(bus);

  const tone = ctx.createOscillator();
  tone.type = "square";
  tone.frequency.value = 220;
  const toneLp = ctx.createBiquadFilter();
  toneLp.type = "lowpass";
  toneLp.frequency.value = 2800;
  toneLp.Q.value = 1.1;
  const tonePeak = ctx.createBiquadFilter();
  tonePeak.type = "peaking";
  tonePeak.frequency.value = 1800;
  tonePeak.Q.value = 1.4;
  tonePeak.gain.value = 5;
  const tg = ctx.createGain();
  tg.gain.value = 0.0001;
  tone.connect(toneLp);
  toneLp.connect(tonePeak);
  tonePeak.connect(tg);
  tg.connect(bus);

  const hi = ctx.createOscillator();
  hi.type = "sawtooth";
  hi.frequency.value = 880;
  const hiLp = ctx.createBiquadFilter();
  hiLp.type = "lowpass";
  hiLp.frequency.value = 4200;
  const hg = ctx.createGain();
  hg.gain.value = 0.0001;
  hi.connect(hiLp);
  hiLp.connect(hg);
  hg.connect(bus);

  const gate = createLoopingNoise(ctx, "pink", 1);
  const gBp = ctx.createBiquadFilter();
  gBp.type = "bandpass";
  gBp.frequency.value = 1600;
  gBp.Q.value = 1.2;
  const gG = ctx.createGain();
  gG.gain.value = 0.0001;
  gate.connect(gBp);
  gBp.connect(gG);
  gG.connect(bus);

  const { gain, handle } = chain(ctx, opts, bus);
  bass.start();
  punch.start();
  tone.start();
  hi.start();
  gate.start();

  let disposed = false;
  let phase = audioRandom() * 20;
  let wander = 0;

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const demand = clamp(
        m.throttleFast * 0.65 + Math.max(0, m.accelFast) * 0.9 + m.speedSlow * 0.5 + 0.18,
      );
      wander += (audioRandom() - 0.5) * m.dt * 2.4;
      wander *= 0.988;
      const rate = 1.55 + demand * 4.2 + wander * 0.6;
      phase += m.dt * Math.max(0.85, rate);
      const raw = Math.sin(phase * Math.PI * 2);
      // Sharp neon gate: bright peaks, dark valleys (still audible in valleys).
      const pulse = Math.pow(0.5 + 0.5 * raw, 2.4);
      const valley = 0.22 + pulse * 0.78;

      targetParam(bass.frequency, 58 + m.speedSlow * 48 + demand * 22 - m.regen * 12, t, 0.08);
      targetParam(punch.frequency, 118 + demand * 90 + pulse * 30, t, 0.08);
      targetParam(
        tone.frequency,
        190 + demand * 260 + Math.max(0, m.accelFast) * 80 - m.regen * 45,
        t,
        0.07,
      );
      targetParam(hi.frequency, 700 + demand * 1100 + pulse * 220, t, 0.07);
      targetParam(toneLp.frequency, 1600 + demand * 1800 - m.regen * 500, t, 0.1);
      targetParam(hiLp.frequency, 2800 + demand * 1600, t, 0.12);

      targetParam(bg.gain, softGate((0.2 + pulse * 0.28) * demand * 1.15), t, 0.04);
      targetParam(punchG.gain, softGate((0.14 + pulse * 0.22) * demand), t, 0.04);
      targetParam(tg.gain, softGate((0.16 + demand * 0.18) * valley), t, 0.04);
      targetParam(hg.gain, softGate(pulse * (0.08 + demand * 0.16)), t, 0.04);
      targetParam(gG.gain, softGate((0.05 + Math.max(0, m.accelFast) * 0.16) * pulse), t, 0.04);
      gBp.frequency.setTargetAtTime(1200 + demand * 1200 + pulse * 500, t, 0.1);

      targetParam(gain.gain, softGate((opts.level ?? 0.75) * (0.65 + demand * 0.55)), t, 0.1);
    },
    dispose() {
      disposed = true;
      stopSafe(bass);
      stopSafe(punch);
      stopSafe(tone);
      stopSafe(hi);
      stopSafe(gate);
    },
  };
}
