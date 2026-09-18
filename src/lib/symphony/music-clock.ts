import type { MusicClockConfig, MusicClockSnapshot, QuantizeGrid } from "./types";

export function beatDurationSec(bpm: number): number {
  return 60 / Math.max(bpm, 1);
}

export function barDurationSec(bpm: number, beatsPerBar: number): number {
  return beatDurationSec(bpm) * Math.max(beatsPerBar, 1);
}

export function loopDurationSec(config: MusicClockConfig): number {
  return barDurationSec(config.bpm, config.beatsPerBar) * Math.max(config.barsPerLoop, 1);
}

export function samplesPerLoop(config: MusicClockConfig, sampleRate: number): number {
  return Math.max(1, Math.round(loopDurationSec(config) * sampleRate));
}

/**
 * Deterministic music clock anchored to AudioContext.currentTime.
 * BPM is fixed per pack - driving does not scrub tempo.
 */
export function createMusicClock(config: MusicClockConfig, startAudioTime: number) {
  let origin = startAudioTime;

  function snapshot(audioTime: number): MusicClockSnapshot {
    const beatDur = beatDurationSec(config.bpm);
    const barDur = barDurationSec(config.bpm, config.beatsPerBar);
    const loopDur = loopDurationSec(config);
    const elapsed = Math.max(0, audioTime - origin);
    const absoluteBeat = elapsed / beatDur;
    const beatInBar = absoluteBeat % config.beatsPerBar;
    const barInLoop = Math.floor(elapsed / barDur) % config.barsPerLoop;
    return {
      bpm: config.bpm,
      beatsPerBar: config.beatsPerBar,
      barsPerLoop: config.barsPerLoop,
      beatDuration: beatDur,
      barDuration: barDur,
      loopDuration: loopDur,
      beat: Math.floor(beatInBar),
      bar: barInLoop,
      absoluteBeat,
      beatPhase: beatInBar - Math.floor(beatInBar),
      audioTime,
    };
  }

  function nextBoundary(audioTime: number, grid: QuantizeGrid): number {
    const beatDur = beatDurationSec(config.bpm);
    const barDur = barDurationSec(config.bpm, config.beatsPerBar);
    const elapsed = Math.max(0, audioTime - origin);
    let step: number;
    switch (grid) {
      case "beat":
        step = beatDur;
        break;
      case "halfBar":
        step = barDur / 2;
        break;
      case "twoBars":
        step = barDur * 2;
        break;
      default:
        step = barDur;
    }
    const next = Math.ceil((elapsed + 1e-4) / step) * step;
    return origin + next;
  }

  return {
    config,
    get origin() {
      return origin;
    },
    /** Keep clock continuous across source switches - never reset mid-drive. */
    reanchor(audioTime: number) {
      const snap = snapshot(audioTime);
      // Preserve musical phase: set origin so absoluteBeat continues
      origin = audioTime - snap.absoluteBeat * beatDurationSec(config.bpm);
    },
    snapshot,
    nextBoundary,
  };
}

export type MusicClock = ReturnType<typeof createMusicClock>;
