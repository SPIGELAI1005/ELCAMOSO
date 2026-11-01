import { useEffect, useState } from "react";

import { GENRES } from "@/lib/symphony/adaptive/genres";
import {
  getGenreChoice,
  resolveGenre,
  subscribeGenreChoice,
  type GenreChoice,
} from "@/lib/symphony/adaptive/genre-store";
import { SYMPHONY_SOUND_PROFILES } from "@/lib/symphony/symphony-profiles";

const SYMPHONY_IDS = new Set(SYMPHONY_SOUND_PROFILES.map((p) => p.id));

export function isSymphonyProfileId(profileId: string): boolean {
  return SYMPHONY_IDS.has(profileId);
}

/** Small live genre line under the Drive title while a Symphony sound is active. */
export function DriveGenreSubtitle({ profileId }: { profileId: string }) {
  const [choice, setChoice] = useState<GenreChoice>(() => getGenreChoice());
  useEffect(() => {
    setChoice(getGenreChoice());
    return subscribeGenreChoice(setChoice);
  }, []);
  if (!isSymphonyProfileId(profileId)) return null;
  const name = GENRES[resolveGenre(profileId, choice)]?.name;
  if (!name) return null;
  return (
    <p
      className="mt-0.5 truncate text-[11px] tracking-[0.08em] text-muted-foreground"
      data-testid="drive-genre-subtitle"
      aria-live="polite"
    >
      {name}
    </p>
  );
}
