export type DrivetrainMode = "virtual-transmission" | "continuous";

export interface SoundProfile {
  id: string;
  name: string;
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
  };
  transmission?: {
    gearRatios: number[];
    idleRpm: number;
    redlineRpm: number;
    shiftSmoothing: number;
  };
}

export const SOUND_PROFILES: SoundProfile[] = [
  {
    id: "gt-v8",
    name: "GT V8",
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
    transmission: {
      gearRatios: [13.2, 8.1, 5.6, 4.1, 3.2, 2.6],
      idleRpm: 700,
      redlineRpm: 6600,
      shiftSmoothing: 0.16,
    },
  },
  {
    id: "racing-v10",
    name: "Racing V10",
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
    transmission: {
      gearRatios: [16, 11.2, 8.4, 6.6, 5.4, 4.6],
      idleRpm: 1100,
      redlineRpm: 9200,
      shiftSmoothing: 0.09,
    },
  },
  {
    id: "cyber-pulse",
    name: "Cyber Pulse",
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
];

export const DEFAULT_PROFILE_ID = "gt-v8";

export function getProfile(id: string | null | undefined): SoundProfile {
  return SOUND_PROFILES.find((p) => p.id === id) ?? SOUND_PROFILES[0]!;
}
