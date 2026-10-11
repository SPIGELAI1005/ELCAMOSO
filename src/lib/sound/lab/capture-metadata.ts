import type { LabFixtureKind } from "@/lib/sound/lab/fixtures";
import type { LabSignalMetrics } from "@/lib/sound/lab/metrics";

/** Bump when harness behaviour that affects captures changes. */
export const LAB_HARNESS_REVISION = "audio-lab-v1";

/** Production graph identity string — not a replacement demo synth. */
export const LAB_RENDERER_FAMILY = "production-SoundEngine";

export type LabCapturePath = "offline-audio-context" | "realtime-audio-context";

export interface LabCaptureSettings {
  volume: number;
  measurementGain: number;
  realismEngine: "current" | "v2" | "v3";
  synthesisMode: "original" | "improved";
  experienceTuningEnabled: boolean;
  seed: number;
}

export interface LabCaptureMetadata {
  schemaVersion: 1;
  profileId: string;
  /** Optional B side for A/B captures. */
  profileIdB?: string;
  fixtureId: string;
  fixtureKind: LabFixtureKind;
  harnessRevision: typeof LAB_HARNESS_REVISION;
  rendererFamily: typeof LAB_RENDERER_FAMILY;
  rendererBackend: string;
  excitationMode: string | null;
  capturePath: LabCapturePath;
  sampleRate: number;
  durationSeconds: number;
  seed: number;
  settings: LabCaptureSettings;
  generatedAt: string;
  limitations: string[];
  /** Never persist location or email — reserved to document that policy. */
  privacy: {
    locationPersisted: false;
    emailPersisted: false;
  };
}

export interface LabCaptureResult {
  metadata: LabCaptureMetadata;
  metrics: LabSignalMetrics;
  wavBase64: string;
  /** Optional mono magnitude spectrum for UI (not written to WAV sidecar by default). */
  spectrum?: { hz: number; db: number }[];
  renderElapsedMs: number;
}

export const DEFAULT_LAB_LIMITATIONS = [
  "Meters report sample peak/RMS/crest and approximate integrated loudness — not true peak or certified LUFS.",
  "Band energies use cascaded one-pole approximations; useful for relative diagnosis, not mastering.",
  "Spectral centroid is a diagnostic proxy; lower centroid or more bass does not prove realism.",
  "Automated capture is not human listening verification or Tesla cabin verification.",
  "OfflineAudioContext may use the production worklet when available; otherwise Realism V2 falls back to documented main-thread excitation — see excitationMode.",
  "Realtime capture uses the same SoundEngine DSP but wall-clock scheduling may differ from offline render.",
] as const;

export function buildLabCaptureMetadata(input: {
  profileId: string;
  profileIdB?: string;
  fixtureId: string;
  fixtureKind: LabFixtureKind;
  rendererBackend: string;
  excitationMode: string | null;
  capturePath: LabCapturePath;
  sampleRate: number;
  durationSeconds: number;
  settings: LabCaptureSettings;
  extraLimitations?: string[];
}): LabCaptureMetadata {
  return {
    schemaVersion: 1,
    profileId: input.profileId,
    ...(input.profileIdB ? { profileIdB: input.profileIdB } : {}),
    fixtureId: input.fixtureId,
    fixtureKind: input.fixtureKind,
    harnessRevision: LAB_HARNESS_REVISION,
    rendererFamily: LAB_RENDERER_FAMILY,
    rendererBackend: input.rendererBackend,
    excitationMode: input.excitationMode,
    capturePath: input.capturePath,
    sampleRate: input.sampleRate,
    durationSeconds: input.durationSeconds,
    seed: input.settings.seed,
    settings: input.settings,
    generatedAt: new Date().toISOString(),
    limitations: [...DEFAULT_LAB_LIMITATIONS, ...(input.extraLimitations ?? [])],
    privacy: {
      locationPersisted: false,
      emailPersisted: false,
    },
  };
}

export function assertLabCaptureMetadata(value: unknown): asserts value is LabCaptureMetadata {
  if (!value || typeof value !== "object") throw new Error("metadata must be an object");
  const meta = value as LabCaptureMetadata;
  if (meta.schemaVersion !== 1) throw new Error("unsupported metadata schemaVersion");
  if (!meta.profileId || !meta.fixtureId) throw new Error("profileId and fixtureId required");
  if (meta.harnessRevision !== LAB_HARNESS_REVISION) {
    throw new Error(`unexpected harnessRevision: ${meta.harnessRevision}`);
  }
  if (meta.rendererFamily !== LAB_RENDERER_FAMILY) {
    throw new Error(`unexpected rendererFamily: ${meta.rendererFamily}`);
  }
  if (meta.privacy?.locationPersisted !== false || meta.privacy?.emailPersisted !== false) {
    throw new Error("metadata must not persist location or email");
  }
  if (!Number.isFinite(meta.sampleRate) || meta.sampleRate <= 0) {
    throw new Error("sampleRate must be a positive finite number");
  }
  if (!Number.isFinite(meta.seed)) throw new Error("seed must be finite");
}
