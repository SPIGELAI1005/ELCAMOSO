/** Smile rewards: pure rules shared by server and UI (no DB here). */
export const DAILY_SMILE_CAP = 150;
export const SHARE_BONUS_RATE = 0.25;
export const REFERRAL_BONUS = 100;
export const INVITE_MAX_MONTHS = 6;
export const STREAK_BONUS = 50;
export const STREAK_DAYS = 7;
export const FOUNDER_MULTIPLIER = 1.5;

export const SMILE_LEVELS = [
  { name: "Cruiser", min: 0 },
  { name: "Smiler", min: 400 },
  { name: "Grinner", min: 1200 },
  { name: "Joyrider", min: 3000 },
  { name: "Legend", min: 8000 },
] as const;
export type SmileLevelName = (typeof SMILE_LEVELS)[number]["name"];

export const SMILE_LEVEL_NAMES = SMILE_LEVELS.map((l) => l.name);

export interface SmileLevelInfo {
  name: SmileLevelName;
  next: SmileLevelName | null;
  nextAt: number | null;
  /** 0..1 progress toward the next level (1 at Legend). */
  progress: number;
}

export type LeaderboardBadge = "mark" | "crown" | null;

/** Rank 0..4 so we can keep the higher of two level names. */
export function smileLevelRank(name: string | null | undefined): number {
  const i = SMILE_LEVELS.findIndex((l) => l.name === name);
  return i < 0 ? 0 : i;
}

export function isSmileLevelName(name: string | null | undefined): name is SmileLevelName {
  return SMILE_LEVELS.some((l) => l.name === name);
}

export function higherSmileLevel(
  a: string | null | undefined,
  b: string | null | undefined,
): SmileLevelName {
  return smileLevelRank(a) >= smileLevelRank(b)
    ? isSmileLevelName(a)
      ? a
      : "Cruiser"
    : isSmileLevelName(b)
      ? b
      : "Cruiser";
}

function levelInfoAt(index: number, earned: number): SmileLevelInfo {
  const i = Math.max(0, Math.min(SMILE_LEVELS.length - 1, index));
  const cur = SMILE_LEVELS[i]!;
  const nxt = SMILE_LEVELS[i + 1];
  if (!nxt) return { name: cur.name, next: null, nextAt: null, progress: 1 };
  const e = Math.max(0, Math.floor(earned));
  return {
    name: cur.name,
    next: nxt.name,
    nextAt: nxt.min,
    progress: Math.min(1, Math.max(0, (e - cur.min) / (nxt.min - cur.min))),
  };
}

/** Level is based on lifetime earned smiles (shop spending never drops a level). */
export function smileLevel(earned: number): SmileLevelInfo {
  const e = Math.max(0, Math.floor(earned));
  let i = 0;
  for (let k = 0; k < SMILE_LEVELS.length; k++) if (e >= SMILE_LEVELS[k]!.min) i = k;
  return levelInfoAt(i, e);
}

/**
 * Never drop below a previously stored peak (grandfathering when thresholds change).
 * `floor` is smile_level_peak or the last written smile_level.
 */
export function smileLevelWithFloor(earned: number, floor?: string | null): SmileLevelInfo {
  const computed = smileLevel(earned);
  if (!floor || smileLevelRank(floor) <= smileLevelRank(computed.name)) return computed;
  return levelInfoAt(smileLevelRank(floor), earned);
}

/** Themes granted for free once this level is reached (and every level below). */
export const LEVEL_THEME_UNLOCKS: Record<SmileLevelName, string[]> = {
  Cruiser: [],
  Smiler: ["theme-midnight"],
  Grinner: ["theme-ember"],
  Joyrider: ["theme-chrome"],
  Legend: ["theme-legend"],
};

export function themesUnlockedByLevel(name: SmileLevelName): string[] {
  const rank = smileLevelRank(name);
  return SMILE_LEVELS.flatMap((l, i) => (i <= rank ? LEVEL_THEME_UNLOCKS[l.name] : []));
}

export function challengeEligibleAt(name: SmileLevelName): boolean {
  return smileLevelRank(name) >= smileLevelRank("Grinner");
}

export function leaderboardBadgeFor(name: SmileLevelName): LeaderboardBadge {
  if (name === "Legend") return "crown";
  if (smileLevelRank(name) >= smileLevelRank("Smiler")) return "mark";
  return null;
}

/** One-line shop / Crew hint for what this level unlocks. */
export const LEVEL_UNLOCK_LINES: Record<SmileLevelName, string> = {
  Cruiser: "Classic card theme",
  Smiler: "Midnight card and a leaderboard mark, free",
  Grinner: "Ember card and monthly-challenge entry, free",
  Joyrider: "Chrome card, free",
  Legend: "Legend card, a reserved drop, and a board crown",
};

export function mergeOwnedItems(redeemed: string[], level: SmileLevelName): string[] {
  return [...new Set([...redeemed, ...themesUnlockedByLevel(level)])];
}

