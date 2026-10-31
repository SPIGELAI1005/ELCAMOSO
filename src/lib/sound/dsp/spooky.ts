/**
 * Spooky one-shots for the Dracula Carriage profile. Self-made in Web Audio
 * (oscillators, filtered noise and a short echo), no samples needed.
 */
import { getNoiseBuffer } from "@/lib/sound/dsp/noise";

export type SpookyKind = "cackle" | "eerie" | "scream" | "gust" | "howl";

export const SPOOKY_KINDS: readonly SpookyKind[] = ["cackle", "eerie", "scream", "gust", "howl"];

export function isSpookyKind(kind: string): kind is SpookyKind {
  return (SPOOKY_KINDS as readonly string[]).includes(kind);
}

/** Short dark echo so one-shots sound like they come from far off. */
function echo(ctx: BaseAudioContext, out: AudioNode, at: number, tail: number, time = 0.23, fb = 0.42) {
  const input = ctx.createGain();
  const delay = ctx.createDelay(1);
  const back = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  delay.delayTime.value = time;
  back.gain.value = fb;
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  input.connect(out);
  input.connect(delay);
  delay.connect(lp);
  lp.connect(back);
  back.connect(delay);
  lp.connect(out);
  const end = at + tail;
  back.gain.setValueAtTime(fb, end);
  back.gain.linearRampToValueAtTime(0, end + 0.5);
  return input;
}

function noise(ctx: BaseAudioContext, at: number, dur: number) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, "pink");
  src.loop = true;
  src.start(at);
  src.stop(at + dur);
  return src;
}

export function fireSpooky(
  ctx: BaseAudioContext,
  out: AudioNode,
  kind: SpookyKind,
  at: number,
  tone: number,
  level: number,
) {
  if (kind === "cackle") {
    // evil laugh: slow deep "ha" syllables that speed up and climb, then fall away
    const dest = echo(ctx, out, at, 2.4, 0.27, 0.38);
    const n = 9;
    let t0 = at;
    for (let i = 0; i < n; i += 1) {
      const span = i === 0 ? 0.32 : 0.21 - Math.min(i, 5) * 0.012;
      const climb = i < 6 ? 1 + i * 0.05 : 1.3 - (i - 5) * 0.12;
      const pitch = tone * climb;
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibAmt = ctx.createGain();
      const f1 = ctx.createBiquadFilter();
      const f2 = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(pitch * 1.06, t0);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.86, t0 + span * 0.85);
      vib.frequency.value = 23;
      vibAmt.gain.value = pitch * 0.03;
      vib.connect(vibAmt);
      vibAmt.connect(osc.frequency);
      f1.type = "bandpass";
      f1.frequency.value = 720; // "ah"
      f1.Q.value = 4;
      f2.type = "peaking";
      f2.frequency.value = 1150;
      f2.Q.value = 3;
      f2.gain.value = 9;
      const amp = level * (i === 0 ? 1.15 : 1 - i * 0.05);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + span * 0.9);
      osc.connect(f1);
      f1.connect(f2);
      f2.connect(g);
      g.connect(dest);
      // breathy "h" onset
      const br = noise(ctx, t0, span);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1600;
      bp.Q.value = 1;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.5), t0 + 0.015);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      br.connect(bp);
      bp.connect(bg);
      bg.connect(dest);
      osc.start(t0);
      vib.start(t0);
      osc.stop(t0 + span);
      vib.stop(t0 + span);
      t0 += span;
    }
    return;
  }

  if (kind === "eerie") {
    // high, wavering glide: two slightly detuned sines drifting up and down
    const dur = 3.6;
    const dest = echo(ctx, out, at, dur, 0.31, 0.35);
    [1, 1.012].forEach((det, i) => {
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibAmt = ctx.createGain();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone * det, at);
      osc.frequency.exponentialRampToValueAtTime(tone * 1.6 * det, at + dur * 0.45);
      osc.frequency.exponentialRampToValueAtTime(tone * 0.75 * det, at + dur);
      vib.frequency.value = 5.5 + i;
      vibAmt.gain.value = tone * 0.025;
      vib.connect(vibAmt);
      vibAmt.connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(level * 0.6, at + 0.8);
      g.gain.setValueAtTime(level * 0.6, at + dur - 1);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(at);
      vib.start(at);
      osc.stop(at + dur + 0.05);
      vib.stop(at + dur + 0.05);
    });
    return;
  }

  if (kind === "scream") {
    // distant scream: bright rising wail, muffled by distance, long echo
    const dur = 1.5;
    const dest = echo(ctx, out, at, dur + 0.6, 0.38, 0.45);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    lp.connect(dest);
    const osc = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vibAmt = ctx.createGain();
    const f1 = ctx.createBiquadFilter();
    const f2 = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(tone * 0.8, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 1.25, at + 0.35);
    osc.frequency.setValueAtTime(tone * 1.25, at + 0.9);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.7, at + dur);
    vib.frequency.value = 7;
    vibAmt.gain.value = tone * 0.04;
    vib.connect(vibAmt);
    vibAmt.connect(osc.frequency);
    f1.type = "bandpass";
    f1.frequency.value = 1000;
    f1.Q.value = 3;
    f2.type = "peaking";
    f2.frequency.value = 2600;
    f2.Q.value = 2;
    f2.gain.value = 8;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.12);
    g.gain.setValueAtTime(level, at + 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(f1);
    f1.connect(f2);
    f2.connect(g);
    g.connect(lp);
    const br = noise(ctx, at, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, at);
    bg.gain.exponentialRampToValueAtTime(level * 0.3, at + 0.1);
    bg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    br.connect(bp);
    bp.connect(bg);
    bg.connect(lp);
    osc.start(at);
    vib.start(at);
    osc.stop(at + dur + 0.05);
    vib.stop(at + dur + 0.05);
    return;
  }

  // gust (whooshing, whistling) and howl (long moaning wind)
  const howl = kind === "howl";
  const dur = howl ? 5.5 : 2.6;
  const src = noise(ctx, at, dur + 0.1);
  const bands = howl ? [1, 1.5] : [1, 3.2];
  bands.forEach((ratio, i) => {
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    bp.type = "bandpass";
    bp.Q.value = howl ? 9 + i * 4 : i === 0 ? 1.4 : 22;
    const f = tone * ratio;
    bp.frequency.setValueAtTime(f * 0.7, at);
    bp.frequency.exponentialRampToValueAtTime(f * (howl ? 1.35 : 1.8), at + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(f * 0.6, at + dur);
    const amp = level * (howl ? (i === 0 ? 1.6 : 0.9) : i === 0 ? 1 : 0.7);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
  });
}
