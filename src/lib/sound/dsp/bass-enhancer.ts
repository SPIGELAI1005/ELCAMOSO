/**
 * Reusable engine bass / "emotion" enhancer, configurable per profile.
 *
 * input → 220 Hz mud cut → 30 Hz high-pass → out
 *   ╰→ sub band-pass (firing orders / thrust, ~38-120 Hz) → sub gain ────────────╯
 *        ╰→ soft saturation → 90-260 Hz band → harmonic gain (psychoacoustic bass) ╯
 *
 * Sub and harmonic gains swell with drive (acceleration / load) and get a small boost on
 * lift-off so exhaust pops thump harder. A trim keeps perceived loudness similar; the
 * 30 Hz high-pass avoids wasting headroom below what cabin speakers reproduce.
 * Enable a profile by adding it to BASS_ENHANCER_PROFILES.
 */
import { targetParam } from "./smoother";

export interface BassEnhancerConfig {
  /** Linear gain of the parallel sub path at rest. */
  subGain: number;
  /** Sub band edges (Hz). */
  subLowHz: number;
  subHighHz: number;
  /** Linear gain of the psychoacoustic harmonic path at rest. */
  harmonicGain: number;
  /** Extra sub/harmonic share at full drive (0.6 = +60 %). */
  swell: number;
  /** Extra share on lift-off / overrun (pops). */
  liftOffBoost: number;
  /** 220 Hz cut against boom/mud (dB, positive = cut). */
  mudCutDb: number;
  /** Output trim (dB) so loudness stays similar. */
  trimDb: number;
  /** High-pass (Hz). */
  highPassHz: number;
  /**
   * When true the enhancer is fully neutral at rest (presence 0: no sub/harmonics, no trim,
   * no mud cut) and fades in with presence — used to keep a loved idle exactly as is.
   */
  neutralAtRest?: boolean;
  /**
   * Decel "thunder" only: the engine adds this enhancer just while lifting off / slowing
   * down (presence follows the lift-off amount), so the downshift blips get the felt
   * low end the American V8 has, and idle, cruise and acceleration stay exactly as tuned.
   * Requires neutralAtRest.
   */
  decelOnly?: boolean;
  /**
   * Decel-only: fade the thunder out near the stop. Presence is full above the upper rpm and
   * km/h edges and gone below the lower ones (the lower of the two fades wins), so low-rev
   * firing orders that sit inside the sub band do not drone while braking to a halt.
   */
  decelFadeOut?: { rpm: [number, number]; kmh: [number, number] };
}

const fadeStep = (v: number, [lo, hi]: [number, number]) => {
  const x = Math.min(1, Math.max(0, (v - lo) / Math.max(1e-6, hi - lo)));
  return x * x * (3 - 2 * x);
};

/** Thunder presence scale (0..1) from the profile's decel fade-out window; 1 when unset. */
export function decelThunderFade(cfg: BassEnhancerConfig, rpm: number, kmh: number): number {
  const f = cfg.decelFadeOut;
  if (!f) return 1;
  return Math.min(fadeStep(rpm, f.rpm), fadeStep(kmh, f.kmh));
}

const base: BassEnhancerConfig = {
  subGain: 0.6,
  subLowHz: 38,
  subHighHz: 120,
  harmonicGain: 0.12,
  swell: 0.6,
  liftOffBoost: 0.25,
  mudCutDb: 2.5,
  trimDb: -1.5,
  highPassHz: 30,
};

/** Decel-only preset: neutral while idling, cruising and accelerating; present on lift-off. */
const thunder: BassEnhancerConfig = {
  ...base,
  neutralAtRest: true,
  decelOnly: true,
  swell: 0,
  liftOffBoost: 0.25,
  // No trim and only a light mud cut: the thunder adds low end without dulling the crackle.
  trimDb: 0,
  mudCutDb: 1,
};

export const BASS_ENHANCER_PROFILES: Record<string, BassEnhancerConfig> = {
  "american-muscle-v8": { ...base },
  "gt-v8": { ...base, subGain: 0.5, harmonicGain: 0.1 },
  "rocket-car": { ...base, subGain: 0.8, subLowHz: 32, subHighHz: 110, harmonicGain: 0.14, swell: 0.9, liftOffBoost: 0.6, mudCutDb: 3, trimDb: -4.5 },
  "time-machine": {
    ...base,
    subGain: 0.65,
    subLowHz: 34,
    subHighHz: 105,
    harmonicGain: 0.12,
    swell: 0.85,
    liftOffBoost: 0.6,
    mudCutDb: 2.5,
    trimDb: -3.8,
  },
  // Decel thunder (downshift blips + lift-off bass) for the other combustion cars, per engine character.
  // Sub band sits on each engine's firing orders at coasting revs; 30 Hz high-pass and trim stay on.
  // V10: its 5th order sits at 83-110 Hz at 1000-1300 rpm, inside the sub band, so the
  // thunder fades out below ~1500 rpm / 20 km/h instead of droning down to the stop.
  "racing-v10": { ...thunder, subGain: 0.22, subLowHz: 45, subHighHz: 135, harmonicGain: 0.04, decelFadeOut: { rpm: [1200, 1500], kmh: [10, 20] } },
  "race-car": { ...thunder, subGain: 0.2, subLowHz: 42, subHighHz: 130, harmonicGain: 0.04 },
  "flat-six-sport": { ...thunder, subGain: 0.24, subLowHz: 38, subHighHz: 120, harmonicGain: 0.05 },
  "turbo-inline-6": { ...thunder, subGain: 0.24, subLowHz: 38, subHighHz: 115, harmonicGain: 0.05 },
  "rally-car": { ...thunder, subGain: 0.26, subLowHz: 34, subHighHz: 105, harmonicGain: 0.05 },
  "world-space-drive": { ...base, neutralAtRest: true, subGain: 0.7, subLowHz: 32, subHighHz: 110, harmonicGain: 0.12, swell: 4, liftOffBoost: 0.5, mudCutDb: 2, trimDb: -3.5 },
};

