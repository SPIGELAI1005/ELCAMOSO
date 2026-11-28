/**
 * Drive specials: Black Friday Special and Cyber Monday Special.
 *
 * Both run on the same mechanism, so the rules below apply to whichever window is active
 * (see DRIVE_SPECIAL_WINDOWS):
 *  - Black Friday Special: 9 Nov 2026 00:00 until exclusive end 2026-11-28T00:00:00+01:00
 *    (27 Nov 2026 23:59 Europe/Berlin).
 *  - Cyber Monday Special: 28 Nov 2026 00:00 until exclusive end 2026-12-01T00:00:00+01:00
 *    (30 Nov 2026 23:59 Europe/Berlin). It starts the instant Black Friday ends.
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
 * The welcome-modal Start Drive still opens Midnight Dark Rave during a window, then Racing V10.
 * The home-page Start Drive mark uses LANDING_START_DRIVE_PROFILE_ID (American Muscle V8) instead.
 *
 * The purple banner is a short teaser; full terms live on
 * /legal/terms#black-friday-special and /legal/terms#cyber-monday-special.
 *
 * Independent of the 4-month Drive the Music checkout trial and the Founders Pack in
 * `black-friday.ts` / `founders.ts`. Those deals now also run through Cyber Monday
 * (until 30 Nov 2026 23:59 Europe/Berlin) and must not be double-counted here.
 *
 * Client-safe: pure date math, shared by the server snapshot and the client.
 */
