import { isGenreId, type GenreId } from "./genres";

const KEY = "elcamoso.music.genre";
/** Bump to drop saved genre choices made before a default change (one-time migration). */
const MIGRATION_KEY = "elcamoso.music.genre.v";
const MIGRATION_VERSION = "2";

/** Profiles with a signature genre: the global picker never overrides them. */
const SIGNATURE_GENRES: Readonly<Record<string, GenreId>> = {
  "deep-bass-pulse": "electro",
  "fusion-road-anthem": "anthem",
  "fusion-midnight-boost": "darkrave",
};

/** One-time: clear genre choices saved before music v2 so new defaults apply. */
export function migrateGenreChoice(storage: Storage | undefined = globalThis.localStorage) {
  try {
    if (!storage || storage.getItem(MIGRATION_KEY) === MIGRATION_VERSION) return;
    storage.removeItem(KEY);
    storage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
  } catch {
    /* private mode */
  }
}
export type GenreChoice = GenreId | "auto";
const listeners = new Set<(g: GenreChoice) => void>();

/** Profile default when the listener leaves it on "auto". */
export function defaultGenreForProfile(profileId: string): GenreId {
  const signature = SIGNATURE_GENRES[profileId];
  if (signature) return signature;
  if (profileId.includes("rock")) return "rock";
  if (profileId.includes("neon")) return "house";
  if (profileId.includes("orchestra")) return "waltz";
  return "classic";
}

export function getGenreChoice(): GenreChoice {
  migrateGenreChoice();
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return isGenreId(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

export function setGenreChoice(g: GenreChoice) {
  try {
    if (g === "auto") globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, g);
  } catch {
    /* private mode */
  }
  for (const l of listeners) l(g);
}

export function subscribeGenreChoice(fn: (g: GenreChoice) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resolveGenre(profileId: string, choice: GenreChoice = getGenreChoice()): GenreId {
  const signature = SIGNATURE_GENRES[profileId];
  if (signature) return signature;
  return choice === "auto" ? defaultGenreForProfile(profileId) : choice;
}
