const ADJECTIVES = [
  "Night",
  "Open",
  "Electric",
  "Quiet",
  "Bright",
  "Coastal",
  "Urban",
  "Silent",
  "Rising",
  "Distant",
];

const NOUNS = [
  "Motion",
  "Road",
  "Morning",
  "Pulse",
  "Horizon",
  "Current",
  "Flow",
  "Run",
  "Signal",
  "Drift",
];

/** Deterministic local song title - neutral, no judgment. */
export function generateSongTitle(seed: number, createdAt: number): string {
  const a = ADJECTIVES[Math.abs(seed) % ADJECTIVES.length]!;
  const n = NOUNS[Math.abs(seed * 7 + createdAt) % NOUNS.length]!;
  if ((seed + createdAt) % 5 === 0) return `Motion ${(seed % 90) + 10}`;
  return `${a} ${n}`;
}
