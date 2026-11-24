/**
 * Turbo spool + compressor whistle maths shared by the hybrid combustion synth
 * (every forcedInduction profile, e.g. Ge-Squared O))), Rally Car, Turbo Inline-6)
 * and the Private Jet Oberpfaffenhofen take-off whistle overlay.
 *
 * Pure functions only: the hybrid synth calls them with exactly the arithmetic it
 * used inline before (bit-identical output), so moving the maths here changes no sound.
 */

/** Second whistle oscillator ratio: two slightly detuned compressor blades. */
export const TURBO_WHISTLE_DETUNE = 1.013;

export interface TurboWhistleRange {
  baseHz: number;
  spanHz: number;
}

/**
 * Acoustic boost the turbo wants: powertrain boost barely builds from GPS-estimated load
 * (~0.3 max in the car), so the spool also follows load × rpm directly.
 */
export function turboBoostWant(rpm: number, load: number, demand: number, ptBoost: number): number {
  const rpmSpool = Math.min(1, Math.max(0, (rpm - 1400) / 2600));
  const loadSpool = Math.min(1, Math.max(0, (Math.max(load, demand) - 0.08) / 0.3));
  return Math.max(ptBoost, rpmSpool * loadSpool * 0.9);
}

/** One-pole spool follower with separate spool-up (attack) and spool-down (decay) lag. */
export function followTurboSpool(
  spool: number,
  want: number,
  dt: number,
  attackSeconds: number,
  decaySeconds: number,
): number {
  const tau = want >= spool ? attackSeconds : decaySeconds;
  return spool + (want - spool) * (1 - Math.exp(-dt / Math.max(0.04, tau)));
}

/** Whistle gain before settle / gating: only audible once boost builds, follows spool^1.5 and load. */
export function turboWhistleGain(spool: number, load: number): number {
  return spool > 0.08 ? Math.pow(spool, 1.5) * (0.5 + Math.min(1, load * 2) * 0.5) * 0.05 : 0.0001;
}

/** Whistle pitch (Hz) for the first blade; the second sits at × TURBO_WHISTLE_DETUNE. */
export function turboWhistleHz(
  spool: number,
  rpmNorm: number,
  range?: TurboWhistleRange | null,
): number {
  return (range ? range.baseHz + spool * range.spanHz : 2200 + spool * 3400) + rpmNorm * 700;
}
