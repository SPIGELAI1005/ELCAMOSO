/**
 * Auto DJ: while the listener leaves the genre on "Auto DJ" (and the profile has no
 * signature genre), the music moves to another genre every 2-3 minutes. The next genre
 * is chosen by tempo compatibility (nearest BPM first, no recent repeats), the tempo is
 * ramped toward it, and the hand-off lands on a bar line with an equal-power crossfade
 * plus a filter sweep. All of the audio work is AudioParam automation scheduled once.
 */
import { GENRES, GENRE_IDS, type GenreId } from "./genres";

export const AUTO_DJ_INTERVAL_SEC: readonly [number, number] = [120, 180];
/** Genres Auto DJ never mixes into: 3/4 meter or story-bound signature pieces. */
const EXCLUDED: ReadonlySet<GenreId> = new Set(GENRE_IDS.filter((id) => (GENRES[id].stepsPerBar ?? 16) !== 16 || id === "gothic"));
/** How many recently played genres are skipped. */
const HISTORY = 3;

export function autoDjPool(): GenreId[] {
  return GENRE_IDS.filter((id) => !EXCLUDED.has(id));
}

/** Tempo a genre would play at when entered from `bpm`. */
export function genreTempo(id: GenreId, bpm: number): number {
  const g = GENRES[id];
  return g.fixedBpm ?? Math.min(g.bpmMax, Math.max(g.bpmMin, bpm));
}

/** Next genre: the 3 nearest-tempo candidates not heard recently, one picked at random. */
export function pickNextGenre(current: GenreId, bpm: number, recent: readonly GenreId[], rand: () => number = Math.random): GenreId {
  const pool = autoDjPool().filter((id) => id !== current);
  let fresh = pool.filter((id) => !recent.slice(-HISTORY).includes(id));
  if (!fresh.length) fresh = pool;
  if (!fresh.length) return current;
  const ranked = fresh
    .map((id) => ({ id, d: Math.abs(genreTempo(id, bpm) - bpm) }))
    .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
  const top = ranked.slice(0, Math.min(3, ranked.length));
  return top[Math.min(top.length - 1, Math.floor(rand() * top.length))]!.id;
}

export function nextAutoDjDelay(rand: () => number = Math.random, range: readonly [number, number] = AUTO_DJ_INTERVAL_SEC): number {
  return range[0] + (range[1] - range[0]) * rand();
}

/** Whole bars giving a crossfade of roughly 4-8 s (6 s target). */
export function crossfadeBars(barDur: number): number {
  return Math.max(1, Math.min(Math.floor(8 / barDur), Math.max(Math.ceil(4 / barDur), Math.round(6 / barDur))));
}

/** Equal-power gain curves (cos/sin), sampled once for setValueCurveAtTime. */
export function equalPowerCurves(points = 64): { out: Float32Array; in: Float32Array } {
  const out = new Float32Array(points);
  const inn = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    out[i] = Math.cos((x * Math.PI) / 2);
    inn[i] = Math.sin((x * Math.PI) / 2);
  }
  out[points - 1] = 0;
  inn[points - 1] = 1;
  return { out, in: inn };
}
