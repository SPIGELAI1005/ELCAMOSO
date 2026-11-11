/**
 * Cheap, mutable read of the Viral Epic Party transport and EDM phase.
 *
 * The music engine writes this once per audio tick. The light show reads it
 * inside requestAnimationFrame without allocating or triggering React renders.
 */
export const VIRAL_EDM_LIGHTS_PACK_ID = "symphony-viral-mix";

export type ViralEdmReadPhase = "bed" | "build" | "drop" | "melodic";

export interface ViralEdmTransport {
  ready: boolean;
  packId: string | null;
  audioTime: number;
  origin: number;
  /** performance.now() (ms) when audioTime was published, for rAF extrapolation. */
  perfNow: number;
  bpm: number;
  beatsPerBar: number;
  barsPerLoop: number;
  beatDuration: number;
  barDuration: number;
  beatPhase: number;
  bar: number;
  beat: number;
  absoluteBeat: number;
  phase: ViralEdmReadPhase;
  barsIntoPhase: number;
  buildProgress: number;
  lastBarOfBuild: boolean;
  kmh: number;
}

const INITIAL: ViralEdmTransport = {
  ready: false,
  packId: null,
  audioTime: 0,
  origin: 0,
  perfNow: 0,
  bpm: 120,
  beatsPerBar: 4,
  barsPerLoop: 4,
  beatDuration: 0.5,
  barDuration: 2,
  beatPhase: 0,
  bar: 0,
  beat: 0,
  absoluteBeat: 0,
  phase: "bed",
  barsIntoPhase: 0,
  buildProgress: 0,
  lastBarOfBuild: false,
  kmh: 0,
};

const transport: ViralEdmTransport = { ...INITIAL };

/** In-place write. Callers must not retain a stale view of fields they mutate later. */
export function publishViralEdmTransport(
  next: Omit<ViralEdmTransport, "ready"> & { ready?: boolean },
): void {
  transport.ready = next.ready ?? true;
  transport.packId = next.packId;
  transport.audioTime = next.audioTime;
  transport.origin = next.origin;
  transport.perfNow = next.perfNow;
  transport.bpm = next.bpm;
  transport.beatsPerBar = next.beatsPerBar;
  transport.barsPerLoop = next.barsPerLoop;
  transport.beatDuration = next.beatDuration;
  transport.barDuration = next.barDuration;
  transport.beatPhase = next.beatPhase;
  transport.bar = next.bar;
  transport.beat = next.beat;
  transport.absoluteBeat = next.absoluteBeat;
  transport.phase = next.phase;
  transport.barsIntoPhase = next.barsIntoPhase;
  transport.buildProgress = next.buildProgress;
  transport.lastBarOfBuild = next.lastBarOfBuild;
  transport.kmh = next.kmh;
}

/** The live object — never cloned. Safe to read from an animation frame. */
export function readViralEdmTransport(): Readonly<ViralEdmTransport> {
  return transport;
}

/** Clear after the publishing synth stops. Optional packId avoids clobbering a newer instance. */
export function clearViralEdmTransport(packId?: string | null): void {
  if (packId != null && transport.packId != null && transport.packId !== packId) return;
  Object.assign(transport, INITIAL);
}
