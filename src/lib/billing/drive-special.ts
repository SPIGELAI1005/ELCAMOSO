/**
 * Black Friday Special (replaces the ended 7 Days Drive Special).
 *
 * Window: 9 Nov 2026 00:00 until exclusive end 2026-11-28T00:00:00+01:00
 * (27 Nov 2026 23:59 Europe/Berlin).
 *
 * Midnight Dark Rave (`fusion-midnight-boost` / menu `genre:darkrave`):
 * signed-out visitors get 15 minutes per Berlin day (client localStorage);
 * signed-in drivers get it unlimited until the window ends. It does not count
 * against the 30-minute Drive the Music cap.
 *
 * Other Drive the Music sounds: signed-in drivers get
 * DRIVE_MUSIC_PACKAGE_ENTITLEMENTS for 30 minutes per Berlin day.
 * Logged-out users never get that 30-minute grant. Drive+ is NOT included.
 * Paying users and Founders who already own the music are not capped.
 * Landing Start Drive opens Midnight Dark Rave during the window, then Racing V10.
 *
 * The purple banner is a short teaser; full terms live on
 * /legal/terms#black-friday-special.
 *
 * Independent of the Black Friday Drive the Music 4-month checkout trial in
 * `black-friday.ts` — that deal is unchanged and must not double-count here.
 *
 * Client-safe: pure date math, shared by the server snapshot and the client.
 */
import { DRIVE_MUSIC_PACKAGE_ENTITLEMENTS } from "@/lib/entitlements/plans";
import type { Entitlement, Plan } from "@/lib/entitlements/types";
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";

/** Inclusive start: 9 Nov 2026 00:00 Europe/Berlin (CET, UTC+1). */
export const DRIVE_SPECIAL_START_ISO = "2026-11-09T00:00:00+01:00";
export const DRIVE_SPECIAL_START_MS = Date.parse(DRIVE_SPECIAL_START_ISO);
/** Exclusive end: 28 Nov 2026 00:00 Europe/Berlin (CET, UTC+1) — after Black Friday. */
export const DRIVE_SPECIAL_END_ISO = "2026-11-28T00:00:00+01:00";
export const DRIVE_SPECIAL_END_MS = Date.parse(DRIVE_SPECIAL_END_ISO);
export const DRIVE_SPECIAL_NAME = "Black Friday Special";
/** Short chip on Sounds list items. */
export const DRIVE_SPECIAL_BADGE = "Special";

/** Entitlements the special grants (Drive the Music only, never Drive+). */
export const DRIVE_SPECIAL_ENTITLEMENTS: readonly Entitlement[] = DRIVE_MUSIC_PACKAGE_ENTITLEMENTS;

/** Free minutes per Berlin day for signed-in drivers who only have the special. */
export const DRIVE_SPECIAL_DAILY_MINUTES = 30;
/** Free seconds per Berlin day for signed-in drivers who only have the special. */
export const DRIVE_SPECIAL_DAILY_SECONDS = DRIVE_SPECIAL_DAILY_MINUTES * 60;
/** Client heartbeat interval while a special sound plays. */
export const DRIVE_SPECIAL_HEARTBEAT_SECONDS = 30;

/** Engine sounds listed next to the music at the top of the sounds list. */
export const DRIVE_SPECIAL_COMPANION_IDS: readonly string[] = [
  "american-muscle-v8",
  "racing-v10",
  "police-patrol",
  "wild-west-carriage",
  "romanian-85-carriage",
];

/**
 * Catalog profile that plays Midnight Dark Rave (Drive the Music signature
 * for genre `darkrave`). Menu id is `genre:darkrave`.
 */
export const MIDNIGHT_DARK_RAVE_PROFILE_ID = "fusion-midnight-boost";
/** Sounds-menu item id for Midnight Dark Rave. */
export const MIDNIGHT_DARK_RAVE_MENU_ID = "genre:darkrave";
export const MIDNIGHT_DARK_RAVE_GENRE_ID = "darkrave";

/** Free minutes per Berlin day of Midnight Dark Rave for signed-out visitors. */
export const MIDNIGHT_DARK_RAVE_GUEST_DAILY_MINUTES = 15;
export const MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS = MIDNIGHT_DARK_RAVE_GUEST_DAILY_MINUTES * 60;

export function isMidnightDarkRaveProfile(profileId: string): boolean {
  return profileId === MIDNIGHT_DARK_RAVE_PROFILE_ID || profileId === MIDNIGHT_DARK_RAVE_MENU_ID;
}

/** Landing/home Start Drive profile: Midnight Dark Rave in-window, Racing V10 after. */
export function landingStartDriveProfileId(now: number = Date.now()): string {
  return isDriveSpecialActive(now) ? MIDNIGHT_DARK_RAVE_PROFILE_ID : FALLBACK_SOUND_PROFILE_ID;
}

export function remainingMidnightDarkRaveGuestSeconds(usedSeconds: number): number {
  return Math.max(0, MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS - Math.max(0, Math.floor(usedSeconds)));
}

