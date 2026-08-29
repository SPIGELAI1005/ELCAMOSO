export interface TourStep {
  profileId: string;
  title: string;
  cue: string;
  /** Seconds from tour start */
  at: number;
  /** Seconds duration */
  duration: number;
  /** Peak throttle in this step (0..1) */
  peakThrottle: number;
}

export const DEFAULT_DEMO_TOUR: TourStep[] = [
  {
    profileId: "laughing-machine",
    title: "Laughing Machine",
    cue: "Throttle up - the cabin cracks up.",
    at: 0,
    duration: 7,
    peakThrottle: 0.92,
  },
  {
    profileId: "neon-drive",
    title: "Neon Drive",
    cue: "Night pulses that tighten as you push.",
    at: 7,
    duration: 7,
    peakThrottle: 0.85,
  },
  {
    profileId: "construction-monster",
    title: "Construction Monster",
    cue: "Hydraulics and diesel strain under load.",
    at: 14,
    duration: 7,
    peakThrottle: 0.88,
  },
  {
    profileId: "farting-car",
    title: "Farting Car",
    cue: "Exactly what it sounds like. Social risk accepted.",
    at: 21,
    duration: 7,
    peakThrottle: 0.9,
  },
];

export const DEMO_TOUR_TOTAL_S = 28;
