import type { SoundProfile } from "@/lib/sound/profiles";
import { allProfiles } from "@/lib/sound/profiles";

export type SoundMood =
  "all" | "powerful" | "futuristic" | "mechanical" | "calm" | "cinematic" | "playful";

export const SOUND_MOODS: { id: SoundMood; label: string }[] = [
  { id: "all", label: "All" },
  { id: "powerful", label: "Powerful" },
  { id: "futuristic", label: "Futuristic" },
  { id: "mechanical", label: "Mechanical" },
  { id: "calm", label: "Calm" },
  { id: "cinematic", label: "Cinematic" },
  { id: "playful", label: "Playful" },
];

export type SoundSection =
  | "Featured"
  | "Performance"
  | "Electric"
  | "Machines"
  | "Worlds"
  | "Nature"
  | "Ambient"
  | "Just for Fun";

const TRAIT_MOOD: Record<string, SoundMood[]> = {
  deep: ["powerful", "mechanical"],
  mechanical: ["mechanical", "powerful"],
  powerful: ["powerful"],
  sharp: ["powerful"],
  "high-rev": ["powerful"],
  responsive: ["powerful"],
  electric: ["futuristic"],
  futuristic: ["futuristic"],
  immersive: ["futuristic", "cinematic"],
  track: ["powerful"],
  aggressive: ["powerful"],
  precise: ["mechanical"],
  gravel: ["mechanical"],
  turbo: ["powerful", "mechanical"],
  raw: ["powerful", "mechanical"],
  vast: ["cinematic", "calm"],
  cinematic: ["cinematic"],
  weightless: ["calm", "cinematic"],
  theremin: ["futuristic"],
  gliding: ["calm", "futuristic"],
  otherworldly: ["futuristic", "cinematic"],
  spray: ["cinematic"],
  planing: ["cinematic"],
  "open water": ["calm", "cinematic"],
  enormous: ["cinematic"],
  slow: ["calm"],
  serene: ["calm"],
  bells: ["playful", "cinematic"],
  snow: ["cinematic"],
  joyful: ["playful"],
  hooves: ["mechanical", "cinematic"],
  wooden: ["mechanical"],
  dusty: ["cinematic"],
  cobblestone: ["mechanical"],
  "iron-rimmed": ["mechanical"],
  village: ["cinematic"],
  giggling: ["playful"],
  contagious: ["playful"],
  absurd: ["playful"],
  rude: ["playful"],
  bubbly: ["playful"],
  ridiculous: ["playful"],
  chuffing: ["mechanical", "cinematic"],
  iron: ["mechanical"],
  nostalgic: ["cinematic"],
  buzzy: ["playful"],
  silly: ["playful"],
  tiny: ["playful"],
  spooling: ["powerful", "mechanical"],
  roaring: ["powerful"],
  immense: ["powerful", "cinematic"],
  chopping: ["mechanical"],
  hovering: ["futuristic"],
  refined: ["calm", "mechanical"],
  effortless: ["calm"],
  "single-cylinder": ["mechanical"],
  stubborn: ["mechanical", "playful"],
  bavarian: ["playful"],
  airy: ["calm"],
  calm: ["calm"],
  gusting: ["cinematic"],
  wild: ["cinematic", "powerful"],
  pulse: ["futuristic"],
  neon: ["futuristic"],
  zen: ["calm"],
  rain: ["calm", "cinematic"],
  ocean: ["calm", "cinematic"],
  heartbeat: ["calm", "cinematic"],
};

const CATEGORY_SECTION: Record<string, SoundSection> = {
  Classic: "Performance",
  Motorsport: "Performance",
  Future: "Electric",
  Nautical: "Worlds",
  Aviation: "Worlds",
  Machines: "Machines",
  Nature: "Nature",
  Heritage: "Worlds",
  Musical: "Ambient",
  Festive: "Just for Fun",
  Playful: "Just for Fun",
};

const FEATURED_IDS = ["gt-v8", "racing-v10", "cyber-pulse", "zen-drive", "open-wind"];

function moodsForProfile(profile: SoundProfile): Set<SoundMood> {
  const moods = new Set<SoundMood>();
  for (const trait of profile.traits) {
    const key = trait.toLowerCase();
    for (const mood of TRAIT_MOOD[key] ?? []) moods.add(mood);
  }
  if (profile.category === "Playful" || profile.category === "Festive") moods.add("playful");
  if (profile.category === "Nature" || profile.category === "Musical") moods.add("calm");
  if (profile.category === "Future") moods.add("futuristic");
  if (profile.category === "Classic" || profile.category === "Motorsport") moods.add("powerful");
  if (profile.category === "Machines" || profile.category === "Heritage") moods.add("mechanical");
  return moods;
}

export function profileMatchesMood(profile: SoundProfile, mood: SoundMood): boolean {
  if (mood === "all") return true;
  return moodsForProfile(profile).has(mood);
}

export function sectionForProfile(profile: SoundProfile): SoundSection {
  if (FEATURED_IDS.includes(profile.id)) return "Featured";
  return CATEGORY_SECTION[profile.category] ?? "Worlds";
}

export function profilesByMood(mood: SoundMood): SoundProfile[] {
  return allProfiles().filter((p) => p.category !== "Garage" && profileMatchesMood(p, mood));
}

export function groupProfilesBySection(profiles: SoundProfile[]): {
  section: SoundSection;
  items: SoundProfile[];
}[] {
  const order: SoundSection[] = [
    "Featured",
    "Performance",
    "Electric",
    "Machines",
    "Worlds",
    "Nature",
    "Ambient",
    "Just for Fun",
  ];
  const map = new Map<SoundSection, SoundProfile[]>();
  for (const section of order) map.set(section, []);
  for (const profile of profiles) {
    const section = sectionForProfile(profile);
    // Featured IDs also appear in their natural section via category - keep Featured exclusive.
    if (FEATURED_IDS.includes(profile.id)) {
      map.get("Featured")!.push(profile);
      continue;
    }
    map.get(section)!.push(profile);
  }
  return order
    .map((section) => ({ section, items: map.get(section) ?? [] }))
    .filter((g) => g.items.length > 0);
}

export function searchProfiles(query: string, mood: SoundMood = "all"): SoundProfile[] {
  const q = query.trim().toLowerCase();
  return profilesByMood(mood).filter((p) => {
    if (!q) return true;
    const hay = [p.name, p.description, p.category, ...p.traits].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export function previewVerb(profile: SoundProfile): string {
  if (profile.drivetrainMode === "virtual-transmission") return "Hold to rev";
  if (
    profile.category === "Playful" ||
    profile.category === "Festive" ||
    profile.category === "Nature"
  ) {
    return "Hold to feel";
  }
  return "Preview";
}