export function isDriveSpecialActive(now: number = Date.now()): boolean {
  return now >= DRIVE_SPECIAL_START_MS && now < DRIVE_SPECIAL_END_MS;
}

/** Whether this account gets the special at `now` (signed in + inside the window). */
export function driveSpecialAppliesTo(
  accountId: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return Boolean(accountId) && isDriveSpecialActive(now);
}

/**
 * True when the account already owns Drive the Music through a purchase, Founder
 * perk, reward grant, or active trial — the 30-minute cap must not apply.
 */
export function userOwnsDriveTheMusicIndependently(input: {
  plan?: Plan | null;
  founderDrivePlusActive?: boolean | null;
  grantedEntitlements?: readonly Entitlement[] | null;
  trialActive?: boolean | null;
  trialEntitlements?: readonly Entitlement[] | null;
}): boolean {
  if (input.founderDrivePlusActive) return true;
  if (input.plan === "DRIVE_MUSIC" || input.plan === "DRIVE_COMPLETE") return true;
  if (input.grantedEntitlements?.includes("symphony_all")) return true;
  if (input.trialActive && input.trialEntitlements?.includes("symphony_all")) return true;
  return false;
}

/** Daily 30-minute cap applies: signed-in, in window, music access is only from the special. */
export function driveSpecialCapApplies(
  input: {
    accountId: string | null | undefined;
    plan?: Plan | null;
    founderDrivePlusActive?: boolean | null;
    grantedEntitlements?: readonly Entitlement[] | null;
    trialActive?: boolean | null;
    trialEntitlements?: readonly Entitlement[] | null;
  },
  now: number = Date.now(),
): boolean {
  return driveSpecialAppliesTo(input.accountId, now) && !userOwnsDriveTheMusicIndependently(input);
}

export function remainingDriveSpecialSeconds(usedSeconds: number): number {
  return Math.max(0, DRIVE_SPECIAL_DAILY_SECONDS - Math.max(0, Math.floor(usedSeconds)));
}

/** Purple accent for the special (banner + Sounds list marking). */
export const DRIVE_SPECIAL_PURPLE = "#a855f7";

/** Purple banner: short teaser only — no minutes, package name, or per-day details. */
export const DRIVE_SPECIAL_BANNER_TEXT = {
  en: {
    teaser: "Limited availability until 27th of November.",
    cta: "See the sounds",
    login: "Log In",
    terms: "See terms and conditions",
  },
  de: {
    teaser: "Nur begrenzt verfügbar bis 27. November.",
    cta: "Zu den Sounds",
    login: "Anmelden",
    terms: "Zu den Bedingungen",
  },
  ro: {
    teaser: "Disponibilitate limitată până pe 27 noiembrie.",
    cta: "Vezi sunetele",
    login: "Autentificare",
    terms: "Vezi termenii și condițiile",
  },
} as const;

export function driveSpecialBannerText(language: string | undefined) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro"
    ? DRIVE_SPECIAL_BANNER_TEXT[key]
    : DRIVE_SPECIAL_BANNER_TEXT.en;
}

export const DRIVE_SPECIAL_SOUNDS_HINT = {
  en: {
    signedIn:
      "Midnight Dark Rave is unlimited for you until Black Friday. Other Drive the Music sounds: 30 minutes a day.",
    signedOut:
      "Log in to unlock Drive the Music 30 minutes a day until Black Friday. Midnight Dark Rave: 15 minutes a day without an account.",
  },
  de: {
    signedIn:
      "Midnight Dark Rave ist für dich unbegrenzt bis Black Friday. Andere Drive-the-Music-Sounds: 30 Minuten am Tag.",
    signedOut:
      "Anmelden zum Freischalten: Drive the Music 30 Minuten am Tag bis Black Friday. Midnight Dark Rave: 15 Minuten am Tag ohne Konto.",
  },
  ro: {
    signedIn:
      "Midnight Dark Rave e nelimitat pentru tine până de Black Friday. Celelalte sunete Drive the Music: 30 minute pe zi.",
    signedOut:
      "Autentifică-te: Drive the Music 30 minute pe zi până de Black Friday. Midnight Dark Rave: 15 minute pe zi fără cont.",
  },
} as const;

export function driveSpecialSoundsHint(language: string | undefined, signedIn: boolean) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  const copy =
    key === "de" || key === "ro" ? DRIVE_SPECIAL_SOUNDS_HINT[key] : DRIVE_SPECIAL_SOUNDS_HINT.en;
  return signedIn ? copy.signedIn : copy.signedOut;
}

export type DriveSpecialCapCopy = {
  remaining: (min: number, sec: number) => string;
  title: string;
  body: string;
  cta: string;
  close: string;
};

