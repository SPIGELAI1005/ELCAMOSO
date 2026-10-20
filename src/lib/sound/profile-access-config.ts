/**
 * Permanent free Sound Profile set (Prompt 11).
 * Three catalog IDs — American Muscle V8, GT V8, Racing V10 (George, Oct 2026).
 * Every other profile is Drive+ once SOUND_TIER_GATE_STARTS_AT is reached.
 * Adjust here only; do not scatter free-tier lists across UI components.
 */

export interface FreeSoundProfileSlot {
  id: string;
  role: "muscle" | "gt" | "racing" | "future";
  rationale: string;
}

/**
 * Permanent free trio (actual catalog IDs).
 * Grandfathered / purchased profile grants are separate — shrinking this list
 * must not revoke a previously purchased unlock.
 */
export const FREE_SOUND_PROFILE_SET: readonly FreeSoundProfileSlot[] = [
  {
    id: "american-muscle-v8",
    role: "muscle",
    rationale:
      "Body-led American V8 character with strong low-end presence; showcases free-tier gear realism and cabin weight without requiring Drive+.",
  },
  {
    id: "gt-v8",
    role: "gt",
    rationale:
      "Refined grand-tourer V8 with smooth mid-range pull — complementary free-tier foil to the muscle body.",
  },
  {
    id: "racing-v10",
    role: "racing",
    rationale:
      "High-rev racing V10 character; proves free tier includes a motorsport profile alongside muscle and GT.",
  },
] as const;

/** Ordered free profile ids derived from FREE_SOUND_PROFILE_SET. */
export const FREE_SOUND_PROFILE_IDS: readonly string[] = FREE_SOUND_PROFILE_SET.map(
  (slot) => slot.id,
);

/** Safe fallback when a Drive+ profile is denied mid-drive (always a free id). */
export const FALLBACK_SOUND_PROFILE_ID: string = FREE_SOUND_PROFILE_IDS[0] ?? "american-muscle-v8";

/** Max seconds for a non-driving preview of a Drive+ profile without entitlement. */
export const LOCKED_PROFILE_PREVIEW_SECONDS = 20;

/**
 * Single source of truth for when the free/Drive+ sound split starts:
 * 9 November 2026 00:00 Europe/Berlin (CET, UTC+1) = 2026-11-08T23:00:00Z.
 * Before this instant every Sound Profile (and Symphony/World/Fusion sound) is free.
 */
export const SOUND_TIER_GATE_STARTS_AT_ISO = "2026-11-09T00:00:00+01:00";
export const SOUND_TIER_GATE_STARTS_AT_UTC_MS: number = Date.parse(SOUND_TIER_GATE_STARTS_AT_ISO);
/** Short label for UI copy ("Free until 9 Nov"). */
export const SOUND_TIER_GATE_LABEL = "9 Nov";

export function simulatedSoundGateNow(): number | null {
  // Local/preview simulation only — ignored in production builds.
  try {
    if (import.meta.env?.PROD) return null;
    const raw: string | undefined = import.meta.env?.["VITE_SOUND_GATE_SIMULATE_NOW"];
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/** "Now" for the sound tier gate (honours a non-production simulation override). */
export function soundGateNow(): number {
  return simulatedSoundGateNow() ?? Date.now();
}

/** True once the Drive+ sound gate is in force. */
export function isSoundTierGateActive(now: number = soundGateNow()): boolean {
  return now >= SOUND_TIER_GATE_STARTS_AT_UTC_MS;
}
