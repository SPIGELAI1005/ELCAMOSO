import { allProfiles, type SoundProfile } from "@/lib/sound/profiles";

export interface SoundMatch {
  profileId: string;
  name: string;
  category: string;
  reason: string;
  score: number;
}

/** Extra search aliases so plain language hits the right character. */
const ALIASES: Record<string, string[]> = {
  "laughing-machine": ["laugh", "giggle", "joyful", "joy", "funny", "crack up", "contagious"],
  "farting-car": ["fart", "rude", "gas", "bubbly", "toilet", "flatulent"],
  "kazoo-kart": ["kazoo", "buzz", "silly", "toy", "kart", "pocket"],
  "neon-drive": ["neon", "night", "pulse", "digital", "cyber night", "electronic"],
  "construction-monster": ["construction", "hydraulic", "diesel", "digger", "excavator", "industrial", "monster machine"],
  "horse-gallop": ["horse", "gallop", "hoof", "equine"],
  "heartbeat": ["heart", "pulse soft", "organic beat"],
  "deep-bass-pulse": ["bass", "sub", "cabin boom", "low end"],
  "zen-drive": ["zen", "calm", "meditat", "peaceful", "quiet"],
  "rain-drive": ["rain", "wet", "storm road"],
  "ocean-drive": ["ocean", "sea", "wave", "coast"],
  "retro-arcade": ["arcade", "8-bit", "pixel", "chiptune"],
  "synthwave-drive": ["synthwave", "retrowave", "80s"],
  "gt-v8": ["v8", "muscle classic", "gt"],
  "american-muscle-v8": ["muscle", "american v8", "camaro"],
  "turbo-inline-6": ["turbo", "spool", "wastegate", "blowoff"],
  "electric-hypercar": ["hypercar", "inverter", "electric race"],
  "formula-electric": ["formula", "fe", "open wheel electric"],
  "motorcycle-superbike": ["bike", "superbike", "motorcycle"],
  "big-twin": ["twin", "harley", "v-twin"],
  submarine: ["sub", "sonar", "underwater"],
  dragon: ["dragon", "mythic", "creature"],
  "thunder-beast": ["beast", "thunder", "dark pressure"],
  "steam-train": ["steam", "chuff", "locomotive"],
  tank: ["tank", "tracks", "armor"],
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreProfile(prompt: string, profile: SoundProfile): { score: number; reason: string } {
  const q = prompt.toLowerCase().trim();
  if (!q) return { score: 0, reason: "" };
  const words = tokens(q);
  let score = 0;
  const hits: string[] = [];

  const hay = [
    profile.name,
    profile.description,
    profile.category,
    ...profile.traits,
    profile.id.replace(/-/g, " "),
  ]
    .join(" ")
    .toLowerCase();

  if (hay.includes(q)) {
    score += 12;
    hits.push(`matches “${prompt.trim().slice(0, 40)}”`);
  }

  for (const w of words) {
    if (profile.name.toLowerCase().includes(w)) {
      score += 5;
      hits.push(profile.name);
    }
    if (profile.category.toLowerCase().includes(w)) {
      score += 3;
      hits.push(profile.category);
    }
    for (const trait of profile.traits) {
      if (trait.toLowerCase().includes(w) || w.includes(trait.toLowerCase())) {
        score += 4;
        hits.push(trait);
      }
    }
    if (profile.description.toLowerCase().includes(w)) score += 2;
    if (profile.id.includes(w)) score += 3;
  }

  const aliases = ALIASES[profile.id] ?? [];
  for (const alias of aliases) {
    if (q.includes(alias) || words.some((w) => alias.includes(w) || w.includes(alias))) {
      score += 8;
      hits.push(alias);
    }
  }

  // Mood heuristics
  if (/(joy|fun|play|laugh|silly|absurd)/.test(q) && profile.category === "Playful") {
    score += 4;
    hits.push("Playful");
  }
  if (/(calm|gentle|quiet|soft|relax|zen)/.test(q) && /zen|rain|ocean|heartbeat|deep bass/i.test(profile.name)) {
    score += 5;
  }
  if (/(intense|loud|race|aggress|spirited)/.test(q) && /Motorsport|Classic|Machines/.test(profile.category)) {
    score += 3;
  }
  if (/(night|neon|digital|future)/.test(q) && profile.category === "Future") {
    score += 4;
  }

  const unique = [...new Set(hits)].slice(0, 3);
  const reason =
    unique.length > 0
      ? `Fits ${unique.join(", ")}.`
      : `Close to ${profile.category.toLowerCase()} character.`;

  return { score, reason };
}

/** On-device catalog matcher. No motion or location data. */
export function findSoundsFromPrompt(prompt: string, limit = 3): SoundMatch[] {
  const ranked = allProfiles()
    .filter((p) => p.category !== "Garage")
    .map((profile) => {
      const { score, reason } = scoreProfile(prompt, profile);
      return {
        profileId: profile.id,
        name: profile.name,
        category: profile.category,
        reason,
        score,
      } satisfies SoundMatch;
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return ranked.slice(0, Math.max(1, limit));
}

export const FIND_SOUND_EXAMPLES = [
  "joyful when I accelerate",
  "night neon pulses",
  "hydraulic digger under load",
  "calm cabin after dark",
  "rude and bubbly",
] as const;