import { DRIVE_MUSIC_PACKAGE_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { isFoundersPackPurchaseOpen } from "@/lib/founders/founders";
import type { Entitlement, Plan } from "@/lib/entitlements/types";
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";

type Lang3 = { en: string; de: string; ro: string };

export type DriveSpecialId = "black-friday" | "cyber-monday";
export type DriveSpecialName = "Black Friday Special" | "Cyber Monday Special";

export interface DriveSpecialWindow {
  id: DriveSpecialId;
  /** Banner / Sounds section title. */
  name: DriveSpecialName;
  /** Event name used in sentences ("Black Friday"). */
  event: string;
  /** Anchor of its section on /legal/terms. */
  termsHash: string;
  /** "until Black Friday" in each language (Sounds hint). */
  until: Lang3;
  /** Inclusive start (Europe/Berlin). */
  startIso: string;
  startMs: number;
  /** Exclusive end (Europe/Berlin). The last day is the day before this instant. */
  endIso: string;
  endMs: number;
  /**
   * The welcome modal counts as seen for this window when the account's stored
   * `bf_welcome_seen_at` is on/after this instant (0 = any earlier sighting counts,
   * which keeps Black Friday's original once-per-account behaviour).
   */
  welcomeSeenSinceMs: number;
}

function makeWindow(
  w: Omit<DriveSpecialWindow, "startMs" | "endMs" | "welcomeSeenSinceMs"> & {
    welcomeSeenSinceMs?: number;
  },
): DriveSpecialWindow {
  const startMs = Date.parse(w.startIso);
  return {
    ...w,
    startMs,
    endMs: Date.parse(w.endIso),
    welcomeSeenSinceMs: w.welcomeSeenSinceMs ?? startMs,
  };
}

/** 9 Nov 2026 00:00 until exclusive 28 Nov 2026 00:00 Europe/Berlin (CET, UTC+1). */
export const BLACK_FRIDAY_WINDOW: DriveSpecialWindow = makeWindow({
  id: "black-friday",
  name: "Black Friday Special",
  event: "Black Friday",
  termsHash: "black-friday-special",
  until: { en: "until Black Friday", de: "bis Black Friday", ro: "până de Black Friday" },
  startIso: "2026-11-09T00:00:00+01:00",
  endIso: "2026-11-28T00:00:00+01:00",
  welcomeSeenSinceMs: 0,
});

/** 28 Nov 2026 00:00 until exclusive 1 Dec 2026 00:00 Europe/Berlin (CET, UTC+1). */
export const CYBER_MONDAY_WINDOW: DriveSpecialWindow = makeWindow({
  id: "cyber-monday",
  name: "Cyber Monday Special",
  event: "Cyber Monday",
  termsHash: "cyber-monday-special",
  until: {
    en: "until the end of Cyber Monday",
    de: "bis Ende Cyber Monday",
    ro: "până la sfârșitul Cyber Monday",
  },
  startIso: "2026-11-28T00:00:00+01:00",
  endIso: "2026-12-01T00:00:00+01:00",
});

/** Every special window, in time order. Add a window here to run another special. */
export const DRIVE_SPECIAL_WINDOWS: readonly DriveSpecialWindow[] = [
  BLACK_FRIDAY_WINDOW,
  CYBER_MONDAY_WINDOW,
];

/** Inclusive start of the first window (9 Nov 2026 00:00 Europe/Berlin). */
export const DRIVE_SPECIAL_START_ISO = DRIVE_SPECIAL_WINDOWS[0]!.startIso;
export const DRIVE_SPECIAL_START_MS = Date.parse(DRIVE_SPECIAL_START_ISO);
/** Exclusive end of the last window (1 Dec 2026 00:00 Europe/Berlin). */
export const DRIVE_SPECIAL_END_ISO =
  DRIVE_SPECIAL_WINDOWS[DRIVE_SPECIAL_WINDOWS.length - 1]!.endIso;
export const DRIVE_SPECIAL_END_MS = Date.parse(DRIVE_SPECIAL_END_ISO);
/** Short chip on Sounds list items. */
export const DRIVE_SPECIAL_BADGE = "Special";

/** The window that is open at `now`, if any. */
export function activeDriveSpecialWindow(now: number = Date.now()): DriveSpecialWindow | null {
  return DRIVE_SPECIAL_WINDOWS.find((w) => now >= w.startMs && now < w.endMs) ?? null;
}

/**
 * Window that copy should describe at `now`: the open one, else the latest that has
 * started (a UI that lingers just after the end), else the first.
 */
export function driveSpecialWindowForCopy(now: number = Date.now()): DriveSpecialWindow {
  const active = activeDriveSpecialWindow(now);
  if (active) return active;
  const started = DRIVE_SPECIAL_WINDOWS.filter((w) => now >= w.startMs);
  return started[started.length - 1] ?? DRIVE_SPECIAL_WINDOWS[0]!;
}

/** "Black Friday Special" / "Cyber Monday Special" for `now`. */
export function driveSpecialName(now: number = Date.now()): DriveSpecialName {
  return driveSpecialWindowForCopy(now).name;
}

/**
 * End of the uninterrupted run of windows that contains `now` (back-to-back windows
 * count as one run), or null when no special is open.
 */
export function driveSpecialRunEndMs(now: number = Date.now()): number | null {
  const active = activeDriveSpecialWindow(now);
  if (!active) return null;
  let end = active.endMs;
  for (const w of DRIVE_SPECIAL_WINDOWS) {
    if (w.startMs <= end && w.endMs > end) end = w.endMs;
  }
  return end;
}

const MONTHS: Record<"en" | "de" | "ro", readonly string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  de: [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ],
  ro: [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
  ],
};

type Lang = "en" | "de" | "ro";
function langKey(language: string | undefined): Lang {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? key : "en";
}

const BERLIN_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Calendar day of the window's last moment in Berlin (exclusive end minus 1 ms). */
function lastDayParts(w: DriveSpecialWindow): { day: number; month: number; year: number } {
  const parts = BERLIN_DATE.formatToParts(new Date(w.endMs - 1));
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: pick("day"), month: pick("month"), year: pick("year") };
}

function englishOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Last day of the window as a date label: "27 November 2026", "27. November 2026", ... */
export function driveSpecialLastDayLabel(
  w: DriveSpecialWindow,
  language: string | undefined,
  opts: { year?: boolean } = {},
): string {
  const lang = langKey(language);
  const { day, month, year } = lastDayParts(w);
  const name = MONTHS[lang][month - 1]!;
  const y = opts.year ? ` ${year}` : "";
  return lang === "de" ? `${day}. ${name}${y}` : `${day} ${name}${y}`;
}

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

/**
 * Profile the home-page Start Drive mark selects. American Muscle V8 (the Coyote V8,
 * same engine Police Patrol reuses) — a better promo for the app than the previous
 * Midnight Dark Rave "song" sound. Only applied while the special is active, which is
 * when the hero used to pin a profile; after the window it leaves the user's current sound.
 */
