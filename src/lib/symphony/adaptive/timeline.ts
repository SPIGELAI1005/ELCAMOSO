/**
 * Look-ahead step sequencer. Tempo is read per 16th step from the conductor, so tempo
 * changes are smooth and always land on the grid; key/genre changes wait for the bar line.
 */
import type { ConductorState, MusicAccent } from "./conductor";
import { accentNotes, GENRES, type GenreDef, type GenreId, type NoteSpec } from "./genres";

export interface NoteEvent extends NoteSpec {
  time: number;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTimeline(genreId: GenreId, startTime: number, seed = 1) {
  let genre: GenreDef = GENRES[genreId];
  let pendingGenre: GenreDef | null = null;
  let nextStepTime = startTime;
  let stepCount = 0;
  let stepInBar = 0;
  let barCount = 0;
  let transpose = 0;
  let variation = 0;
  let cruiseBars = 0;
  const rand = mulberry32(seed);
  const queuedAccents: MusicAccent[] = [];
  let crashNextBar = false;

  return {
    get genre() {
      return genre;
    },
    setGenre(id: GenreId) {
      if (id !== genre.id) pendingGenre = GENRES[id];
    },
    pushAccents(a: MusicAccent[]) {
      for (const x of a) if (!queuedAccents.includes(x)) queuedAccents.push(x);
    },
    /** Produce every note that starts before `until`. */
    scheduleUntil(until: number, state: ConductorState): NoteEvent[] {
      const out: NoteEvent[] = [];
      // never schedule in the past after a stall: skip ahead on the grid
      while (nextStepTime < until) {
        const spb = genre.stepsPerBar ?? 16;
        if (stepInBar >= spb) {
          stepInBar = 0;
          barCount += 1;
        }
        const step = stepInBar;
        const bar = barCount;
        if (step === 0) {
          if (pendingGenre) {
            genre = pendingGenre;
            pendingGenre = null;
          }
          transpose = state.transpose;
          if (state.mode === "cruise") {
            cruiseBars += 1;
            if (cruiseBars % 8 === 0) variation += 1;
          } else cruiseBars = 0;
        }
        const bpm = genre.fixedBpm ?? Math.min(genre.bpmMax + 6, Math.max(genre.bpmMin - 2, state.bpm));
        const stepDur = 60 / bpm / 4;
        const chordDef = genre.progression[bar % genre.progression.length]!;
        const root = genre.key + chordDef.deg + transpose;
        const chord = chordDef.tones.map((t) => root + t);
        const ctx = {
          step,
          bar,
          chord,
          root,
          intensity: state.intensity,
          mode: state.mode,
          variation,
          stepDur,
          barDur: stepDur * (genre.stepsPerBar ?? 16),
          rand,
        };
        const notes = genre.pattern(ctx);
        if (genre.layers && ctx.mode !== "brake" && ctx.mode !== "stopped") notes.push(...genre.layers(ctx));

        if (step === 0 && crashNextBar) {
          notes.push({ inst: genre.accents.crash[0], midi: genre.accents.crash[1], vel: 0.8, dur: 1.5 });
          crashNextBar = false;
        }
        if (step % 4 === 0 && queuedAccents.length) {
          const kinds = queuedAccents.splice(0, queuedAccents.length);
          for (const k of kinds) {
            if (k === "brake") continue; // the softer arrangement is the accent
            if (k === "surge") {
              notes.push(...accentNotes(genre, "surge", stepDur));
              crashNextBar = true;
              continue;
            }
            notes.push({ inst: genre.accents.crash[0], midi: genre.accents.crash[1], vel: 0.55 + 0.3 * state.intensity, dur: 1.2 });
            notes.push(...accentNotes(genre, k, stepDur));
          }
        }
        for (const n of notes) {
          const vel = Math.min(1, n.vel);
          out.push({ ...n, vel, time: nextStepTime + (n.offset ?? 0) * stepDur });
        }
        nextStepTime += stepDur;
        stepCount += 1;
        stepInBar += 1;
      }
      return out;
    },
    resync(now: number) {
      if (nextStepTime < now) nextStepTime = now + 0.05;
    },
    get stepCount() {
      return stepCount;
    },
    get bar() {
      return barCount;
    },
  };
}

export type Timeline = ReturnType<typeof createTimeline>;