export function getBassEnhancerConfig(profileId: string): BassEnhancerConfig | null {
  return BASS_ENHANCER_PROFILES[profileId] ?? null;
}

export interface BassEnhancer {
  input: GainNode;
  nodeCount: number;
  /** drive 0..1 (acceleration/load), liftOff 0..1. */
  setDrive(drive: number, liftOff: number, time: number, presence?: number): void;
  dispose(): void;
}

function softClipCurve(n = 1024): Float32Array {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    // Asymmetric soft clip → even + odd harmonics; |y| <= ~1.
    curve[i] = Math.tanh(2.2 * x + 0.35 * x * x) / Math.tanh(2.2);
  }
  return curve;
}

export function createBassEnhancer(
  ctx: BaseAudioContext,
  out: AudioNode,
  cfg: BassEnhancerConfig,
): BassEnhancer {
  const input = ctx.createGain();
  const rest = cfg.neutralAtRest ? 0 : 1;
  input.gain.value = 10 ** ((cfg.trimDb * rest) / 20);
  const mud = ctx.createBiquadFilter();
  mud.type = "peaking";
  mud.frequency.value = 220;
  mud.Q.value = 1.1;
  mud.gain.value = -cfg.mudCutDb * rest;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = cfg.neutralAtRest ? 10 : cfg.highPassHz;
  hp.Q.value = 0.7;
  const subLp = ctx.createBiquadFilter();
  subLp.type = "lowpass";
  subLp.frequency.value = cfg.subHighHz;
  subLp.Q.value = 0.6;
  const subHp = ctx.createBiquadFilter();
  subHp.type = "highpass";
  subHp.frequency.value = cfg.subLowHz;
  subHp.Q.value = 0.6;
  const sub = ctx.createGain();
  sub.gain.value = cfg.subGain * rest;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve() as Float32Array<ArrayBuffer>;
  const harmHp = ctx.createBiquadFilter();
  harmHp.type = "highpass";
  harmHp.frequency.value = 90;
  harmHp.Q.value = 0.7;
  const harmLp = ctx.createBiquadFilter();
  harmLp.type = "lowpass";
  harmLp.frequency.value = 260;
  harmLp.Q.value = 0.7;
  const harm = ctx.createGain();
  harm.gain.value = cfg.harmonicGain * rest;
  input.connect(mud);
  mud.connect(hp);
  input.connect(subLp);
  subLp.connect(subHp);
  subHp.connect(sub);
  sub.connect(hp);
  subHp.connect(shaper);
  shaper.connect(harmHp);
  harmHp.connect(harmLp);
  harmLp.connect(harm);
  harm.connect(hp);
  hp.connect(out);
  const nodes: AudioNode[] = [input, mud, hp, subLp, subHp, sub, shaper, harmHp, harmLp, harm];
  return {
    input,
    nodeCount: nodes.length,
    setDrive(drive, liftOff, time, presence = 1) {
      const d = Math.min(1, Math.max(0, drive));
      const l = Math.min(1, Math.max(0, liftOff));
      const p = cfg.neutralAtRest ? Math.min(1, Math.max(0, presence)) : 1;
      const swell = (1 + cfg.swell * d + cfg.liftOffBoost * l) * p;
      targetParam(sub.gain, Math.max(0.0001, cfg.subGain * swell), time, 0.25);
      targetParam(harm.gain, Math.max(0.0001, cfg.harmonicGain * swell), time, 0.25);
      if (cfg.neutralAtRest) {
        targetParam(input.gain, 10 ** ((cfg.trimDb * p) / 20), time, 0.4);
        targetParam(mud.gain, -cfg.mudCutDb * p, time, 0.4);
        targetParam(hp.frequency, 10 + (cfg.highPassHz - 10) * p, time, 0.4);
      }
    },
    dispose() {
      for (const node of nodes) node.disconnect();
    },
  };
}
