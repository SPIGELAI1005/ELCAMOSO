/**
 * Phone sync: a paired phone streams live GPS + motion to the car over an
 * ephemeral Supabase Realtime broadcast channel. Nothing is written to a database.
 */

/** Crockford-ish alphabet without look-alikes (no 0/O, 1/I/L). */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 10; // ~49.5 bits of entropy
export const CHANNEL_PREFIX = "elc-phone-sync:";
/** Car stops waiting for a phone after this long with no messages. */
export const PAIR_IDLE_EXPIRE_MS = 10 * 60_000;
/** Phone counts as disconnected after this long without a sample. */
export const PHONE_STALE_MS = 4_000;

export function generatePairCode(rand: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = rand(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

function defaultRandom(n: number): Uint8Array {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}

/** Uppercases, strips spaces/dashes, maps look-alikes. Returns null if invalid. */
export function normalizePairCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

export function formatPairCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function channelNameForCode(code: string): string {
  return CHANNEL_PREFIX + code;
}

export interface PhoneSample {
  t: number; // phone epoch ms
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null; // m/s
  heading: number | null; // deg
  /** Longitudinal accel, m/s² (+ = speeding up), gravity removed, smoothed. */
  longAccel: number | null;
  /** Lateral accel, m/s² (turn strength). */
  latAccel: number | null;
  /** Vertical jolt magnitude, m/s² (bumps). */
  bump: number | null;
}

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** Validates an incoming broadcast payload; never trusts the wire. */
export function parsePhoneSample(raw: unknown): PhoneSample | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const t = num(r["t"], 0, 1e14);
  if (t == null) return null;
  return {
    t,
    altitude: num(r["altitude"], -500, 9000),
    altitudeAccuracy: num(r["altitudeAccuracy"], 0, 10_000),
    speed: num(r["speed"], 0, 120),
    heading: num(r["heading"], 0, 360),
    longAccel: num(r["longAccel"], -30, 30),
    latAccel: num(r["latAccel"], -30, 30),
    bump: num(r["bump"], 0, 50),
  };
}
