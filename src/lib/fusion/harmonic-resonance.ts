/**
 * Harmonic Resonance - optional subtle emphasis of machine body frequencies
 * related to the Symphony pack key. Not pitch-correction / Auto-Tune.
 */

const NOTE_TO_HZ: Record<string, number> = {
  C: 130.81,
  "C#": 138.59,
  Db: 138.59,
  D: 146.83,
  "D#": 155.56,
  Eb: 155.56,
  E: 164.81,
  F: 174.61,
  "F#": 185.0,
  Gb: 185.0,
  G: 196.0,
  "G#": 207.65,
  Ab: 207.65,
  A: 220.0,
  "A#": 233.08,
  Bb: 233.08,
  B: 246.94,
};

export function parseKeyRootHz(key: string): number {
  const token = key.trim().split(/\s+/)[0] ?? "D";
  return NOTE_TO_HZ[token] ?? NOTE_TO_HZ["D"]!;
}

export interface HarmonicResonance {
  input: AudioNode;
  output: AudioNode;
  setDepth(depth: number, audioTime: number): void;
  dispose(): void;
}

/**
 * Gentle peaking EQ at root + fifth of the pack key.
 * depth 0 = bypass feel; depth 1 ≈ +2.5 dB max (still subtle).
 */
export function createHarmonicResonance(
  ctx: BaseAudioContext,
  destination: AudioNode,
  key: string,
): HarmonicResonance {
  const input = ctx.createGain();
  input.gain.value = 1;

  const rootHz = parseKeyRootHz(key);
  const fifthHz = rootHz * 1.5;

  const root = ctx.createBiquadFilter();
  root.type = "peaking";
  root.frequency.value = rootHz;
  root.Q.value = 1.1;
  root.gain.value = 0;

  const fifth = ctx.createBiquadFilter();
  fifth.type = "peaking";
  fifth.frequency.value = Math.min(fifthHz, 1800);
  fifth.Q.value = 0.9;
  fifth.gain.value = 0;

  // Soft high shelf cut to reduce masking against music highs when depth rises
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 3200;
  shelf.gain.value = 0;

  input.connect(root);
  root.connect(fifth);
  fifth.connect(shelf);
  shelf.connect(destination);

  return {
    input,
    output: shelf,
    setDepth(depth, audioTime) {
      const d = Math.min(1, Math.max(0, depth));
      const peakDb = d * 2.5;
      const shelfDb = d * -1.2;
      try {
        root.gain.setTargetAtTime(peakDb, audioTime, 0.12);
        fifth.gain.setTargetAtTime(peakDb * 0.65, audioTime, 0.12);
        shelf.gain.setTargetAtTime(shelfDb, audioTime, 0.12);
      } catch {
        /* teardown */
      }
    },
    dispose() {
      for (const n of [input, root, fifth, shelf]) {
        try {
          n.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    },
  };
}
