import { MUSIC_BANK, musicBankUrl } from "./sample-bank-data";

export { MUSIC_BANK, MUSIC_BANK_VERSION, musicBankUrl } from "./sample-bank-data";

export interface SampleRef {
  /** seconds into the sprite where the slot starts (before onset correction) */
  slotStart: number;
  slotLen: number;
  rate: number;
  /** loudness compensation for this note */
  norm: number;
}

/** Nearest rendered note; pitch-shift the rest (rendered every 3 semitones -> max 1.5 st). */
export function pickSample(inst: string, midi: number): SampleRef | null {
  const s = MUSIC_BANK[inst];
  if (!s) return null;
  let best = 0;
  for (let i = 1; i < s.notes.length; i++) {
    if (Math.abs(s.notes[i]! - midi) < Math.abs(s.notes[best]! - midi)) best = i;
  }
  const isDrum = inst.startsWith("drums_");
  if (isDrum && s.notes[best] !== midi) return null;
  const rate = Math.pow(2, (midi - s.notes[best]!) / 12);
  const rms = Math.max(0.01, s.rms[best]!);
  const mean = s.rms.reduce((a, b) => a + b, 0) / s.rms.length;
  const norm = isDrum ? 1 : Math.min(2.2, Math.sqrt(mean / rms));
  return { slotStart: best * s.slot, slotLen: s.slot, rate, norm };
}

export function allMusicBankUrls(): string[] {
  return Object.keys(MUSIC_BANK).map(musicBankUrl);
}
