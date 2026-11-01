/**
 * Dracula Carriage jump scares: evil laughter, scream, wind whistle, crows,
 * owl and wolf howl. All six voices are SELF-MADE procedural syntheses
 * (no third-party recordings, no licence/credit needed), rendered once into
 * mono AudioBuffers (one per frame while warming up, ~2-3 s each).
 *
 * Each scare = 1 AudioBufferSourceNode + 1 GainNode + 1 StereoPannerNode,
 * all disconnected on `ended` (no node leaks). Timing, voice and loudness are
 * random: quiet ones sit in the background, loud ones jump over everything
 * while the carriage bed is ducked. The engine's peak-protect limiter keeps
 * the sum below clipping.
 */
import { audioRandom } from "@/lib/sound/rng";

export const SCARE_KINDS = ["laugh", "scream", "whistle", "crows", "owl", "wolf"] as const;
export type ScareKind = (typeof SCARE_KINDS)[number];

/** Source / licence of every scare voice (all original, synthesized in code). */
export const SCARE_SOURCES: Readonly<Record<ScareKind, string>> = {
  laugh: "self-made: formant-filtered glottal pulses, descending 'ha-ha-ha' (procedural, this file)",
  scream: "self-made: vibrato saw + vowel formants + breath noise (procedural, this file)",
  whistle: "self-made: narrow resonant noise sweep (procedural, this file)",
  crows: "self-made: harsh nasal 'caw' x3 (procedural, this file)",
  owl: "self-made: soft sine 'hoo, hoo-hoo, hoooo' (procedural, this file)",
  wolf: "self-made: gliding harmonic howl with vibrato (procedural, this file)",
};

/** Loud scares duck the bed to this gain; quiet ones barely touch it. */
export const SCARE_DUCK_LOUD = 0.32;
export const SCARE_DUCK_QUIET = 0.85;

export interface ScarePlan { kind: ScareKind; at: number; level: number; loud: boolean; pan: number }

/** Pure scheduling (unit-tested): next scare after `t`, never the same voice twice in a row. */
export function planNextScare(t: number, last: ScareKind | null, rnd: () => number = audioRandom, intensity = 0): ScarePlan {
  let kind: ScareKind;
  do kind = SCARE_KINDS[Math.floor(rnd() * SCARE_KINDS.length) % SCARE_KINDS.length]!; while (kind === last);
  // 15 % quick follow-ups (2-4 s) keep it unpredictable; otherwise 7-20 s, a bit denser when driving hard.
  const gap = rnd() < 0.15 ? 2 + rnd() * 2 : (7 + rnd() * 13) * (1 - 0.25 * intensity);
  const loud = rnd() < 0.5;
  const level = loud ? 0.85 + rnd() * 0.35 : 0.18 + rnd() * 0.22;
  return { kind, at: t + gap, level, loud, pan: (rnd() * 2 - 1) * 0.7 };
}

// ── procedural voices ──────────────────────────────────────────────────────
class Reson {
  private b0 = 0; private a1 = 0; private a2 = 0; private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private sr: number) {}
  set(fc: number, q: number) {
    const w = (2 * Math.PI * Math.min(fc, this.sr * 0.45)) / this.sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    this.b0 = al / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number) {
    const y = this.b0 * x - this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296);
}

