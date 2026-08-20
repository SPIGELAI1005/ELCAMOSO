export type DrivetrainMode = "virtual-transmission" | "continuous";

export type ProfileCategory =
  | "Classic"
  | "Motorsport"
  | "Future"
  | "Nautical"
  | "Festive"
  | "Playful";

export type LfoTarget = "pitch" | "filter" | "amp";
export type RhythmKind = "clack" | "bell" | "blat" | "chug";

export interface RhythmSpec {
  kind: RhythmKind;
  /** events per second at rest */
  baseRate: number;
  /** additional events per second at full load */
  rateScale: number;
  level: number;
  tone: number;
}

export interface SoundProfile {
  id: string;
  name: string;
  category: ProfileCategory;
  traits: [string, string, string];
  description: string;
  drivetrainMode: DrivetrainMode;
  /** timbre parameters consumed by the synthesis layer */
  voice: {
    baseFrequency: number;
    harmonics: number[];
    /** how quickly the mark's waves fill with load */
    waveResponse: number;
    filterBase: number;
    filterRange: number;
    noise: number;
    detune: number;
    wave: OscillatorType;
    lfoRate?: number;
    lfoDepth?: number;
    lfoTarget?: LfoTarget;
    rhythm?: RhythmSpec;
  };
  transmission?: {
    gearRatios: number[];
    idleRpm: number;
    redlineRpm: number;
    shiftSmoothing: number;
  };
}

const GT_BOX = {
  gearRatios: [13.2, 8.1, 5.6, 4.1, 3.2, 2.6],
  idleRpm: 700,
  redlineRpm: 6600,
  shiftSmoothing: 0.16,
};

const RACE_BOX = {
  gearRatios: [16, 11.2, 8.4, 6.6, 5.4, 4.6],
  idleRpm: 1100,
  redlineRpm: 9200,
  shiftSmoothing: 0.09,
};

