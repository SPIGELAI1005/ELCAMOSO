import { HALLOWEEN_PROFILE_IDS, isHalloweenWindow } from "@/lib/sound/profile-access-config";

export const HALLOWEEN_TAG = "Halloween 🎃 Special";
/** Distinctive pumpkin orange for the Halloween tag, banner and article accents. */
export const HALLOWEEN_ORANGE = "#ff7a1a";
export const HALLOWEEN_ARTICLE_PATH = "/news/halloween";

export interface HalloweenSound {
  id: string;
  name: string;
  image: string;
  copy: string;
  access: string;
}

export const HALLOWEEN_SOUNDS: readonly HalloweenSound[] = [
  {
    id: "dracula-carriage",
    name: "Dracula Carriage",
    image: "/hero/sound-profiles/dracula-carriage.png",
    copy: "A ghost coach pulled by a pale horse through a howling night. Hooves, creaking wood, whooshing gusts, a distant scream and an evil laugh, over a dark organ-and-choir score that follows your speed.",
    access: "Free",
  },
  {
    id: "police-patrol",
    name: "Police Patrol",
    image: "/hero/sound-profiles/police-patrol.png",
    copy: "Your car in costume. A deep V8 with a wailing siren that switches to a yelp when you push, and a red-and-blue roof bar that flashes faster as you speed up.",
    access: "Free until 1 Nov",
  },
];

/**
 * Pin the Halloween profiles first during the window; returns the input untouched otherwise.
 */
export function halloweenPinned<T extends { id: string }>(
  profiles: readonly T[],
  now?: number,
): { pinned: T[]; rest: T[] } {
  if (!isHalloweenWindow(now)) return { pinned: [], rest: [...profiles] };
  const pinned = HALLOWEEN_PROFILE_IDS.map((id) => profiles.find((p) => p.id === id)).filter(
    (p): p is T => Boolean(p),
  );
  return { pinned, rest: profiles.filter((p) => !HALLOWEEN_PROFILE_IDS.includes(p.id)) };
}

export { isHalloweenWindow };