const CAP_COPY: Record<"en" | "de" | "ro", DriveSpecialCapCopy> = {
  en: {
    remaining: (m, s) => `Black Friday Special: ${m}:${String(s).padStart(2, "0")} left today`,
    title: "Today's 30 free minutes are up",
    body: "Your Black Friday Special minutes come back tomorrow. Get Drive the Music to keep playing without a daily cap.",
    cta: "Get Drive the Music",
    close: "Not now",
  },
  de: {
    remaining: (m, s) => `Black Friday Special: noch ${m}:${String(s).padStart(2, "0")} heute`,
    title: "Die 30 Gratis-Minuten für heute sind vorbei",
    body: "Morgen gibt es wieder Black-Friday-Minuten. Mit Drive the Music spielst du ohne Tageslimit weiter.",
    cta: "Drive the Music holen",
    close: "Später",
  },
  ro: {
    remaining: (m, s) => `Black Friday Special: ${m}:${String(s).padStart(2, "0")} rămase azi`,
    title: "Cele 30 de minute gratuite de azi s-au terminat",
    body: "Minutele Black Friday revin mâine. Ia Drive the Music ca să asculți fără limită zilnică.",
    cta: "Ia Drive the Music",
    close: "Nu acum",
  },
};

export function driveSpecialCapCopy(language: string | undefined): DriveSpecialCapCopy {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? CAP_COPY[key] : CAP_COPY.en;
}

export type MidnightDarkRaveGuestCopy = {
  remaining: (min: number, sec: number) => string;
  title: string;
  body: string;
  signIn: string;
  close: string;
};

const MIDNIGHT_RAVE_GUEST_COPY: Record<"en" | "de" | "ro", MidnightDarkRaveGuestCopy> = {
  en: {
    remaining: (m, s) => `Midnight Dark Rave: ${m}:${String(s).padStart(2, "0")} left today`,
    title: "Sign in to keep driving",
    body: "Today's 15 minutes of Midnight Dark Rave are up. Sign in or sign up to keep driving with no daily limit until 27 November 2026.",
    signIn: "Sign in / Sign up",
    close: "Not now",
  },
  de: {
    remaining: (m, s) => `Midnight Dark Rave: noch ${m}:${String(s).padStart(2, "0")} heute`,
    title: "Anmelden, um weiterzufahren",
    body: "Die 15 Minuten Midnight Dark Rave für heute sind vorbei. Melde dich an oder registriere dich, um bis zum 27. November 2026 ohne Tageslimit weiterzufahren.",
    signIn: "Anmelden / Registrieren",
    close: "Später",
  },
  ro: {
    remaining: (m, s) => `Midnight Dark Rave: ${m}:${String(s).padStart(2, "0")} rămase azi`,
    title: "Autentifică-te ca să conduci mai departe",
    body: "Cele 15 minute de Midnight Dark Rave de azi s-au terminat. Conectează-te sau creează un cont ca să conduci fără limită zilnică până pe 27 noiembrie 2026.",
    signIn: "Conectare / Cont nou",
    close: "Nu acum",
  },
};

export function midnightDarkRaveGuestCopy(language: string | undefined): MidnightDarkRaveGuestCopy {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? MIDNIGHT_RAVE_GUEST_COPY[key] : MIDNIGHT_RAVE_GUEST_COPY.en;
}

export type BlackFridayWelcomeCopy = {
  title: string;
  body: string;
  startDrive: string;
  terms: string;
  foundersPack: string;
};

const WELCOME_COPY: Record<"en" | "de" | "ro", BlackFridayWelcomeCopy> = {
  en: {
    title: "Congratulations!",
    body: "Your Black Friday benefits are unlocked: Midnight Dark Rave unlimited and Drive the Music 30 minutes a day, until 27 November 2026. This offer has limited availability until 27 November. To keep access, purchase the Founders Pack — a yearly Drive+ or Drive the Music subscription.",
    startDrive: "Start Drive",
    terms: "See terms and conditions",
    foundersPack: "Founders Pack",
  },
  de: {
    title: "Glückwunsch!",
    body: "Deine Black-Friday-Vorteile sind freigeschaltet: Midnight Dark Rave unbegrenzt und Drive the Music 30 Minuten am Tag, bis zum 27. November 2026. Das Angebot ist nur begrenzt verfügbar bis 27. November. Um den Zugang zu behalten, kaufe das Founders Pack — ein jährliches Drive+ oder Drive the Music Abo.",
    startDrive: "Start Drive",
    terms: "Zu den Bedingungen",
    foundersPack: "Founders Pack",
  },
  ro: {
    title: "Felicitări!",
    body: "Beneficiile tale de Black Friday sunt deblocate: Midnight Dark Rave nelimitat și Drive the Music 30 de minute pe zi, până pe 27 noiembrie 2026. Oferta are disponibilitate limitată până pe 27 noiembrie. Ca să păstrezi accesul, cumpără Founders Pack — un abonament anual Drive+ sau Drive the Music.",
    startDrive: "Start Drive",
    terms: "Vezi termenii și condițiile",
    foundersPack: "Founders Pack",
  },
};

export function blackFridayWelcomeCopy(language: string | undefined): BlackFridayWelcomeCopy {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? WELCOME_COPY[key] : WELCOME_COPY.en;
}
