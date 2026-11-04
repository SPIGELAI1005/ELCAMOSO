/**
 * Guest trial (George, 4 Nov 2026): visitors who are NOT signed in may drive a
 * small set of sounds for 7 minutes per day, from the end of the 7 Days Drive
 * Special for 30 days. Logged-in users are never affected.
 *
 * Client-safe: pure config + date math, shared by the API route and the client.
 * To extend the window, change GUEST_TRIAL_DAYS (or set GUEST_TRIAL_END_ISO).
 */
import { DRIVE_SPECIAL_END_ISO } from "@/lib/billing/drive-special";

/** Starts exactly when the 7 Days Drive Special ends (9 Nov 2026 00:00 Berlin). */
export const GUEST_TRIAL_START_ISO = DRIVE_SPECIAL_END_ISO;
export const GUEST_TRIAL_DAYS = 30;
/** Exclusive end: 9 Dec 2026 00:00 Berlin (CET, UTC+1). */
export const GUEST_TRIAL_END_ISO = "2026-12-09T00:00:00+01:00";
export const GUEST_TRIAL_START_MS = Date.parse(GUEST_TRIAL_START_ISO);
export const GUEST_TRIAL_END_MS = Date.parse(GUEST_TRIAL_END_ISO);

/** Free seconds per Berlin day per guest. */
export const GUEST_TRIAL_DAILY_SECONDS = 7 * 60;
/** Client heartbeat interval while driving a trial sound. */
export const GUEST_TRIAL_HEARTBEAT_SECONDS = 30;
/** Max seconds the server credits for one heartbeat (interval + slack). */
export const GUEST_TRIAL_MAX_CREDIT_PER_BEAT = 40;

/** Sound profiles in the guest trial (exact catalog ids). */
export const GUEST_TRIAL_PROFILE_IDS: readonly string[] = [
  "american-muscle-v8",
  "racing-v10",
  "symphony-latino-fiesta", // Latino
  "fusion-midnight-boost", // Midnight Boost
];
/**
 * Genres without their own profile: they play through the genre host profile
 * (symphony-motion-orchestra) and appear in menus as `genre:<id>`.
 */
export const GUEST_TRIAL_GENRE_IDS: readonly string[] = ["waltz", "house"]; // Vienna Waltz, House
export const GUEST_TRIAL_GENRE_HOST_ID = "symphony-motion-orchestra";

export function isGuestTrialWindow(now: number = Date.now()): boolean {
  return now >= GUEST_TRIAL_START_MS && now < GUEST_TRIAL_END_MS;
}

/**
 * Whether `profileId` (or menu id `genre:<id>`) is covered by the guest trial.
 * For the genre host profile, the currently chosen genre must be a trial genre.
 */
export function isGuestTrialProfile(profileId: string, currentGenre?: string | null): boolean {
  if (GUEST_TRIAL_PROFILE_IDS.includes(profileId)) return true;
  if (profileId.startsWith("genre:")) {
    return GUEST_TRIAL_GENRE_IDS.includes(profileId.slice("genre:".length));
  }
  if (profileId === GUEST_TRIAL_GENRE_HOST_ID) {
    return Boolean(currentGenre && GUEST_TRIAL_GENRE_IDS.includes(currentGenre));
  }
  return false;
}

const berlinDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Berlin calendar day "YYYY-MM-DD" — the counter resets at Berlin midnight. */
export function berlinDayKey(now: number = Date.now()): string {
  return berlinDay.format(new Date(now));
}

export function remainingGuestSeconds(usedSeconds: number): number {
  return Math.max(0, GUEST_TRIAL_DAILY_SECONDS - Math.max(0, Math.floor(usedSeconds)));
}

/** Seconds to credit for one heartbeat: claimed time, bounded by wall clock and cap. */
export function creditForHeartbeat(
  claimedSeconds: number,
  lastSeenMs: number | null,
  now: number,
): number {
  const claimed = Number.isFinite(claimedSeconds) ? Math.max(0, claimedSeconds) : 0;
  let bound = GUEST_TRIAL_MAX_CREDIT_PER_BEAT;
  if (lastSeenMs != null && now > lastSeenMs) {
    bound = Math.min(bound, Math.ceil((now - lastSeenMs) / 1000) + 2);
  }
  return Math.floor(Math.min(claimed, bound));
}

/** Non-production date override for previews/tests (client: VITE_, server: plain env). */
export function guestTrialNow(): number {
  try {
    if (import.meta.env?.PROD) return Date.now();
    const raw: string | undefined =
      import.meta.env?.["VITE_GUEST_TRIAL_SIMULATE_NOW"] ??
      (typeof process !== "undefined" ? process.env?.["GUEST_TRIAL_SIMULATE_NOW"] : undefined);
    if (!raw) return Date.now();
    const t = Date.parse(raw);
    // Keep the clock ticking from the simulated start.
    return Number.isFinite(t) ? t + (Date.now() - BOOT_MS) : Date.now();
  } catch {
    return Date.now();
  }
}
const BOOT_MS = Date.now();

export type GuestTrialCopy = {
  remaining: (min: number, sec: number) => string;
  title: string;
  body: string;
  signIn: string;
  close: string;
};

const COPY: Record<"en" | "de" | "ro", GuestTrialCopy> = {
  en: {
    remaining: (m, s) => `Free guest drive: ${m}:${String(s).padStart(2, "0")} left today`,
    title: "Your 7 free minutes are up for today",
    body: "Log in or sign up to keep driving. Your free guest minutes come back tomorrow.",
    signIn: "Log in or sign up",
    close: "Not now",
  },
  de: {
    remaining: (m, s) => `Gratis-Fahrt als Gast: noch ${m}:${String(s).padStart(2, "0")} heute`,
    title: "Deine 7 Gratis-Minuten für heute sind vorbei",
    body: "Melde dich an oder registriere dich, um weiterzufahren. Morgen gibt es wieder Gratis-Minuten.",
    signIn: "Anmelden oder registrieren",
    close: "Später",
  },
  ro: {
    remaining: (m, s) => `Condus gratuit ca vizitator: ${m}:${String(s).padStart(2, "0")} rămase azi`,
    title: "Cele 7 minute gratuite de azi s-au terminat",
    body: "Conectează-te sau creează un cont ca să conduci în continuare. Mâine primești din nou minute gratuite.",
    signIn: "Conectare sau cont nou",
    close: "Nu acum",
  },
};

export function guestTrialCopy(language: string | undefined): GuestTrialCopy {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? COPY[key] : COPY.en;
}