/** Render one voice as raw samples (sr = sample rate). Normalised to peak 0.9. */
export function renderScare(kind: ScareKind, sr: number, seed = 7): Float32Array {
  const r = makeRng(seed + kind.length * 101);
  const noise = () => r() * 2 - 1;
  const secs = { laugh: 2.0, scream: 1.9, whistle: 2.8, crows: 1.8, owl: 2.6, wolf: 3.2 }[kind];
  const n = Math.round(sr * secs);
  const out = new Float32Array(n);
  const f1 = new Reson(sr), f2 = new Reson(sr), f3 = new Reson(sr);
  let ph = 0;
  const saw = (f: number) => { ph += f / sr; ph -= Math.floor(ph); return 2 * ph - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let y = 0;
    if (i % 32 === 0) {
      if (kind === "laugh") { f1.set(750, 6); f2.set(1150, 8); f3.set(2600, 10); }
      else if (kind === "scream") { f1.set(1000 + 200 * Math.sin(t * 3), 5); f2.set(2700, 8); f3.set(3600, 9); }
      else if (kind === "whistle") f1.set(1200 + 500 * Math.sin(t * 1.7) + 250 * Math.sin(t * 5.3), 60);
      else if (kind === "crows") { f1.set(1500, 5); f2.set(2500, 7); f3.set(900, 4); }
    }
    switch (kind) {
      case "laugh": {
        // 8 "ha" syllables, low evil voice, f0 falling 210 -> 120 Hz
        const syl = 0.2, k = Math.floor(t / syl), u = t - k * syl;
        if (k < 8) {
          const env = Math.min(1, u / 0.015) * Math.exp(-u * 14) * (1 - k * 0.07);
          const f0 = (210 - k * 11) * (1 + 0.04 * Math.sin(t * 40));
          const src = saw(f0) * 0.8 + noise() * 0.25;
          y = (f1.run(src) + 0.7 * f2.run(src) + 0.25 * f3.run(src)) * env;
        }
        break;
      }
      case "scream": {
        const env = Math.min(1, t / 0.07) * (t < 1.3 ? 1 : Math.exp(-(t - 1.3) * 6));
        const f0 = (t < 0.25 ? 700 + t * 1600 : 1100 - (t - 0.25) * 180) * (1 + 0.035 * Math.sin(t * 2 * Math.PI * 6.5));
        const src = saw(f0) + noise() * 0.35;
        y = (f1.run(src) + 0.8 * f2.run(src) + 0.5 * f3.run(src)) * env;
        break;
      }
      case "whistle": {
        const env = Math.sin(Math.PI * Math.min(1, t / secs)) ** 1.5 * (0.75 + 0.25 * Math.sin(t * 9));
        y = f1.run(noise()) * env * 6;
        break;
      }
      case "crows": {
        // three "caw"s
        const starts = [0, 0.48, 1.0], len = 0.32;
        for (const s of starts) if (t >= s && t < s + len) {
          const u = t - s, env = Math.min(1, u / 0.02) * Math.exp(-u * 5) * (u > len - 0.05 ? (len - u) / 0.05 : 1);
          const f0 = 620 - u * 500;
          const pulse = saw(f0) > 0.6 ? 1 : -0.3;
          const src = pulse * (0.7 + 0.3 * noise());
          y = (f1.run(src) + 0.8 * f2.run(src) + 0.5 * f3.run(src)) * env;
        }
        break;
      }
      case "owl": {
        // hoo ...... hoo-hoo  hoooo
        const notes: [number, number, number][] = [[0, 0.45, 390], [0.85, 0.22, 400], [1.12, 0.22, 400], [1.45, 0.9, 380]];
        for (const [s, d, f] of notes) if (t >= s && t < s + d) {
          const u = t - s, env = Math.sin(Math.PI * (u / d)) ** 0.8;
          const f0 = f * (1 - 0.06 * (u / d));
          ph += f0 / sr; ph -= Math.floor(ph);
          y = (Math.sin(2 * Math.PI * ph) + 0.12 * Math.sin(4 * Math.PI * ph) + noise() * 0.03) * env;
        }
        break;
      }
      case "wolf": {
        const f0 = t < 0.9 ? 330 + 320 * Math.sin((t / 0.9) * Math.PI / 2) : 650 - (t - 0.9) * 110;
        const vib = 1 + 0.012 * Math.sin(t * 2 * Math.PI * 5) * Math.min(1, t);
        ph += (f0 * vib) / sr; ph -= Math.floor(ph);
        const env = Math.min(1, t / 0.25) * (t < 2.4 ? 1 : Math.max(0, 1 - (t - 2.4) / 0.8));
        const p = 2 * Math.PI * ph;
        y = (Math.sin(p) + 0.45 * Math.sin(2 * p) + 0.15 * Math.sin(3 * p) + noise() * 0.04) * env;
        break;
      }
    }
    out[i] = y;
  }
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const g = 0.9 / peak;
  // 5 ms fade in/out (no clicks)
  const f = Math.round(sr * 0.005);
  for (let i = 0; i < n; i++) out[i]! *= g * Math.min(1, i / f, (n - 1 - i) / f);
  return out;
}

export interface JumpScares {
  /** call once per engine update */
  update(intensity: number, t: number): void;
  dispose(): void;
  diagnostics(): { ready: number; active: number; fired: number; next: ScarePlan | null };
}

/**
 * @param out where scare voices go (must NOT pass through `duck`)
 * @param duck gain node in front of the carriage bed / music (ducked under loud scares)
 */
export function createJumpScares(ctx: BaseAudioContext, out: AudioNode, duck: GainNode | null, opts: { gain?: number; firstAfter?: [number, number] } = {}): JumpScares {
  const buffers = new Map<ScareKind, AudioBuffer>();
  const live = new Set<AudioBufferSourceNode>();
  const masterGain = opts.gain ?? 1.4; // +3 dB: loud scares measured +6..+10 dB over the bed at 1.0
  let fired = 0;
  let last: ScareKind | null = null;
  const [a, b] = opts.firstAfter ?? [4, 8];
  let plan: ScarePlan | null = null;
  let disposed = false;

  function warmOne() {
    for (const k of SCARE_KINDS) if (!buffers.has(k)) {
      const data = renderScare(k, ctx.sampleRate);
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.getChannelData(0).set(data);
      buffers.set(k, buf);
      return;
    }
  }

  function fire(p: ScarePlan) {
    const buf = buffers.get(p.kind);
    if (!buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + audioRandom() * 0.12;
    const g = ctx.createGain();
    g.gain.value = p.level * masterGain;
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan;
    src.connect(g); g.connect(pan); pan.connect(out);
    const at = Math.max(p.at, ctx.currentTime);
    src.start(at);
    live.add(src);
    src.onended = () => { src.disconnect(); g.disconnect(); pan.disconnect(); live.delete(src); };
    if (duck) {
      const dur = buf.duration / src.playbackRate.value;
      const depth = p.loud ? SCARE_DUCK_LOUD : SCARE_DUCK_QUIET;
      duck.gain.cancelScheduledValues(at);
      duck.gain.setTargetAtTime(depth, at, 0.03);
      duck.gain.setTargetAtTime(1, at + dur * 0.85, 0.35);
    }
    fired++;
    return true;
  }

  return {
    update(intensity, t) {
      if (disposed) return;
      if (buffers.size < SCARE_KINDS.length) warmOne();
      if (!plan) plan = { ...planNextScare(t, null), at: t + a + audioRandom() * (b - a), loud: true, level: 1 };
      if (t + 0.1 >= plan.at) {
        if (!buffers.has(plan.kind)) return; // still warming; play it as soon as it exists
        fire(plan);
        last = plan.kind;
        plan = planNextScare(Math.max(t, plan.at), last, audioRandom, Math.max(0, Math.min(1, intensity)));
      }
    },
    dispose() {
      disposed = true;
      for (const s of live) { try { s.stop(); } catch { /* not started */ } s.disconnect(); }
      live.clear();
      duck?.gain.cancelScheduledValues(0);
      if (duck) duck.gain.value = 1;
    },
    diagnostics: () => ({ ready: buffers.size, active: live.size, fired, next: plan }),
  };
}
