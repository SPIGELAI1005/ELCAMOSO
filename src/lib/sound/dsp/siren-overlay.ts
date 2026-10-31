/**
 * Police siren overlay: a distant wail heard from inside the car, sitting well
 * under the engine (~9-10 dB below). Plays a looped recording
 * (public-domain, see SIREN_CREDIT) through a "distance" chain: band-limit,
 * ~2.6 kHz lowpass and a short room reverb. While the file loads (or if it
 * fails) a soft self-made wail with the same pitch range stands in.
 */
import type { DriveState } from "@/lib/drive/model";
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import type { RecordedCredit } from "@/lib/sound/realism/v2/recorded-loops";

export const SIREN_URL = "/sample-packs/recorded/siren-v1/police-siren-wail.m4a";
/** Classic wail range (Hz) after the playback-rate drop. */
export const SIREN_LOW_HZ = 600;
export const SIREN_HIGH_HZ = 1300;
export const SIREN_WAIL_PERIOD = 4.8;
export const SIREN_YELP_PERIOD = 0.6;
/** Recording peaks around 1.55 kHz; play slower so the top sits near 1.3 kHz. */
export const SIREN_PLAYBACK_RATE = 0.85;
export const SIREN_LOWPASS_HZ = 2600;

export const SIREN_CREDIT: RecordedCredit = {
  title: "American police siren i (Wikimedia Commons / PDSounds #590)",
  author: "lezer",
  licence: "Public domain",
  licenceUrl: "https://commons.wikimedia.org/wiki/File:American_police_siren_i.ogg",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:American_police_siren_i.ogg",
  usedIn: "Police Patrol (siren)",
  attribution: "American police siren i by lezer (PDSounds via Wikimedia Commons), public domain, edited (trimmed, filtered, looped).",
};

export interface SirenOverlay {
  update(state: DriveState, t: number): void;
  dispose(): void;
  /** current mode, for tests/diagnostics */
  mode(): "wail" | "yelp";
  diagnostics(): { gain: number; connected: boolean; source: "recording" | "fallback" };
}

/** Faster sweep when pushing hard or above 90 km/h, otherwise wail. */
export function sirenModeFor(state: Pick<DriveState, "speed" | "throttle" | "acceleration">): "wail" | "yelp" {
  const kmh = state.speed * 3.6;
  return kmh > 90 || (state.throttle > 0.7 && state.acceleration > 2.2) ? "yelp" : "wail";
}

/** Idle level; rises ~+1.6 dB by 130 km/h. Tuned ~9-10 dB under the V8. */
export const SIREN_LEVEL = 1.0;

export function sirenTargetGain(kmh: number, level = SIREN_LEVEL): number {
  const k = Math.min(130, Math.max(0, kmh));
  return level * (1 + 0.2 * (k / 130));
}

let cachedBuffer: AudioBuffer | null = null;
let pending: Promise<AudioBuffer | null> | null = null;

/** Tests/lab: inject a decoded buffer. */
export function setSirenBuffer(buffer: AudioBuffer | null) {
  cachedBuffer = buffer;
}

function loadSiren(ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  if (cachedBuffer) return Promise.resolve(cachedBuffer);
  if (typeof fetch !== "function" || typeof window === "undefined") return Promise.resolve(null);
  pending ??= fetchBytesWithRetry(SIREN_URL, "siren")
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((b) => (cachedBuffer = b))
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

function roomImpulse(ctx: BaseAudioContext, seconds = 1.1): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 12345;
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = ((seed / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 3);
    }
  }
  return ir;
}

export function createSirenOverlay(ctx: BaseAudioContext, destination: AudioNode, level = SIREN_LEVEL): SirenOverlay {
  const out = ctx.createGain();
  out.gain.value = sirenTargetGain(0, level);
  let connected = false;

  // distance chain: band-limit -> lowpass -> dry + room
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 380;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = SIREN_LOWPASS_HZ;
  lp.Q.value = 0.5;
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  let verb: ConvolverNode | null = null;
  try {
    verb = ctx.createConvolver();
    verb.buffer = roomImpulse(ctx);
  } catch {
    verb = null;
  }
  hp.connect(lp);
  lp.connect(dry);
  dry.connect(out);
  if (verb) {
    lp.connect(verb);
    verb.connect(wet);
    wet.connect(out);
  }
  out.connect(destination);
  connected = true;

  // soft stand-in wail (sine, narrow) until the recording is ready
  const fbGain = ctx.createGain();
  fbGain.gain.value = 0.5;
  fbGain.connect(hp);
  const centre = (SIREN_LOW_HZ + SIREN_HIGH_HZ) / 2;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = centre;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 1 / SIREN_WAIL_PERIOD;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = (SIREN_HIGH_HZ - SIREN_LOW_HZ) / 2;
  lfo.connect(lfoAmt);
  lfoAmt.connect(osc.frequency);
  osc.connect(fbGain);
  const t0 = ctx.currentTime;
  osc.start(t0);
  lfo.start(t0);

  let rec: AudioBufferSourceNode | null = null;
  let source: "recording" | "fallback" = "fallback";
  let current: "wail" | "yelp" = "wail";
  let disposed = false;

  const useRecording = (buf: AudioBuffer) => {
    if (disposed || rec) return;
    const t = ctx.currentTime;
    rec = ctx.createBufferSource();
    rec.buffer = buf;
    rec.loop = true;
    rec.playbackRate.value = SIREN_PLAYBACK_RATE;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.6);
    rec.connect(g);
    g.connect(hp);
    rec.start(t, Math.random() * Math.max(0, buf.duration - 1));
    fbGain.gain.setTargetAtTime(0, t, 0.2);
    try {
      osc.stop(t + 1.5);
      lfo.stop(t + 1.5);
    } catch {
      /* */
    }
    source = "recording";
  };
  if (cachedBuffer) useRecording(cachedBuffer);
  else void loadSiren(ctx).then((b) => b && useRecording(b));

  return {
    update(state, t) {
      if (disposed) return;
      const mode = sirenModeFor(state);
      if (mode !== current) {
        current = mode;
        // fast sweep: recording runs a touch quicker; stand-in sweeps faster
        rec?.playbackRate.setTargetAtTime(SIREN_PLAYBACK_RATE * (mode === "yelp" ? 1.06 : 1), t, 0.4);
        lfo.frequency.setTargetAtTime(1 / (mode === "yelp" ? SIREN_YELP_PERIOD : SIREN_WAIL_PERIOD), t, 0.1);
      }
      out.gain.setTargetAtTime(sirenTargetGain(state.speed * 3.6, level), t, 0.3);
    },
    mode: () => current,
    diagnostics: () => ({ gain: disposed ? 0 : out.gain.value, connected: connected && !disposed, source }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.05);
        rec?.stop(t + 0.3);
        osc.stop(t + 0.3);
        lfo.stop(t + 0.3);
      } catch {
        /* closed context */
      }
      setTimeout(() => {
        out.disconnect();
        connected = false;
      }, 400);
    },
  };
}
