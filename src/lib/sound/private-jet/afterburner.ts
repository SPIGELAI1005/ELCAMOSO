/**
 * Fighter Jet afterburner for take-off: a "light" (deep thump + short roar burst) when the
 * take-off gate opens, then a low, flickering reheat roar that follows the take-off gate
 * and speed, and dies away with it (lift-off, cruise, braking).
 *
 * Driven by the take-off model's gate (takeoff-whistle.ts), so it shares one launch
 * detection with the whistle. CPU: one looped noise buffer (locally seeded, does not touch
 * the shared audioRandom stream), two filters, one LFO; the output is disconnected while
 * the gate has been closed for a moment.
 */

export const AFTERBURNER_LEVEL = 0.42;
export const AFTERBURNER_LIGHT_LEVEL = 0.9;

export interface AfterburnerVoice {
  update(gate: number, kmh: number, t: number): void;
  dispose(): void;
  diagnostics(): { lights: number; gain: number; connected: boolean };
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Roar gain for a gate (0..1) and speed. */
export function afterburnerGain(gate: number, kmh: number, level = AFTERBURNER_LEVEL): number {
  if (gate <= 0.002) return 0;
  const speedNorm = Math.min(1, Math.max(0, kmh / 160));
  return level * Math.pow(gate, 1.3) * (0.7 + 0.3 * speedNorm);
}

export function createAfterburnerVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  seed = 0x0af7e2b,
): AfterburnerVoice {
  const sr = ctx.sampleRate;
  // 2.3 s of brown-ish noise (integrated white, leaky) for the reheat roar.
  const len = Math.floor(sr * 2.3);
  const buf = ctx.createBuffer(1, len, sr);
  {
    const d = buf.getChannelData(0);
    const r = lcg(seed);
    let y = 0;
    for (let i = 0; i < len; i++) {
      y = y * 0.985 + (r() * 2 - 1) * 0.12;
      d[i] = y;
    }
    // Crossfade the loop seam.
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      d[i] = d[i]! * a + d[len - fade + i]! * (1 - a);
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopEnd = (len - Math.floor(sr * 0.05)) / sr;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 650;
  lp.Q.value = 0.7;
  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 95;
  body.Q.value = 0.8;
  body.gain.value = 7;
  const roar = ctx.createGain();
  roar.gain.value = 0;
  // Reheat flicker: a slow, shallow wobble on the roar level.
  const flick = ctx.createOscillator();
  flick.type = "triangle";
  flick.frequency.value = 6.5;
  const flickAmt = ctx.createGain();
  flickAmt.gain.value = 0;
  flick.connect(flickAmt);
  flickAmt.connect(roar.gain);
  const out = ctx.createGain();
  out.gain.value = 1;
  src.connect(lp);
  lp.connect(body);
  body.connect(roar);
  roar.connect(out);
  out.connect(destination);
  src.start();
  flick.start();

  const parkBranch = !(globalThis as { __ELC_JET_NO_BRANCH_PARK?: boolean })
    .__ELC_JET_NO_BRANCH_PARK;
  let connected = true;
  let closedFor = 0;
  let lastT: number | null = null;
  let prevGate = 0;
  let lights = 0;
  let gainNow = 0;
  let disposed = false;
  const setConnected = (on: boolean) => {
    if (on === connected || !parkBranch) return;
    connected = on;
    try {
      if (on) out.connect(destination);
      else out.disconnect();
    } catch {
      /* closed context */
    }
  };

  const light = (t: number) => {
    lights += 1;
    // Deep ignition thump.
    const th = ctx.createOscillator();
    th.type = "sine";
    th.frequency.setValueAtTime(72, t);
    th.frequency.exponentialRampToValueAtTime(34, t + 0.35);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.linearRampToValueAtTime(AFTERBURNER_LIGHT_LEVEL, t + 0.012);
    tg.gain.setTargetAtTime(0.0001, t + 0.012, 0.12);
    th.connect(tg);
    tg.connect(out);
    th.start(t);
    th.stop(t + 0.9);
    // Short open roar burst on top (same noise, brighter).
    const b = ctx.createBufferSource();
    b.buffer = buf;
    const bl = ctx.createBiquadFilter();
    bl.type = "lowpass";
    bl.frequency.setValueAtTime(1800, t);
    bl.frequency.exponentialRampToValueAtTime(500, t + 0.6);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(AFTERBURNER_LIGHT_LEVEL * 1.4, t + 0.03);
    bg.gain.setTargetAtTime(0.0001, t + 0.05, 0.22);
    b.connect(bl);
    bl.connect(bg);
    bg.connect(out);
    b.start(t, 0.4, 1.4);
  };

  return {
    update(gate, kmh, t) {
      if (disposed) return;
      const dt = lastT === null ? 0 : Math.min(0.25, Math.max(0, t - lastT));
      lastT = t;
      closedFor = gate <= 0.002 ? closedFor + dt : 0;
      setConnected(closedFor < 0.8);
      if (gate > 0.05 && prevGate <= 0.05) light(t);
      prevGate = gate;
      gainNow = afterburnerGain(gate, kmh);
      roar.gain.setTargetAtTime(gainNow, t, 0.08);
      flickAmt.gain.setTargetAtTime(gainNow * 0.18, t, 0.1);
    },
    diagnostics: () => ({ lights, gain: gainNow, connected }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.05);
        src.stop(t + 0.3);
        flick.stop(t + 0.3);
      } catch {
        /* closed context */
      }
      setTimeout(() => out.disconnect(), 400);
    },
  };
}