export const SOUND_PROFILES: SoundProfile[] = [
  {
    id: "gt-v8",
    name: "GT V8",
    category: "Classic",
    traits: ["Deep", "Mechanical", "Powerful"],
    description: "A wide, low-slung character with weight behind every movement.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 26,
      harmonics: [1, 2, 3, 4.02, 6],
      waveResponse: 0.8,
      filterBase: 220,
      filterRange: 2400,
      noise: 0.16,
      detune: 7,
      wave: "sawtooth",
    },
    transmission: GT_BOX,
  },
  {
    id: "racing-v10",
    name: "Racing V10",
    category: "Motorsport",
    traits: ["Sharp", "High-Rev", "Responsive"],
    description: "Tight, urgent and metallic. Climbs fast and reacts the instant you ask.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 34,
      harmonics: [1, 2, 3.01, 5, 7.03, 9],
      waveResponse: 1.15,
      filterBase: 420,
      filterRange: 4600,
      noise: 0.1,
      detune: 4,
      wave: "sawtooth",
    },
    transmission: RACE_BOX,
  },
  {
    id: "cyber-pulse",
    name: "Cyber Pulse",
    category: "Future",
    traits: ["Electric", "Futuristic", "Immersive"],
    description: "One continuous rise. No shifts — only motion, glide and regeneration.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 62,
      harmonics: [1, 1.5, 2, 3.01],
      waveResponse: 1,
      filterBase: 300,
      filterRange: 3600,
      noise: 0.05,
      detune: 11,
      wave: "sawtooth",
    },
  },
  {
    id: "race-car",
    name: "Race Car",
    category: "Motorsport",
    traits: ["Track", "Aggressive", "Precise"],
    description: "Circuit-bred and edgy, with a hard shift and a bright top end.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 40,
      harmonics: [1, 2, 3, 4, 5.02, 8],
      waveResponse: 1.2,
      filterBase: 500,
      filterRange: 5200,
      noise: 0.12,
      detune: 3,
      wave: "sawtooth",
    },
    transmission: { ...RACE_BOX, shiftSmoothing: 0.06, redlineRpm: 8600 },
  },
  {
    id: "rally-car",
    name: "Rally Car",
    category: "Motorsport",
    traits: ["Gravel", "Turbo", "Raw"],
    description: "Loose-surface energy with turbo whistle and a gritty texture.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 30,
      harmonics: [1, 2, 3.04, 4.5],
      waveResponse: 1,
      filterBase: 340,
      filterRange: 3800,
      noise: 0.42,
      detune: 12,
      wave: "square",
      lfoRate: 0.8,
      lfoDepth: 900,
      lfoTarget: "filter",
    },
    transmission: { ...GT_BOX, redlineRpm: 7400, shiftSmoothing: 0.1 },
  },
  {
    id: "space-ship",
    name: "Space Ship",
    category: "Future",
    traits: ["Vast", "Cinematic", "Weightless"],
    description: "A deep hull drone that swells as you gather momentum.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 44,
      harmonics: [1, 1.51, 2.02, 2.99, 4.5],
      waveResponse: 0.7,
      filterBase: 180,
      filterRange: 2600,
      noise: 0.18,
      detune: 18,
      wave: "triangle",
      lfoRate: 0.14,
      lfoDepth: 700,
      lfoTarget: "filter",
    },
  },
  {
    id: "ufo",
    name: "UFO",
    category: "Future",
    traits: ["Hovering", "Wobbling", "Strange"],
    description: "A theremin-like hover that bends and shimmers with every change of pace.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 180,
      harmonics: [1, 2.01, 3.03],
      waveResponse: 1.3,
      filterBase: 700,
      filterRange: 4200,
      noise: 0.02,
      detune: 6,
      wave: "sine",
      lfoRate: 6.5,
      lfoDepth: 55,
      lfoTarget: "pitch",
    },
  },
  {
    id: "speed-boat",
    name: "Speed Boat",
    category: "Nautical",
    traits: ["Spray", "Planing", "Open Water"],
    description: "Outboard bite with water rushing past as the hull comes up on plane.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 70,
      harmonics: [1, 2, 3.02, 4],
      waveResponse: 1.05,
      filterBase: 420,
      filterRange: 4400,
      noise: 0.55,
      detune: 9,
      wave: "sawtooth",
      rhythm: { kind: "chug", baseRate: 6, rateScale: 26, level: 0.1, tone: 160 },
    },
  },
  {
    id: "cruise-ship",
    name: "Cruise Ship",
    category: "Nautical",
    traits: ["Enormous", "Slow", "Serene"],
    description: "A vast low horn and engine-room hum. Motion measured in decks, not metres.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 32,
      harmonics: [1, 1.5, 2, 2.5],
      waveResponse: 0.5,
      filterBase: 120,
      filterRange: 900,
      noise: 0.22,
      detune: 14,
      wave: "sine",
      lfoRate: 0.09,
      lfoDepth: 260,
      lfoTarget: "filter",
    },
  },
  {
    id: "santa-sleigh",
    name: "Santa Sleigh",
    category: "Festive",
    traits: ["Bells", "Snow", "Joyful"],
    description: "Sleigh bells that ring faster the quicker you glide.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 96,
      harmonics: [1, 2.02, 3.5],
      waveResponse: 1.1,
      filterBase: 600,
      filterRange: 3800,
      noise: 0.14,
      detune: 8,
      wave: "triangle",
      rhythm: { kind: "bell", baseRate: 2.2, rateScale: 9, level: 0.14, tone: 2100 },
    },
  },
  {
    id: "wild-west-carriage",
    name: "Wild West Carriage",
    category: "Playful",
    traits: ["Hooves", "Wooden", "Dusty"],
    description: "Galloping hooves and creaking timber, keeping time with your speed.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 58,
      harmonics: [1, 2.03, 3.1],
      waveResponse: 0.9,
      filterBase: 260,
      filterRange: 1600,
      noise: 0.3,
      detune: 16,
      wave: "triangle",
      rhythm: { kind: "clack", baseRate: 1.6, rateScale: 8, level: 0.2, tone: 420 },
    },
  },
  {
    id: "farting-car",
    name: "Farting Car",
    category: "Playful",
    traits: ["Rude", "Bubbly", "Ridiculous"],
    description: "Exactly what it sounds like. Accelerate at your own social risk.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 22,
      harmonics: [1, 1.98, 3.4],
      waveResponse: 1,
      filterBase: 140,
      filterRange: 900,
      noise: 0.3,
      detune: 24,
      wave: "square",
      lfoRate: 11,
      lfoDepth: 140,
      lfoTarget: "pitch",
      rhythm: { kind: "blat", baseRate: 0.7, rateScale: 5, level: 0.22, tone: 90 },
    },
    transmission: { ...GT_BOX, redlineRpm: 5200 },
  },
  {
    id: "steam-train",
    name: "Steam Train",
    category: "Playful",
    traits: ["Chuffing", "Iron", "Nostalgic"],
    description: "Pistons and steam that quicken as the line opens up ahead.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 38,
      harmonics: [1, 2, 3.02],
      waveResponse: 0.8,
      filterBase: 200,
      filterRange: 1800,
      noise: 0.5,
      detune: 10,
      wave: "triangle",
      rhythm: { kind: "chug", baseRate: 1.2, rateScale: 7, level: 0.22, tone: 220 },
    },
  },
  {
    id: "kazoo-kart",
    name: "Kazoo Kart",
    category: "Playful",
    traits: ["Buzzy", "Silly", "Tiny"],
    description: "A pocket-sized buzz with far more enthusiasm than horsepower.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 54,
      harmonics: [1, 2.01, 3.02, 4.05],
      waveResponse: 1.25,
      filterBase: 800,
      filterRange: 3200,
      noise: 0.06,
      detune: 20,
      wave: "square",
      lfoRate: 14,
      lfoDepth: 30,
      lfoTarget: "amp",
    },
    transmission: { ...RACE_BOX, idleRpm: 1400, redlineRpm: 11000, shiftSmoothing: 0.07 },
  },
  {
    id: "turbine-jet",
    name: "Turbine Jet",
    category: "Future",
    traits: ["Spooling", "Airy", "Immense"],
    description: "A turbine that spools smoothly with speed and sighs on regeneration.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 120,
      harmonics: [1, 2.02, 3.5, 5.03],
      waveResponse: 1.1,
      filterBase: 500,
      filterRange: 6200,
      noise: 0.62,
      detune: 5,
      wave: "sawtooth",
    },
  },
];

export const PROFILE_CATEGORIES: ProfileCategory[] = [
  "Classic",
  "Motorsport",
  "Future",
  "Nautical",
  "Festive",
  "Playful",
];

export const DEFAULT_PROFILE_ID = "gt-v8";

export function getProfile(id: string | null | undefined): SoundProfile {
  return SOUND_PROFILES.find((p) => p.id === id) ?? SOUND_PROFILES[0]!;
}
