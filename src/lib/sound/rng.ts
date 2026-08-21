/** Seeded LCG so offline renders and regression clips are repeatable. */

let state = 0x9e3779b9;

export function seedAudioRandom(seed: number) {
  state = seed >>> 0 || 0x9e3779b9;
}

export function audioRandom() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 0x100000000;
}
