/**
 * Founders Pack (pre-launch promotion).
 *
 * Existing (legacy) Founders: a verified sign-in on/before
 * FOUNDER_PAID_UNLIMITED_CUTOVER (9 Nov 2026 23:59 Europe/Berlin) claims a seat.
 * They keep Racing V10, American Muscle V8 and GT V8 forever, and Drive Unlimited
 * until 27.05.2027. The Black Friday Special does not grant a free Founder seat
 * after that cutover.
 *
 * Founders Pack purchase: a YEARLY Drive+ or YEARLY Drive the Music subscription
 * (existing Stripe yearly prices — no new product) bought until Black Friday
 * 27.11.2026 23:59:59 Europe/Berlin. Buying mints a Founder seat, grants Drive
 * Unlimited for 4 months from the purchase date, then falls back to the paid
 * package, and lets the buyer pick 4 catalog sounds that stay theirs forever
 * even after cancel. Display amount is €33.60/year (same as Drive+ / Drive the
 * Music yearly). STRIPE_PRICE_FOUNDERS_PACK is unused.
 *
 * Founders also receive the Black Friday Special while that window is open.
 * Drive Unlimited already uncaps the special's 30-minute Drive the Music limit.
 */

import { addMonthsUtc } from "@/lib/billing/black-friday";

/** First instant a yearly Drive+ / Drive the Music purchase counts as Founders Pack. */
export const FOUNDERS_PACK_PURCHASE_START_ISO = "2026-11-09T00:00:00+01:00";
export const FOUNDERS_PACK_PURCHASE_START_MS = Date.parse(FOUNDERS_PACK_PURCHASE_START_ISO);

/** Black Friday 27.11.2026 23:59:59 Europe/Berlin (CET, UTC+1). */
export const FOUNDERS_SIGNUP_DEADLINE_ISO = "2026-11-27T23:59:59+01:00";
export const FOUNDERS_SIGNUP_DEADLINE_MS = Date.parse(FOUNDERS_SIGNUP_DEADLINE_ISO);

/** 27.05.2027 23:59:59 Europe/Berlin (CEST, UTC+2) — legacy Founder Drive Unlimited end. */
export const FOUNDER_DRIVE_PLUS_UNTIL_ISO = "2027-05-27T23:59:59+02:00";
export const FOUNDER_DRIVE_PLUS_UNTIL_MS = Date.parse(FOUNDER_DRIVE_PLUS_UNTIL_ISO);

/**
 * Founders whose `founder_at` is on/before this instant (9 Nov 2026 23:59 Berlin)
 * keep legacy perks (GT V8 forever + Drive Unlimited until 27.05.2027). Later
 * seats come only from a yearly Drive+ / Drive the Music purchase.
 */
export const FOUNDER_PAID_UNLIMITED_CUTOVER_ISO = "2026-11-09T23:59:59+01:00";
export const FOUNDER_PAID_UNLIMITED_CUTOVER_MS = Date.parse(FOUNDER_PAID_UNLIMITED_CUTOVER_ISO);

/** Drive Unlimited length granted on a paid Founders Pack purchase. */
export const FOUNDER_PACK_UNLIMITED_MONTHS = 4;

/** Provenance label on 4-month Drive Unlimited grants from a yearly Founders Pack purchase. */
export const FOUNDERS_PACK_GRANT_SOURCE = "founders_pack";

/** Provenance label on the 4 forever-sound picks. */
export const FOUNDERS_FOREVER_PICK_SOURCE = "founders_forever_pick";

/** Provenance label on legacy Founder forever sounds (GT V8). */
export const FOUNDERS_LEGACY_FOREVER_SOURCE = "founders_legacy_forever";

/** How many catalog sounds a paid Founders Pack buyer may keep forever. */
export const FOUNDER_FOREVER_PICK_LIMIT = 4;

/**
 * Extra forever sounds for legacy Founders. Racing V10 and American Muscle V8
 * are already globally free; GT V8 is the distinctive legacy forever sound.
 */
export const LEGACY_FOUNDER_FOREVER_PROFILE_IDS: readonly string[] = ["gt-v8"];

/** Env holding the Stripe Price id. Empty until the owner creates the product — do not invent a price. */
export const STRIPE_PRICE_FOUNDERS_PACK_ENV = "STRIPE_PRICE_FOUNDERS_PACK";

/** Free engine profiles Founders keep forever. */
export { FREE_SOUND_PROFILE_IDS as FOUNDER_FOREVER_PROFILE_IDS } from "@/lib/sound/profile-access-config";

export interface FounderStatus {
  /** UTC epoch ms when the account became a Founder (seat claim). */
  since: number;
  /** UTC epoch ms when the Founder Drive Unlimited perk ends; 0 if none. */
  drivePlusUntil: number;
}

