export type DrivetrainMode = "virtual-transmission" | "continuous";

export type ProfileCategory =
  | "Classic"
  | "Motorsport"
  | "Future"
  | "Nautical"
  | "Aviation"
  | "Nature"
  | "Festive"
  | "Playful"
  | "Heritage"
  | "Garage";

export type LfoTarget = "pitch" | "filter" | "amp";

/** Rhythmic events that keep time with your speed. */
export type RhythmKind =
  | "clack"
  | "bell"
  | "blat"
  | "chug"
  | "gallop"
  | "splash"
  | "creak"
  | "laugh"
  | "rotor"
  | "putt";

/** Continuous atmospheric beds layered under the main voice. */
export type TextureKind =
  | "water"
  | "wind"
  | "gravel"
  | "steam"
  | "crowd"
  | "rumble"
  | "sizzle";

/** Occasional signature one-shots that give a profile personality. */
export type SignalKind =
  | "horn"
  | "laugh"
  | "hohoho"
  | "whistle"
  | "seagull"
  | "whip"
  | "neigh"
  | "beam";

export interface RhythmSpec {
  kind: RhythmKind;
  /** events per second at rest */
  baseRate: number;
  /** additional events per second at full load */
  rateScale: number;
  level: number;
  tone: number;
}

export interface TextureSpec {
  kind: TextureKind;
  /** 0..1 level at full load */
  level: number;
  /** centre frequency of the band */
  tone: number;
  /** how strongly the bed follows speed, 0..1 (0 = always present) */
  speedScale?: number;
  /** slow surge rate in Hz, for swell and wash movement */
  surge?: number;
}

export interface SignalSpec {
  kind: SignalKind;
  /** average seconds between events at rest */
  everySeconds: number;
  /** random +/- variation in seconds */
  jitter?: number;
  level: number;
  tone: number;
  /** true = fires more often the faster you go */
  speedLinked?: boolean;
}

export interface ProfileVoice {
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
  /** additional rhythmic layer, e.g. wheels under hooves */
  rhythmB?: RhythmSpec;
  textures?: TextureSpec[];
  signals?: SignalSpec[];
}

