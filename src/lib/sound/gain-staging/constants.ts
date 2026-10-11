/**
 * Prompt 08 — documented gain-staging constants.
 *
 * Measured production graph (adapted, not invented):
 *   layer trims → engine/event mix → cabin EQ + MasterBus (sat/EQ/gentle program comp)
 *   → user volume (perceptual) → optional output boost → peak protect (−1 dBFS sample)
 *   → call duck → destination
 *
 * Offline PROFILE_LOUDNESS trims normalize catalog loudness. Load dynamics stay primarily
 * on combustion/strategy layers; master load scale is intentionally mild (not AGC).
 */

/** New-device / reset default for the master volume slider (0..1). */
export const DEFAULT_UI_VOLUME = 0.35;

/** Product user-stage ceiling without boost (legacy MAX_GAIN spirit). */
export const USER_STAGE_CEILING = 0.85;

/** Declared sample-peak ceiling at the peak-protect stage (dBFS). */
export const SAMPLE_PEAK_CEILING_DBFS = -1;

/** Linear amplitude for SAMPLE_PEAK_CEILING_DBFS. */
export const SAMPLE_PEAK_CEILING_LINEAR = 10 ** (SAMPLE_PEAK_CEILING_DBFS / 20);

/** Optional output boost range (dB). Does not override car hardware volume. */
export const OUTPUT_BOOST_MAX_DB = 6;

/** MasterBus post-EQ makeup into the user-volume stage (existing constant). */
export const MASTER_BUS_OUTPUT_GAIN = 0.9;

/**
 * WaveShaper peak protect has no algorithmic lookahead (instant curve).
 * If a browser DynamicsCompressor is used as a soft pre-stage, expect roughly
 * 2–5 ms of implementation-dependent latency — not a guaranteed true-peak limiter.
 */
export const PEAK_PROTECT_LOOKAHEAD_MS = 0;
export const OPTIONAL_COMPRESSOR_LOOKAHEAD_NOTE_MS = "2–5 ms (browser-dependent, not true-peak)";

/** Mild master load scale floor — primary load contrast lives on engine layers. */
export const MASTER_LOAD_SCALE_FLOOR = 0.92;

/** Character controls: 0.5 = authored identity; ±0.5 maps to bounded dB/scale. */
export const CHARACTER_NEUTRAL = 0.5;
export const BODY_CHARACTER_SHELF_DB = 3;
export const MECHANICAL_CHARACTER_SCALE = 0.35;