/** Apply Founder multiplier then clamp to what is left of today's cap. */
export function cappedAward(base: number, earnedToday: number, founder: boolean): number {
  const raw = Math.round(Math.max(0, base) * (founder ? FOUNDER_MULTIPLIER : 1));
  return Math.max(0, Math.min(raw, DAILY_SMILE_CAP - Math.max(0, earnedToday)));
}

export const shareBonusBase = (cardScore: number) =>
  Math.round(Math.max(0, cardScore) * SHARE_BONUS_RATE);

/** YYYY-MM-DD in Europe/Berlin. */
export function berlinDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** True when `days` (Berlin YYYY-MM-DD) contain the STREAK_DAYS consecutive days ending `today`. */
export function hasStreak(days: Iterable<string>, today: string): boolean {
  const set = new Set(days);
  const d = new Date(`${today}T12:00:00Z`);
  for (let i = 0; i < STREAK_DAYS; i++) {
    const key = new Date(d.getTime() - i * 86400_000).toISOString().slice(0, 10);
    if (!set.has(key)) return false;
  }
  return true;
}

/** Monday (Berlin) of the week containing `ms`, as YYYY-MM-DD. Leaderboards reset here. */
export function weekStart(ms: number): string {
  const today = berlinDay(ms);
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return new Date(d.getTime() - dow * 86400_000).toISOString().slice(0, 10);
}

/** Stable anonymous name for leaderboards (never an email). */
export function anonName(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const adj = ["Swift", "Happy", "Loud", "Silent", "Bold", "Sunny", "Rapid", "Grinning"];
  const noun = ["Driver", "Racer", "Cruiser", "Pilot", "Rider", "Drifter"];
  return `${adj[h % adj.length]} ${noun[(h >>> 4) % noun.length]} ${String(h % 1000).padStart(3, "0")}`;
}

export const HANDLE_RE = /^[A-Za-z0-9_.-]{3,20}$/;
export const REF_CODE_RE = /^[a-z0-9]{6,12}$/;

export type ShopKind = "theme" | "drive_plus_trial" | "limited_sound";
export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  blurb: string;
  cost: number;
  /** Placeholder items are visible but not redeemable yet. */
  soon?: boolean;
  /** If set, this item is included for free at this level (never charged). */
  unlockLevel?: SmileLevelName;
}

export const SMILE_SHOP: ShopItem[] = [
  {
    id: "theme-midnight",
    kind: "theme",
    name: "Midnight card",
    blurb: "Deep blue card theme. Included free at Smiler.",
    cost: 300,
    unlockLevel: "Smiler",
  },
  {
    id: "theme-ember",
    kind: "theme",
    name: "Ember card",
    blurb: "Glowing red card theme. Included free at Grinner.",
    cost: 500,
    unlockLevel: "Grinner",
  },
  {
    id: "theme-chrome",
    kind: "theme",
    name: "Chrome card",
    blurb: "Mirror-finish card theme. Included free at Joyrider.",
    cost: 800,
    unlockLevel: "Joyrider",
  },
  {
    id: "drive-plus-3d",
    kind: "drive_plus_trial",
    name: "Drive+ for 3 days",
    blurb: "Every sound, every mode. 72 hours of grins.",
    cost: 1000,
  },
  {
    id: "monthly-drop",
    kind: "limited_sound",
    name: "Monthly drop",
    blurb: "A limited sound, only for smiles. Coming soon.",
    cost: 1500,
    soon: true,
  },
  {
    id: "theme-legend",
    kind: "theme",
    name: "Legend card",
    blurb: "Gold-mark theme. Unlocked only at Legend, never sold.",
    cost: 0,
    unlockLevel: "Legend",
  },
  {
    id: "legend-drop",
    kind: "limited_sound",
    name: "Legend drop",
    blurb: "A reserved sound for Legends. Coming soon.",
    cost: 0,
    soon: true,
    unlockLevel: "Legend",
  },
];

export const shopItem = (id: string) => SMILE_SHOP.find((i) => i.id === id) ?? null;

export interface SmileStatus {
  available: boolean;
  balance: number;
  earned: number;
  level: SmileLevelInfo;
  earnedToday: number;
  refCode: string | null;
  handle: string | null;
  owned: string[];
  /** Active card theme id (null = not stored / column missing). */
  activeTheme: string | null;
  /** Latest "Bring a friend" Drive+ unlock (last 30 days), for a one-time toast. */
  inviteReward: { id: string; role: "inviter" | "inviter-capped" | "friend" } | null;
  /** Drive+ months earned from invites (lifetime cap INVITE_MAX_MONTHS). */
  inviteMonths: number;
}

export const emptySmileStatus = (): SmileStatus => ({
  available: false,
  balance: 0,
  earned: 0,
  level: smileLevel(0),
  earnedToday: 0,
  refCode: null,
  handle: null,
  owned: [],
  activeTheme: null,
  inviteReward: null,
  inviteMonths: 0,
});
