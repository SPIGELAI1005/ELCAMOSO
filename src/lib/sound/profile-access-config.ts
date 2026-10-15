/**
 * Permanent free Sound Profile set (Prompt 11).
 * Three EXISTING high-quality catalog IDs — American Muscle V8, GT V8, Racing V10.
 * Adjust here only; do not scatter free-tier lists across UI components.
 */

export interface FreeSoundProfileSlot {
  id: string;
  role: "muscle" | "gt" | "racing";
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