export interface SoundProfile {
  id: string;
  name: string;
  category: ProfileCategory;
  traits: [string, string, string];
  description: string;
  drivetrainMode: DrivetrainMode;
  /** timbre parameters consumed by the synthesis layer */
  voice: ProfileVoice;
  transmission?: {
    gearRatios: number[];
    idleRpm: number;
    redlineRpm: number;
    shiftSmoothing: number;
  };
  /** true for user-made profiles created in the Studio */
  custom?: boolean;
  /** the built-in profile a custom sound was derived from */
  baseId?: string;
  createdAt?: number;
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
      textures: [
        { kind: "rumble", level: 0.3, tone: 90, speedScale: 0.7, surge: 0.5 },
        { kind: "wind", level: 0.16, tone: 1400, speedScale: 1 },
      ],
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
      textures: [
        { kind: "sizzle", level: 0.14, tone: 4200, speedScale: 1 },
        { kind: "wind", level: 0.2, tone: 1800, speedScale: 1 },
      ],
    },
    transmission: RACE_BOX,
  },
  {
    id: "cyber-pulse",
    name: "Cyber Pulse",
    category: "Future",
    traits: ["Electric", "Futuristic", "Immersive"],
    description: "One continuous rise. No shifts, only motion, glide and regeneration.",
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
      textures: [{ kind: "sizzle", level: 0.1, tone: 5200, speedScale: 1, surge: 0.3 }],
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
      textures: [
        { kind: "wind", level: 0.26, tone: 2200, speedScale: 1 },
        { kind: "crowd", level: 0.08, tone: 700, speedScale: 0.3, surge: 0.12 },
      ],
    },
    transmission: { ...RACE_BOX, shiftSmoothing: 0.06, redlineRpm: 8600 },
  },
  {
    id: "rally-car",
    name: "Rally Car",
    category: "Motorsport",
    traits: ["Gravel", "Turbo", "Raw"],
    description: "Loose-surface energy: turbo whistle, stone spray and a gritty texture.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 30,
      harmonics: [1, 2, 3.04, 4.5],
      waveResponse: 1,
      filterBase: 340,
      filterRange: 3800,
      noise: 0.34,
      detune: 12,
      wave: "square",
      lfoRate: 0.8,
      lfoDepth: 900,
      lfoTarget: "filter",
      textures: [
        { kind: "gravel", level: 0.34, tone: 2600, speedScale: 1, surge: 3.2 },
        { kind: "rumble", level: 0.22, tone: 110, speedScale: 0.8 },
      ],
      signals: [
        { kind: "whistle", everySeconds: 9, jitter: 4, level: 0.1, tone: 3200, speedLinked: true },
      ],
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
      noise: 0.14,
      detune: 18,
      wave: "triangle",
      lfoRate: 0.14,
      lfoDepth: 700,
      lfoTarget: "filter",
      textures: [
        { kind: "rumble", level: 0.32, tone: 60, speedScale: 0.5, surge: 0.18 },
        { kind: "sizzle", level: 0.08, tone: 6000, speedScale: 0.8, surge: 0.22 },
      ],
      signals: [{ kind: "beam", everySeconds: 14, jitter: 7, level: 0.07, tone: 900 }],
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
      textures: [{ kind: "sizzle", level: 0.07, tone: 7200, speedScale: 0.6, surge: 0.9 }],
      signals: [{ kind: "beam", everySeconds: 8, jitter: 5, level: 0.09, tone: 1500 }],
    },
  },
  {
    id: "speed-boat",
    name: "Speed Boat",
    category: "Nautical",
    traits: ["Spray", "Planing", "Open Water"],
    description:
      "Outboard bite with water rushing past the hull and spray thrown up as you come on plane.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 70,
      harmonics: [1, 2, 3.02, 4],
      waveResponse: 1.05,
      filterBase: 420,
      filterRange: 4400,
      noise: 0.3,
      detune: 9,
      wave: "sawtooth",
      rhythm: { kind: "splash", baseRate: 1.1, rateScale: 4.5, level: 0.22, tone: 900 },
      rhythmB: { kind: "chug", baseRate: 7, rateScale: 30, level: 0.07, tone: 190 },
      textures: [
        { kind: "water", level: 0.44, tone: 1500, speedScale: 1, surge: 0.55 },
        { kind: "water", level: 0.22, tone: 320, speedScale: 0.8, surge: 0.3 },
        { kind: "wind", level: 0.18, tone: 2600, speedScale: 1 },
      ],
      signals: [{ kind: "seagull", everySeconds: 17, jitter: 9, level: 0.07, tone: 1700 }],
    },
  },
  {
    id: "cruise-ship",
    name: "Cruise Ship",
    category: "Nautical",
    traits: ["Enormous", "Slow", "Serene"],
    description:
      "A vast low horn, engine-room hum and the endless wash of water down the hull.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 32,
      harmonics: [1, 1.5, 2, 2.5],
      waveResponse: 0.5,
      filterBase: 120,
      filterRange: 900,
      noise: 0.12,
      detune: 14,
      wave: "sine",
      lfoRate: 0.09,
      lfoDepth: 260,
      lfoTarget: "filter",
      textures: [
        { kind: "water", level: 0.3, tone: 700, speedScale: 0.85, surge: 0.16 },
        { kind: "rumble", level: 0.34, tone: 55, speedScale: 0.4, surge: 0.1 },
      ],
      signals: [
        { kind: "horn", everySeconds: 21, jitter: 8, level: 0.16, tone: 82 },
        { kind: "seagull", everySeconds: 26, jitter: 12, level: 0.05, tone: 1500 },
      ],
    },
  },
  {
    id: "santa-sleigh",
    name: "Santa Sleigh",
    category: "Festive",
    traits: ["Bells", "Snow", "Joyful"],
    description: "Sleigh bells that ring faster the quicker you glide, with a warm ho ho ho.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 96,
      harmonics: [1, 2.02, 3.5],
      waveResponse: 1.1,
      filterBase: 600,
      filterRange: 3800,
      noise: 0.1,
      detune: 8,
      wave: "triangle",
      rhythm: { kind: "bell", baseRate: 2.4, rateScale: 10, level: 0.16, tone: 2100 },
      rhythmB: { kind: "clack", baseRate: 0.9, rateScale: 3.4, level: 0.07, tone: 260 },
      textures: [{ kind: "wind", level: 0.2, tone: 1100, speedScale: 0.9, surge: 0.4 }],
      signals: [{ kind: "hohoho", everySeconds: 19, jitter: 8, level: 0.14, tone: 150 }],
    },
  },
  {
    id: "wild-west-carriage",
    name: "Wild West Carriage",
    category: "Heritage",
    traits: ["Hooves", "Wooden", "Dusty"],
    description:
      "Four-beat hooves on hard ground, wooden wheels grinding gravel and the crack of a whip.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 58,
      harmonics: [1, 2.03, 3.1],
      waveResponse: 0.9,
      filterBase: 240,
      filterRange: 1400,
      noise: 0.08,
      detune: 16,
      wave: "triangle",
      rhythm: { kind: "gallop", baseRate: 0.9, rateScale: 2.6, level: 0.3, tone: 380 },
      rhythmB: { kind: "creak", baseRate: 0.5, rateScale: 1.3, level: 0.12, tone: 180 },
      textures: [
        { kind: "gravel", level: 0.3, tone: 2100, speedScale: 1, surge: 2.4 },
        { kind: "wind", level: 0.12, tone: 900, speedScale: 0.6 },
      ],
      signals: [
        { kind: "whip", everySeconds: 13, jitter: 7, level: 0.16, tone: 2600, speedLinked: true },
        { kind: "neigh", everySeconds: 24, jitter: 12, level: 0.12, tone: 420 },
      ],
    },
  },
  {
    id: "romanian-85-carriage",
    name: "Romanian '85 Carriage",
    category: "Heritage",
    traits: ["Cobblestone", "Iron-Rimmed", "Village"],
    description:
      "A single patient horse, iron-rimmed wheels ringing on cobbles and a cart that creaks with every rut.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 46,
      harmonics: [1, 2.02, 2.98],
      waveResponse: 0.7,
      filterBase: 200,
      filterRange: 1100,
      noise: 0.07,
      detune: 13,
      wave: "triangle",
      rhythm: { kind: "clack", baseRate: 1.4, rateScale: 4.2, level: 0.26, tone: 720 },
      rhythmB: { kind: "creak", baseRate: 0.34, rateScale: 1.1, level: 0.16, tone: 150 },
      textures: [
        { kind: "gravel", level: 0.2, tone: 1500, speedScale: 0.9, surge: 1.6 },
        { kind: "rumble", level: 0.14, tone: 95, speedScale: 0.7, surge: 0.7 },
      ],
      signals: [
        { kind: "neigh", everySeconds: 20, jitter: 10, level: 0.13, tone: 380 },
        { kind: "whistle", everySeconds: 30, jitter: 14, level: 0.05, tone: 1900 },
      ],
    },
  },
  {
    id: "laughing-machine",
    name: "Laughing Machine",
    category: "Playful",
    traits: ["Giggling", "Contagious", "Absurd"],
    description:
      "The faster you go, the harder it laughs. Accelerate hard and the whole cabin cracks up.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 88,
      harmonics: [1, 2.01, 3.04],
      waveResponse: 1.2,
      filterBase: 420,
      filterRange: 2200,
      noise: 0.04,
      detune: 9,
      wave: "triangle",
      rhythm: { kind: "laugh", baseRate: 0.35, rateScale: 2.1, level: 0.24, tone: 190 },
      textures: [{ kind: "crowd", level: 0.16, tone: 800, speedScale: 0.9, surge: 0.35 }],
      signals: [{ kind: "laugh", everySeconds: 11, jitter: 5, level: 0.2, tone: 130 }],
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
      noise: 0.24,
      detune: 24,
      wave: "square",
      lfoRate: 11,
      lfoDepth: 140,
      lfoTarget: "pitch",
      rhythm: { kind: "blat", baseRate: 0.7, rateScale: 5, level: 0.24, tone: 90 },
      signals: [{ kind: "laugh", everySeconds: 15, jitter: 8, level: 0.14, tone: 170 }],
    },
    transmission: { ...GT_BOX, redlineRpm: 5200 },
  },
  {
    id: "steam-train",
    name: "Steam Train",
    category: "Heritage",
    traits: ["Chuffing", "Iron", "Nostalgic"],
    description: "Pistons, escaping steam and a far-off whistle as the line opens up ahead.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 38,
      harmonics: [1, 2, 3.02],
      waveResponse: 0.8,
      filterBase: 200,
      filterRange: 1800,
      noise: 0.18,
      detune: 10,
      wave: "triangle",
      rhythm: { kind: "chug", baseRate: 1.2, rateScale: 7, level: 0.26, tone: 220 },
      rhythmB: { kind: "clack", baseRate: 0.8, rateScale: 5.5, level: 0.08, tone: 1400 },
      textures: [
        { kind: "steam", level: 0.3, tone: 3400, speedScale: 0.8, surge: 0.9 },
        { kind: "rumble", level: 0.2, tone: 80, speedScale: 0.9 },
      ],
      signals: [
        { kind: "whistle", everySeconds: 18, jitter: 9, level: 0.16, tone: 900, speedLinked: true },
      ],
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
      signals: [{ kind: "laugh", everySeconds: 22, jitter: 10, level: 0.1, tone: 220 }],
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
      noise: 0.42,
      detune: 5,
      wave: "sawtooth",
      textures: [
        { kind: "wind", level: 0.34, tone: 2400, speedScale: 1, surge: 0.25 },
        { kind: "rumble", level: 0.2, tone: 70, speedScale: 0.8 },
      ],
    },
  },
  {
    id: "helicopter",
    name: "Helicopter",
    category: "Aviation",
    traits: ["Chopping", "Powerful", "Hovering"],
    description:
      "Rotor blades beating the air over a turbine whine. The chop quickens the harder you push.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 76,
      harmonics: [1, 2.01, 3.04, 5.02],
      waveResponse: 0.95,
      filterBase: 420,
      filterRange: 3400,
      noise: 0.3,
      detune: 8,
      wave: "sawtooth",
      lfoRate: 5.4,
      lfoDepth: 620,
      lfoTarget: "filter",
      rhythm: { kind: "rotor", baseRate: 5.5, rateScale: 9, level: 0.3, tone: 58 },
      textures: [
        { kind: "wind", level: 0.3, tone: 1900, speedScale: 0.8, surge: 0.5 },
        { kind: "rumble", level: 0.26, tone: 75, speedScale: 0.6, surge: 0.35 },
      ],
    },
  },
  {
    id: "private-jet",
    name: "Private Jet",
    category: "Aviation",
    traits: ["Refined", "Spooling", "Effortless"],
    description:
      "Twin turbofans spooling up behind a calm cabin. Smooth thrust with a long, expensive sigh on lift-off.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 150,
      harmonics: [1, 2.03, 3.01, 4.5, 6.02],
      waveResponse: 1.05,
      filterBase: 620,
      filterRange: 7200,
      noise: 0.46,
      detune: 6,
      wave: "sawtooth",
      lfoRate: 0.2,
      lfoDepth: 420,
      lfoTarget: "filter",
      textures: [
        { kind: "wind", level: 0.38, tone: 3000, speedScale: 1, surge: 0.18 },
        { kind: "sizzle", level: 0.12, tone: 6400, speedScale: 0.9 },
        { kind: "rumble", level: 0.18, tone: 65, speedScale: 0.7 },
      ],
      signals: [{ kind: "beam", everySeconds: 26, jitter: 12, level: 0.05, tone: 1100 }],
    },
  },
  {
    id: "wiesn-tractor",
    name: "Oide Wiesn Tractor",
    category: "Heritage",
    traits: ["Single-Cylinder", "Stubborn", "Bavarian"],
    description:
      "An old field tractor putt-putting down the lane: slow strokes, a smoky stack and a cheerful crowd somewhere past the hedge.",
    drivetrainMode: "virtual-transmission",
    voice: {
      baseFrequency: 20,
      harmonics: [1, 2.02, 3.06],
      waveResponse: 0.6,
      filterBase: 160,
      filterRange: 1100,
      noise: 0.2,
      detune: 22,
      wave: "square",
      rhythm: { kind: "putt", baseRate: 2.2, rateScale: 7.5, level: 0.3, tone: 120 },
      rhythmB: { kind: "creak", baseRate: 0.24, rateScale: 0.7, level: 0.1, tone: 140 },
      textures: [
        { kind: "rumble", level: 0.28, tone: 85, speedScale: 0.6, surge: 1.1 },
        { kind: "crowd", level: 0.1, tone: 760, speedScale: 0.25, surge: 0.2 },
      ],
      signals: [
        { kind: "hohoho", everySeconds: 28, jitter: 12, level: 0.09, tone: 140 },
        { kind: "whistle", everySeconds: 34, jitter: 15, level: 0.05, tone: 1500 },
      ],
    },
    transmission: { gearRatios: [18, 12, 8.5, 6.4], idleRpm: 480, redlineRpm: 2400, shiftSmoothing: 0.3 },
  },
  {
    id: "open-wind",
    name: "Open Wind",
    category: "Nature",
    traits: ["Airy", "Calm", "Weightless"],
    description:
      "Only air. A soft rush that opens as you gather speed and settles into a sigh when you lift off.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 40,
      harmonics: [1, 2.5],
      waveResponse: 0.55,
      filterBase: 220,
      filterRange: 1800,
      noise: 0.6,
      detune: 15,
      wave: "sine",
      lfoRate: 0.12,
      lfoDepth: 260,
      lfoTarget: "filter",
      textures: [
        { kind: "wind", level: 0.5, tone: 1200, speedScale: 1, surge: 0.22 },
        { kind: "wind", level: 0.26, tone: 3200, speedScale: 1, surge: 0.45 },
        { kind: "rumble", level: 0.12, tone: 60, speedScale: 0.5, surge: 0.14 },
      ],
    },
  },
  {
    id: "storm-glider",
    name: "Storm Glider",
    category: "Nature",
    traits: ["Gusting", "Wild", "Cinematic"],
    description:
      "Wind with weather in it: gusts that swell and tear past you, with distant thunder rolling underneath.",
    drivetrainMode: "continuous",
    voice: {
      baseFrequency: 34,
      harmonics: [1, 1.98, 3.4],
      waveResponse: 0.7,
      filterBase: 180,
      filterRange: 2600,
      noise: 0.55,
      detune: 26,
      wave: "triangle",
      lfoRate: 0.35,
      lfoDepth: 900,
      lfoTarget: "filter",
      textures: [
        { kind: "wind", level: 0.46, tone: 900, speedScale: 0.9, surge: 0.7 },
        { kind: "wind", level: 0.3, tone: 4200, speedScale: 1, surge: 1.3 },
        { kind: "rumble", level: 0.3, tone: 50, speedScale: 0.4, surge: 0.09 },
      ],
      signals: [{ kind: "beam", everySeconds: 20, jitter: 10, level: 0.07, tone: 260 }],
    },
  },
];

