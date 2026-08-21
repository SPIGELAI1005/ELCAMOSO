export interface CabinEq {
  low: number;
  mid: number;
  high: number;
}

export const DEFAULT_CABIN_EQ: CabinEq = { low: 0, mid: 0, high: 0 };

/** Named cabin EQ recipes for quick device listening. */
export const CABIN_EQ_PRESETS: { id: string; label: string; hint: string; eq: CabinEq }[] = [
  {
    id: "flat",
    label: "Flat",
    hint: "No cabin shaping",
    eq: { low: 0, mid: 0, high: 0 },
  },
  {
    id: "cabin",
    label: "Cabin",
    hint: "Slight low warmth, softer highs",
    eq: { low: 1.5, mid: 0.5, high: -1.5 },
  },
  {
    id: "phone",
    label: "Phone speakers",
    hint: "More mid presence, less deep bass and harsh highs",
    eq: { low: -2.5, mid: 3.5, high: -2 },
  },
  {
    id: "headphones",
    label: "Headphones",
    hint: "Balanced, mild air",
    eq: { low: 0.5, mid: 0, high: 1 },
  },
];

export interface ShiftFeel {
  shiftMs: number;
  torqueDip: number;
  revMatch: number;
}

export const DEFAULT_SHIFT_FEEL: ShiftFeel = { shiftMs: 160, torqueDip: 0.22, revMatch: 0.45 };
