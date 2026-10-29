import { isGenreId, type GenreId } from "./genres";

const KEY = "elcamoso.music.genre";
export type GenreChoice = GenreId | "auto";
const listeners = new Set<(g: GenreChoice) => void>();

/** Profile default when the listener leaves it on "auto". */
export function defaultGenreForProfile(profileId: string): GenreId {
  if (profileId.includes("rock")) return "rock";
  if (profileId.includes("neon")) return "house";
  return "classic";
}

export function getGenreChoice(): GenreChoice {
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
  return choice === "auto" ? defaultGenreForProfile(profileId) : choice;
}