export const PROFILE_CATEGORIES: ProfileCategory[] = [
  "Classic",
  "Motorsport",
  "Future",
  "Nautical",
  "Aviation",
  "Nature",
  "Heritage",
  "Festive",
  "Playful",
  "Garage",
];

export const DEFAULT_PROFILE_ID = "gt-v8";

/* ------------------------------------------------ custom profile registry */

let CUSTOM_PROFILES: SoundProfile[] = [];

/** Studio-made profiles are registered at runtime so getProfile can resolve them. */
export function registerCustomProfiles(list: SoundProfile[]) {
  CUSTOM_PROFILES = list;
}

export function getCustomProfiles(): SoundProfile[] {
  return CUSTOM_PROFILES;
}

export function allProfiles(): SoundProfile[] {
  return [...SOUND_PROFILES, ...CUSTOM_PROFILES];
}

export function getProfile(id: string | null | undefined): SoundProfile {
  return (
    CUSTOM_PROFILES.find((p) => p.id === id) ??
    SOUND_PROFILES.find((p) => p.id === id) ??
    SOUND_PROFILES[0]!
  );
}

/**
 * Rough perceived-intensity estimate for a profile, 0..1. Used to warn before
 * switching into something that will feel much louder than the current sound.
 */
export function estimateIntensity(profile: SoundProfile): number {
  const v = profile.voice;
  const textures = (v.textures ?? []).reduce((sum, t) => sum + t.level, 0);
  const rhythms = (v.rhythm?.level ?? 0) + (v.rhythmB?.level ?? 0);
  const signals = (v.signals ?? []).reduce((sum, s) => sum + s.level, 0);
  const brightness = Math.min(1, v.filterRange / 7000);
  const raw =
    v.noise * 0.5 + textures * 0.55 + rhythms * 0.7 + signals * 0.4 + brightness * 0.45;
  return Math.max(0, Math.min(1, raw / 1.9));
}

export type IntensityBand = "gentle" | "balanced" | "intense";

export function intensityBand(profile: SoundProfile): IntensityBand {
  const value = estimateIntensity(profile);
  if (value < 0.34) return "gentle";
  if (value < 0.62) return "balanced";
  return "intense";
}
