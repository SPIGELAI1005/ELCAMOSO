/** Smile rewards: pure rules shared by server and UI (no DB here). */
export const DAILY_SMILE_CAP = 150;
export const SHARE_BONUS_RATE = 0.25;
export const REFERRAL_BONUS = 100;
export const STREAK_BONUS = 50;
export const STREAK_DAYS = 7;
export const FOUNDER_MULTIPLIER = 1.5;

export const SMILE_LEVELS = [
  { name: "Cruiser", min: 0 },
  { name: "Smiler", min: 500 },
  { name: "Grinner", min: 2000 },
  { name: "Joyrider", min: 5000 },
  { name: "Legend", min: 15000 },
] as const;
export type SmileLevelName = (typeof SMILE_LEVELS)[number]["name"];

export interface SmileLevelInfo {
  name: SmileLevelName;
  next: SmileLevelName | null;
  nextAt: number | null;
  /** 0..1 progress toward the next level (1 at Legend). */
  progress: number;
}

/** Level is based on lifetime earned smiles (shop spending never drops a level). */
export function smileLevel(earned: number): SmileLevelInfo {
  const e = Math.max(0, Math.floor(earned));
  let i = 0;
  for (let k = 0; k < SMILE_LEVELS.length; k++) if (e >= SMILE_LEVELS[k]!.min) i = k;
  const cur = SMILE_LEVELS[i]!;
  const nxt = SMILE_LEVELS[i + 1];
  if (!nxt) return { name: cur.name, next: null, nextAt: null, progress: 1 };
  return {
    name: cur.name,
    next: nxt.name,
    nextAt: nxt.min,
    progress: Math.min(1, (e - cur.min) / (nxt.min - cur.min)),
  };
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
}

export const SMILE_SHOP: ShopItem[] = [
  { id: "theme-midnight", kind: "theme", name: "Midnight card", blurb: "Deep blue card theme.", cost: 300 },
  { id: "theme-ember", kind: "theme", name: "Ember card", blurb: "Glowing red card theme.", cost: 500 },
  { id: "theme-chrome", kind: "theme", name: "Chrome card", blurb: "Mirror-finish card theme.", cost: 800 },
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
});