/** True while a free Founder seat can still be claimed (through 9 Nov 2026 23:59 Berlin). */
export function isFounderSignupOpen(now = Date.now()): boolean {
  return now <= FOUNDER_PAID_UNLIMITED_CUTOVER_MS;
}

/**
 * True while the Founders Pack can still be purchased (through Black Friday
 * 27.11.2026 23:59:59 Berlin). Independent of free seat claims.
 */
export function isFoundersPackPurchaseOpen(now = Date.now()): boolean {
  return now <= FOUNDERS_SIGNUP_DEADLINE_MS;
}

/**
 * Eligibility for a free Founder seat: account created AND email confirmed
 * before the 09.11 cutover. `confirmedAt` is the time of a verified sign-in.
 */
export function isFounderEligible(input: {
  createdAt: number | null | undefined;
  confirmedAt: number | null | undefined;
}): boolean {
  const { createdAt, confirmedAt } = input;
  if (createdAt == null || confirmedAt == null) return false;
  if (!Number.isFinite(createdAt) || !Number.isFinite(confirmedAt)) return false;
  return (
    createdAt <= FOUNDER_PAID_UNLIMITED_CUTOVER_MS &&
    confirmedAt <= FOUNDER_PAID_UNLIMITED_CUTOVER_MS
  );
}

/** True when this claim timestamp is a legacy Founder (on/before 9 Nov 2026 23:59 Berlin). */
export function isLegacyFounderClaim(founderAt: number | null | undefined): boolean {
  return (
    founderAt != null &&
    Number.isFinite(founderAt) &&
    founderAt <= FOUNDER_PAID_UNLIMITED_CUTOVER_MS
  );
}

/** Yearly Drive+ or yearly Drive the Music — the Founders Pack checkout, not a new Stripe product. */
export function isFoundersPackQualifyingPlan(
  plan: string | null | undefined,
  interval: string | null | undefined,
): boolean {
  if (interval !== "year") return false;
  return plan === "DRIVE_PLUS" || plan === "DRIVE_MUSIC";
}

/** True when this timestamp is inside the Founders Pack purchase window (9–27 Nov 2026 Berlin). */
export function isFoundersPackQualifyingPurchaseTime(ts: number): boolean {
  return (
    Number.isFinite(ts) &&
    ts >= FOUNDERS_PACK_PURCHASE_START_MS &&
    ts <= FOUNDERS_SIGNUP_DEADLINE_MS
  );
}

/** Drive Unlimited expiry from a Founders Pack purchase timestamp. */
export function foundersPackUnlimitedUntilMs(purchasedAt: number): number {
  return addMonthsUtc(purchasedAt, FOUNDER_PACK_UNLIMITED_MONTHS);
}

/**
 * When Drive Unlimited from the Founders Pack ends.
 * Legacy claims: fixed 27.05.2027. New claims: 4 months from purchase, or none.
 */
export function founderDriveUnlimitedUntilMs(input: {
  founderAt: number | null | undefined;
  purchasedAt?: number | null;
}): number | null {
  if (isLegacyFounderClaim(input.founderAt)) return FOUNDER_DRIVE_PLUS_UNTIL_MS;
  if (input.purchasedAt != null && Number.isFinite(input.purchasedAt)) {
    return foundersPackUnlimitedUntilMs(input.purchasedAt);
  }
  return null;
}

export function founderStatusFrom(
  founderAt: number | null | undefined,
  purchasedAt: number | null | undefined = null,
): FounderStatus | null {
  if (founderAt == null || !Number.isFinite(founderAt)) return null;
  if (founderAt > FOUNDERS_SIGNUP_DEADLINE_MS) return null;
  const until = founderDriveUnlimitedUntilMs({ founderAt, purchasedAt });
  return { since: founderAt, drivePlusUntil: until ?? 0 };
}

/** Founder Drive Unlimited perk active at `now`. */
export function isFounderDrivePlusActive(
  founderAt: number | null | undefined,
  now = Date.now(),
  purchasedAt: number | null | undefined = null,
): boolean {
  const status = founderStatusFrom(founderAt, purchasedAt);
  return status != null && status.drivePlusUntil > 0 && now <= status.drivePlusUntil;
}

/** Remaining ms until the signup deadline (0 after). */
export function msUntilFounderDeadline(now = Date.now()): number {
  return Math.max(0, FOUNDERS_SIGNUP_DEADLINE_MS - now);
}

