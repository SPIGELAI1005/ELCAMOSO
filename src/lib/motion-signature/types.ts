/**
 * Motion Signature - ELCAMOSO visual IP.
 * Deterministic flowing curves derived from a drive's energy history (or seed).
 * Not a waveform. Not an equalizer. A collectible motion fingerprint.
 */

export interface MotionSignaturePoint {
  /** Normalized 0..1 along the drive timeline */
  t: number;
  /** Normalized energy 0..1 */
  energy: number;
}

export interface MotionSignatureInput {
  /** Stable visual seed (shareId, song seed, etc.) */
  seed: string | number;
  /** Optional energy history - privacy-safe scalars only */
  energy?: MotionSignaturePoint[] | number[];
  /** Ribbon count (default 3 for OG, up to 5 for larger canvases) */
  ribbons?: number;
  width?: number;
  height?: number;
  /** Visual family bias for marketing cards without energy history */
  family?: "brand" | "engine" | "symphony" | "world" | "fusion" | "drive-song";
}

export interface MotionSignatureRibbon {
  d: string;
  opacity: number;
  strokeWidth: number;
  /** 0 = primary FG, 1 = accent */
  accentWeight: number;
}

export interface MotionSignatureGeometry {
  width: number;
  height: number;
  seed: number;
  ribbons: MotionSignatureRibbon[];
  /** Soft guide arcs behind ribbons */
  guides: MotionSignatureRibbon[];
}