export const LANDING_START_DRIVE_PROFILE_ID = "american-muscle-v8";

/** True when the home-page Start Drive mark should pin LANDING_START_DRIVE_PROFILE_ID. */
export function landingHeroPinsStartProfile(now: number = Date.now()): boolean {
  return isDriveSpecialActive(now);
}

/** Welcome-modal Start Drive profile: Midnight Dark Rave in a window, Racing V10 after. */
export function landingStartDriveProfileId(now: number = Date.now()): string {
  return isDriveSpecialActive(now) ? MIDNIGHT_DARK_RAVE_PROFILE_ID : FALLBACK_SOUND_PROFILE_ID;
}

export function remainingMidnightDarkRaveGuestSeconds(usedSeconds: number): number {
  return Math.max(0, MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS - Math.max(0, Math.floor(usedSeconds)));
}

export function isDriveSpecialActive(now: number = Date.now()): boolean {
  return activeDriveSpecialWindow(now) !== null;
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
export function driveSpecialBannerText(language: string | undefined, now: number = Date.now()) {
  const w = driveSpecialWindowForCopy(now);
  const lang = langKey(language);
  const { day } = lastDayParts(w);
  const month = driveSpecialLastDayLabel(w, lang).replace(/^\d+\.?\s*/, "");
  const copy = {
    en: {
      teaser: `Limited availability until ${englishOrdinal(day)} of ${month}.`,
      cta: "See the sounds",
      signup: "Sign up",
      terms: "See terms and conditions",
    },
    de: {
      teaser: `Nur begrenzt verfügbar bis ${day}. ${month}.`,
      cta: "Zu den Sounds",
      signup: "Registrieren",
      terms: "Zu den Bedingungen",
    },
    ro: {
      teaser: `Disponibilitate limitată până pe ${day} ${month}.`,
      cta: "Vezi sunetele",
      signup: "Înregistrare",
      terms: "Vezi termenii și condițiile",
    },
  } as const;
  return copy[lang];
}

/** Sign-up dialog text shared by the banner, Sounds page, header menu and genre picker. */
export function driveSpecialSignUpDescription(
  language: string | undefined,
  now: number = Date.now(),
): string {
  const w = driveSpecialWindowForCopy(now);
  const lang = langKey(language);
  const until = driveSpecialLastDayLabel(w, lang);
  if (lang === "de") {
    return `Lege ein Konto an, um Midnight Dark Rave unbegrenzt und Drive the Music 30 Minuten am Tag bis zum ${until} zu nutzen.`;
  }
  if (lang === "ro") {
    return `Creează un cont ca să ai Midnight Dark Rave nelimitat și Drive the Music 30 de minute pe zi până pe ${until}.`;
  }
  return `Create an account to keep Midnight Dark Rave unlimited and Drive the Music 30 minutes a day until ${until}.`;
}

export function driveSpecialSoundsHint(
  language: string | undefined,
  signedIn: boolean,
  now: number = Date.now(),
) {
  const w = driveSpecialWindowForCopy(now);
  const lang = langKey(language);
  const until = w.until[lang];
  const copy = {
    en: {
      signedIn: `Midnight Dark Rave is unlimited for you ${until}. Other Drive the Music sounds: 30 minutes a day.`,
      signedOut: `Log in to unlock Drive the Music 30 minutes a day ${until}. Midnight Dark Rave: 15 minutes a day without an account.`,
    },
    de: {
      signedIn: `Midnight Dark Rave ist für dich unbegrenzt ${until}. Andere Drive-the-Music-Sounds: 30 Minuten am Tag.`,
      signedOut: `Anmelden zum Freischalten: Drive the Music 30 Minuten am Tag ${until}. Midnight Dark Rave: 15 Minuten am Tag ohne Konto.`,
    },
    ro: {
      signedIn: `Midnight Dark Rave e nelimitat pentru tine ${until}. Celelalte sunete Drive the Music: 30 minute pe zi.`,
      signedOut: `Autentifică-te: Drive the Music 30 minute pe zi ${until}. Midnight Dark Rave: 15 minute pe zi fără cont.`,
    },
  }[lang];
  return signedIn ? copy.signedIn : copy.signedOut;
}

export type DriveSpecialCapCopy = {
  remaining: (min: number, sec: number) => string;
  title: string;
  body: string;
  cta: string;
  close: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function driveSpecialCapCopy(
  language: string | undefined,
  now: number = Date.now(),
): DriveSpecialCapCopy {
  const w = driveSpecialWindowForCopy(now);
  const lang = langKey(language);
  // The daily minutes only "come back tomorrow" while a special is still open tomorrow.
  const returns = isDriveSpecialActive(now + DAY_MS);
  const hyphenated = w.event.replace(/ /g, "-");
  const mmss = (m: number, s: number) => `${m}:${String(s).padStart(2, "0")}`;
  switch (lang) {
    case "de":
      return {
        remaining: (m, s) => `${w.name}: noch ${mmss(m, s)} heute`,
        title: "Die 30 Gratis-Minuten für heute sind vorbei",
        body: returns
          ? `Morgen gibt es wieder ${hyphenated}-Minuten. Mit Drive the Music spielst du ohne Tageslimit weiter.`
          : "Mit Drive the Music spielst du ohne Tageslimit weiter.",
        cta: "Drive the Music holen",
        close: "Später",
      };
    case "ro":
      return {
        remaining: (m, s) => `${w.name}: ${mmss(m, s)} rămase azi`,
        title: "Cele 30 de minute gratuite de azi s-au terminat",
        body: returns
          ? `Minutele ${w.event} revin mâine. Ia Drive the Music ca să asculți fără limită zilnică.`
          : "Ia Drive the Music ca să asculți fără limită zilnică.",
        cta: "Ia Drive the Music",
        close: "Nu acum",
      };
    default:
      return {
        remaining: (m, s) => `${w.name}: ${mmss(m, s)} left today`,
        title: "Today's 30 free minutes are up",
        body: returns
          ? `Your ${w.name} minutes come back tomorrow. Get Drive the Music to keep playing without a daily cap.`
          : "Get Drive the Music to keep playing without a daily cap.",
        cta: "Get Drive the Music",
        close: "Not now",
      };
  }
}

export type MidnightDarkRaveGuestCopy = {
  remaining: (min: number, sec: number) => string;
  title: string;
  body: string;
  signUp: string;
  signIn: string;
  close: string;
  signUpTitle: string;
  signUpDescription: string;
  signInTitle: string;
  signInDescription: string;
};

export function midnightDarkRaveGuestCopy(
  language: string | undefined,
  now: number = Date.now(),
): MidnightDarkRaveGuestCopy {
  const w = driveSpecialWindowForCopy(now);
  const lang = langKey(language);
  const until = driveSpecialLastDayLabel(w, lang, { year: true });
  const mmss = (m: number, s: number) => `${m}:${String(s).padStart(2, "0")}`;
  switch (lang) {
    case "de":
      return {
        remaining: (m, s) => `Midnight Dark Rave: noch ${mmss(m, s)} heute`,
        title: "Die 15 Minuten für heute sind vorbei",
        body: `Registriere dich oder melde dich an, um Midnight Dark Rave bis zum ${until} ohne Tageslimit weiter zu nutzen.`,
        signUp: "Registrieren",
        signIn: "Anmelden",
        close: "Später",
        signUpTitle: "Registrieren",
        signUpDescription: `Lege ein Konto an, um Midnight Dark Rave bis zum ${until} unbegrenzt zu nutzen.`,
        signInTitle: "Anmelden",
        signInDescription: `Melde dich an, um Midnight Dark Rave bis zum ${until} unbegrenzt zu nutzen.`,
      };
    case "ro":
      return {
        remaining: (m, s) => `Midnight Dark Rave: ${mmss(m, s)} rămase azi`,
        title: "Cele 15 minute de azi s-au terminat",
        body: `Înregistrează-te sau autentifică-te ca să te bucuri de Midnight Dark Rave fără limită zilnică până pe ${until}.`,
        signUp: "Înregistrare",
        signIn: "Autentificare",
        close: "Nu acum",
        signUpTitle: "Înregistrare",
        signUpDescription: `Creează un cont ca să păstrezi Midnight Dark Rave nelimitat până pe ${until}.`,
        signInTitle: "Autentificare",
        signInDescription: `Autentifică-te ca să păstrezi Midnight Dark Rave nelimitat până pe ${until}.`,
      };
    default:
      return {
        remaining: (m, s) => `Midnight Dark Rave: ${mmss(m, s)} left today`,
        title: "Today's 15 minutes are up",
        body: `Sign up or sign in to keep enjoying Midnight Dark Rave with no daily limit until ${until}.`,
        signUp: "Sign up",
        signIn: "Sign in",
        close: "Not now",
        signUpTitle: "Sign up",
        signUpDescription: `Create an account to keep Midnight Dark Rave unlimited until ${until}.`,
        signInTitle: "Sign in",
        signInDescription: `Sign in to keep Midnight Dark Rave unlimited until ${until}.`,
      };
  }
}

export type DriveSpecialWelcomeCopy = {
  title: string;
  body: string;
  startDrive: string;
  terms: string;
  /**
   * Second button. Founders Pack while that purchase window is open (Black Friday and
   * Cyber Monday); otherwise a link to the plans.
   */
  secondary: { kind: "founders" | "plans"; label: string };
  /** Anchor on /legal/terms for the "terms" link. */
  termsHash: string;
};

/** Welcome-modal text for whichever special is open at `now`. */
export function driveSpecialWelcomeCopy(
  language: string | undefined,
  now: number = Date.now(),
): DriveSpecialWelcomeCopy {
  const w = driveSpecialWindowForCopy(now);
  const lang = langKey(language);
  const full = driveSpecialLastDayLabel(w, lang, { year: true });
  const short = driveSpecialLastDayLabel(w, lang);
  const founders = isFoundersPackPurchaseOpen(now);
  const hyphenated = w.event.replace(/ /g, "-");
  if (lang === "de") {
    return {
      title: "Glückwunsch!",
      body: `Deine ${hyphenated}-Vorteile sind freigeschaltet: Midnight Dark Rave unbegrenzt und Drive the Music 30 Minuten am Tag, bis zum ${full}. Das Angebot ist nur begrenzt verfügbar bis ${short}. ${
        founders
          ? "Um den Zugang zu behalten, kaufe das Founders Pack — ein jährliches Drive+ oder Drive the Music Abo."
          : "Um den Zugang zu behalten, hol dir Drive+ oder Drive the Music."
      }`,
      startDrive: "Start Drive",
      terms: "Zu den Bedingungen",
      secondary: founders
        ? { kind: "founders", label: "Founders Pack" }
        : { kind: "plans", label: "Zu den Paketen" },
      termsHash: w.termsHash,
    };
  }
  if (lang === "ro") {
    return {
      title: "Felicitări!",
      body: `Beneficiile tale de ${w.event} sunt deblocate: Midnight Dark Rave nelimitat și Drive the Music 30 de minute pe zi, până pe ${full}. Oferta are disponibilitate limitată până pe ${short}. ${
        founders
          ? "Ca să păstrezi accesul, cumpără Founders Pack — un abonament anual Drive+ sau Drive the Music."
          : "Ca să păstrezi accesul, ia Drive+ sau Drive the Music."
      }`,
      startDrive: "Start Drive",
      terms: "Vezi termenii și condițiile",
      secondary: founders
        ? { kind: "founders", label: "Founders Pack" }
        : { kind: "plans", label: "Vezi planurile" },
      termsHash: w.termsHash,
    };
  }
  return {
    title: "Congratulations!",
    body: `Your ${w.event} benefits are unlocked: Midnight Dark Rave unlimited and Drive the Music 30 minutes a day, until ${full}. This offer has limited availability until ${short}. ${
      founders
        ? "To keep access, purchase the Founders Pack — a yearly Drive+ or Drive the Music subscription."
        : "To keep access, get Drive+ or Drive the Music."
    }`,
    startDrive: "Start Drive",
    terms: "See terms and conditions",
    secondary: founders
      ? { kind: "founders", label: "Founders Pack" }
      : { kind: "plans", label: "See plans" },
    termsHash: w.termsHash,
  };
}
