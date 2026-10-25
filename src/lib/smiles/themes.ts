/** Smiles card themes (Smile Shop). Logos stay white on every theme. */
export interface CardTheme {
  id: string;
  name: string;
  /** CSS background for the on-screen card. */
  css: string;
  border: string;
  /** Share image: base fill and glow colour. */
  base: string;
  glow: string;
}

export const DEFAULT_THEME_ID = "default";
export const CARD_THEMES: CardTheme[] = [
  {
    id: DEFAULT_THEME_ID,
    name: "Classic",
    css: "linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02))",
    border: "rgba(255,255,255,.12)",
    base: "#050505",
    glow: "rgba(229,57,53,0.14)",
  },
  {
    id: "theme-midnight",
    name: "Midnight",
    css: "radial-gradient(ellipse at 50% 0%,rgba(70,110,255,.28),transparent 65%),linear-gradient(160deg,#0b1430,#050914)",
    border: "rgba(120,150,255,.28)",
    base: "#060b1c",
    glow: "rgba(70,110,255,0.30)",
  },
  {
    id: "theme-ember",
    name: "Ember",
    css: "radial-gradient(ellipse at 50% 100%,rgba(229,57,53,.38),transparent 65%),linear-gradient(160deg,#1e0806,#0a0302)",
    border: "rgba(229,57,53,.40)",
    base: "#120403",
    glow: "rgba(229,57,53,0.34)",
  },
  {
    id: "theme-chrome",
    name: "Chrome",
    css: "linear-gradient(135deg,rgba(255,255,255,.20),rgba(255,255,255,.03) 35%,rgba(255,255,255,.14) 55%,rgba(255,255,255,.02) 80%),linear-gradient(160deg,#2a2c30,#0d0e10)",
    border: "rgba(230,232,240,.38)",
    base: "#141518",
    glow: "rgba(220,225,235,0.20)",
  },
];

export const cardTheme = (id: string | null | undefined): CardTheme =>
  CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0]!;

/** Active theme only if owned (default is always allowed). */
export const resolveTheme = (id: string | null | undefined, owned: string[]): CardTheme =>
  id && (id === DEFAULT_THEME_ID || owned.includes(id)) ? cardTheme(id) : CARD_THEMES[0]!;

const KEY = "elcamoso.cardTheme.v1";
export function loadLocalTheme(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function saveLocalTheme(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