export function splitCountdown(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/** Max number of Founders (env FOUNDER_SEAT_LIMIT overrides, default 458). */
export const DEFAULT_FOUNDER_SEAT_LIMIT = 458;
export function founderSeatLimit(): number {
  const raw = typeof process !== "undefined" ? process.env?.["FOUNDER_SEAT_LIMIT"] : undefined;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FOUNDER_SEAT_LIMIT;
}

/** Whether a free Founder seat can be minted now given the current seat count. */
export function canMintFounder(
  seatsTaken: number,
  now = Date.now(),
  limit = founderSeatLimit(),
): boolean {
  return isFounderSignupOpen(now) && seatsTaken < limit;
}

/** Whether a paid Founders Pack purchase can still assign a seat. */
export function canMintFounderFromPurchase(
  seatsTaken: number,
  now = Date.now(),
  limit = founderSeatLimit(),
): boolean {
  return isFoundersPackPurchaseOpen(now) && seatsTaken < limit;
}

export function seatsLeft(seatsTaken: number, limit = founderSeatLimit()): number {
  return Math.max(0, limit - seatsTaken);
}

/** Marketing perks for new (paid) Founders Pack buyers. */
export const FOUNDER_PERKS = [
  "4 sounds of your choice, free forever (any library)",
  "Yearly Drive+ or Drive the Music: Drive Unlimited for 4 months from purchase, then your package",
  "Founders Test Crew: new features first",
  "Exclusive Crew perks to follow",
] as const;

/** Perks line for a Founder who already holds a seat (legacy vs new). */
export function founderPerkLine(founderAt: number | null | undefined, language = "en"): string {
  const key = language.slice(0, 2).toLowerCase();
  if (isLegacyFounderClaim(founderAt)) {
    if (key === "de")
      return "3 Sounds für immer gratis · 6 Monate Drive+ gratis · Founders Test Crew: neue Features zuerst · Exklusive Crew-Vorteile folgen";
    if (key === "ro")
      return "3 sunete gratuite pentru totdeauna · 6 luni Drive+ gratuit · Founders Test Crew: functii noi primele · Beneficii exclusive Crew vor urma";
    return "3 sounds free forever · 6 months Drive+ free · Founders Test Crew: new features first · Exclusive Crew perks to follow";
  }
  if (key === "de")
    return "4 Sounds für immer gratis · Drive Unlimited für 4 Monate beim Kauf des Founders Pack · Founders Test Crew: neue Features zuerst · Exklusive Crew-Vorteile folgen";
  if (key === "ro")
    return "4 sunete gratuite pentru totdeauna · Drive Unlimited 4 luni la cumpărarea Founders Pack · Founders Test Crew: functii noi primele · Beneficii exclusive Crew vor urma";
  return "4 sounds free forever · Drive Unlimited for 4 months when you buy the Founders Pack · Founders Test Crew: new features first · Exclusive Crew perks to follow";
}

export const FOUNDERS_OFFER_COPY = {
  en: {
    compact: "Buy until 27.11.",
    compactPerk: " · yearly Drive+ or Drive the Music",
    fullPerk:
      " Buy yearly Drive+ or Drive the Music until 27.11. Drive Unlimited for 4 months, then your package. 4 sounds forever.",
    claimTitle: "Claim your Founder seat",
    claimBody:
      "Free Founder seats closed on 9.11. Buy yearly Drive+ or Drive the Music until 27.11. to become a Founder: Drive Unlimited for 4 months from purchase and 4 sounds forever.",
    buy: "Buy Founders Pack",
    claim: "Claim it",
  },
  de: {
    compact: "Kaufen bis 27.11.",
    compactPerk: " · jährliches Drive+ oder Drive the Music",
    fullPerk:
      " Kaufe jährliches Drive+ oder Drive the Music bis 27.11. Drive Unlimited für 4 Monate, dann dein Paket. 4 Sounds für immer.",
    claimTitle: "Founder-Platz sichern",
    claimBody:
      "Kostenlose Founder-Plätze endeten am 9.11. Kaufe jährliches Drive+ oder Drive the Music bis 27.11., um Founder zu werden: Drive Unlimited 4 Monate ab Kauf und 4 Sounds für immer.",
    buy: "Founders Pack kaufen",
    claim: "Sichern",
  },
  ro: {
    compact: "Cumpara pana pe 27.11.",
    compactPerk: " · Drive+ sau Drive the Music anual",
    fullPerk:
      " Cumpara Drive+ sau Drive the Music anual pana pe 27.11. Drive Unlimited 4 luni, apoi pachetul platit. 4 sunete pentru totdeauna.",
    claimTitle: "Rezerva locul Founder",
    claimBody:
      "Locurile Founder gratuite s-au inchis pe 9.11. Cumpara Drive+ sau Drive the Music anual pana pe 27.11. ca sa devii Founder: Drive Unlimited 4 luni de la achizitie si 4 sunete pentru totdeauna.",
    buy: "Cumpara Founders Pack",
    claim: "Rezerva",
  },
} as const;

export function foundersOfferCopy(language: string | undefined) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? FOUNDERS_OFFER_COPY[key] : FOUNDERS_OFFER_COPY.en;
}
