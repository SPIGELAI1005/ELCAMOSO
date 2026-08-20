/**
 * Custom audio snippets: short recordings or uploads mapped to a driving
 * state, so a sound personality can include your own voice, horn or jingle.
 */

export type SnippetTrigger = "start" | "throttle" | "regen" | "cruise" | "bed";

export const SNIPPET_TRIGGERS: {
  id: SnippetTrigger;
  name: string;
  hint: string;
}[] = [
  { id: "start", name: "Drive start", hint: "Plays once when the sound begins" },
  { id: "throttle", name: "Hard throttle", hint: "Fires when you ask for real power" },
  { id: "regen", name: "Regeneration", hint: "Fires when you slow down and recover" },
  { id: "cruise", name: "Cruising", hint: "Returns now and then while you hold speed" },
  { id: "bed", name: "Continuous bed", hint: "Loops quietly under everything" },
];

export interface SoundSnippet {
  id: string;
  name: string;
  /** audio/* data URL, kept locally on this device */
  dataUrl: string;
  trigger: SnippetTrigger;
  /** 0..1.5 playback level */
  level: number;
  /** 0.5..2 playback speed */
  rate: number;
  createdAt: number;
  /** seconds between repeats for the cruising trigger */
  everySeconds?: number;
}

export const MAX_SNIPPET_BYTES = 700_000;
