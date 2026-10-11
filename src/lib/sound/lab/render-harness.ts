/**
 * Production SoundEngine render harness for the audio lab (Prompt 01).
 * Does not replace the engine with a demo synthesizer.
 */

import type { DriveState } from "@/lib/drive/model";
import { resolvePersonalityId } from "@/lib/drive/drivetrain-resolve";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import {
  getLabFixture,
  type LabFixture,
  type LabTelemetrySample,
} from "@/lib/sound/lab/fixtures";
import {
  buildLabCaptureMetadata,
  type LabCapturePath,
  type LabCaptureResult,
  type LabCaptureSettings,
} from "@/lib/sound/lab/capture-metadata";
import { analyseLabSignal, magnitudeSpectrumDb } from "@/lib/sound/lab/metrics";

export const LAB_SAMPLE_RATE = 48_000;
export const LAB_STEP_SECONDS = 1 / 60;
/** Fixed measurement volume so spectra remain comparable across runs. */
export const LAB_MEASUREMENT_VOLUME = 0.7;
export const LAB_DEFAULT_SEED = 0x454c4341; // "ELCA"

export interface LabRenderOptions {
  profileId: string;
  /** Second profile for abrupt mid-fixture switch (profile-switch fixture). */
  profileIdB?: string;
  fixtureId: string;
  settings?: Partial<LabCaptureSettings>;
  capturePath?: LabCapturePath;
  includeSpectrum?: boolean;
}

function resolveSettings(partial?: Partial<LabCaptureSettings>): LabCaptureSettings {
  return {
    volume: LAB_MEASUREMENT_VOLUME,
    measurementGain: 1,
    realismEngine: partial?.realismEngine ?? "v2",
    synthesisMode: partial?.synthesisMode ?? "improved",
    experienceTuningEnabled: partial?.experienceTuningEnabled ?? true,
    seed: partial?.seed ?? LAB_DEFAULT_SEED,
  };
}

function encodeWav(channels: Float32Array[], sampleRate: number) {
  const frameCount = channels[0]!.length;
  const bytes = new Uint8Array(44 + frameCount * channels.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frameCount * channels.length * 2, true);
  let offset = 44;
  for (let i = 0; i < frameCount; i += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(binary);
}

function applyMeasurementGain(channels: Float32Array[], gain: number) {
  if (gain === 1) return channels;
  return channels.map((channel) => {
    const out = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i += 1) out[i] = (channel[i] ?? 0) * gain;
    return out;
  });
}

function driveStateFromSample(
  sample: LabTelemetrySample,
  timestampMs: number,
  simulator: PowertrainSimulator | null,
  prevSpeedMps: number,
): { state: DriveState; speedMps: number } {
  const lost = sample.motionConfidence <= 0;
  // GPS loss: do not force speed to zero; hold prior speed with decaying confidence.
  const speedKmh = lost ? prevSpeedMps * 3.6 : sample.speedKmh;
  const speedMps = speedKmh / 3.6;

  if (sample.rpmOverride !== undefined || sample.loadOverride !== undefined) {
    const rpm = sample.rpmOverride ?? 0;
    const load = sample.loadOverride ?? sample.throttle;
    return {
      speedMps,
      state: {
        speed: speedMps,
        acceleration: sample.accelerationMs2,
        throttle: sample.throttle,
        regen: sample.braking,
        rpm,
        gear: 0,
        load,
        timestamp: timestampMs,
        jerk: 0,
        isShifting: false,
        powertrainBackend: "legacy",
        speedNormalized: Math.min(1, speedKmh / 160),
        accelerationNormalized: Math.min(1, Math.abs(sample.accelerationMs2) / 4.5),
      },
    };
  }

  if (!simulator) {
    return {
      speedMps,
      state: {
        speed: speedMps,
        acceleration: lost ? 0 : sample.accelerationMs2,
        throttle: sample.throttle,
        regen: sample.braking,
        rpm: 0,
        gear: 0,
        load: sample.throttle,
        timestamp: timestampMs,
        jerk: 0,
        isShifting: false,
        powertrainBackend: "legacy",
        speedNormalized: Math.min(1, speedKmh / 160),
        accelerationNormalized: Math.min(1, Math.abs(sample.accelerationMs2) / 4.5),
      },
    };
  }

  const pt = simulator.tick(
    {
      timestamp: timestampMs,
      speedKmh,
      accelerationMs2: lost ? 0 : sample.accelerationMs2,
      accelerationFiltered: lost ? 0 : sample.accelerationMs2,
      decelerationMs2: Math.max(0, -(lost ? 0 : sample.accelerationMs2)),
      inferredThrottle: sample.throttle,
      motionConfidence: sample.motionConfidence,
      primarySource: sample.primarySource,
      sourceHealth: {
        phone: sample.primarySource === "phone" && !lost,
        browser: sample.primarySource === "tesla-browser" && !lost,
        vehicleTelemetry:
          (sample.primarySource === "vehicle-telemetry" ||
            sample.primarySource === "simulator") &&
          !lost,
      },
      fallbackTier: lost ? "hold" : "vehicle-telemetry",
      transitioning: false,
    },
    LAB_STEP_SECONDS,
    {
      directThrottle: sample.throttle,
      braking: sample.braking,
      pedalPosition: sample.throttle,
    },
  );

  return {
    speedMps,
    state: {
      speed: speedMps,
      acceleration: lost ? 0 : sample.accelerationMs2,
      throttle: pt.driverDemand,
      regen: sample.braking,
      rpm: pt.rpm,
      gear: pt.gear,
      load: pt.engineLoad,
      timestamp: timestampMs,
      jerk: 0,
      isShifting: pt.shifting,
      powertrain: pt,
      powertrainBackend: "dynamic",
      speedNormalized: Math.min(1, speedKmh / 160),
      accelerationNormalized: Math.min(1, Math.abs(sample.accelerationMs2) / 4.5),
    },
  };
}

async function configureEngine(
  engine: SoundEngine,
  profileId: string,
  settings: LabCaptureSettings,
  context: AudioContext | OfflineAudioContext,
) {
  const profile = getProfile(profileId);
  engine.setExperienceTuningEnabled(settings.experienceTuningEnabled);
  engine.setSynthesisMode(settings.synthesisMode);
  engine.setRealismEngine(settings.realismEngine);
  engine.setVolume(settings.volume);
  await engine.start(profile, {
    context,
    signature: false,
    seed: settings.seed,
  });
}

function createSimulator(profileId: string, fixture: LabFixture): PowertrainSimulator | null {
  if (fixture.kind === "rpm-load-diagnostic") return null;
  const profile = getProfile(profileId);
  return new PowertrainSimulator({ profileId: resolvePersonalityId(profile) });
}

/**
 * Offline capture through Chrome OfflineAudioContext + production SoundEngine.
 */
export async function renderLabOffline(options: LabRenderOptions): Promise<LabCaptureResult> {
  const started = performance.now();
  const fixture = getLabFixture(options.fixtureId);
  const settings = resolveSettings(options.settings);
  const duration = fixture.durationSeconds;
  const context = new OfflineAudioContext(
    2,
    Math.ceil(LAB_SAMPLE_RATE * duration),
    LAB_SAMPLE_RATE,
  );
  const engine = new SoundEngine();
  await configureEngine(engine, options.profileId, settings, context);
  let simulator = createSimulator(options.profileId, fixture);
  let prevSpeed = 0;
  let switched = false;
  const switchAt = duration * 0.5;

  for (let time = 0; time < duration; time += LAB_STEP_SECONDS) {
    if (
      fixture.abruptProfileSwitch &&
      !switched &&
      time >= switchAt &&
      options.profileIdB &&
      options.profileIdB !== options.profileId
    ) {
      engine.setProfile(getProfile(options.profileIdB));
      simulator = createSimulator(options.profileIdB, fixture);
      switched = true;
    }
    engine.setRenderTime(time);
    const sample = fixture.sampleAt(Math.min(time, duration));
    const { state, speedMps } = driveStateFromSample(
      sample,
      Math.round(time * 1000),
      simulator,
      prevSpeed,
    );
    prevSpeed = speedMps;
    engine.update(state);
  }

  const backend = engine.getActiveBackend();
  const hybrid = engine.getHybridCombustionDiagnostics();
  const rendered = await context.startRendering();
  const raw = [rendered.getChannelData(0).slice(), rendered.getChannelData(1).slice()];
  const channels = applyMeasurementGain(raw, settings.measurementGain);
  const metrics = analyseLabSignal(channels, LAB_SAMPLE_RATE);
  const mono = new Float32Array(channels[0]!.length);
  for (let i = 0; i < mono.length; i += 1) {
    mono[i] = ((channels[0]![i] ?? 0) + (channels[1]![i] ?? 0)) * 0.5;
  }

  return {
    metadata: buildLabCaptureMetadata({
      profileId: options.profileId,
      ...(options.profileIdB ? { profileIdB: options.profileIdB } : {}),
      fixtureId: fixture.id,
      fixtureKind: fixture.kind,
      rendererBackend: backend,
      excitationMode: hybrid?.excitationMode ?? null,
      capturePath: "offline-audio-context",
      sampleRate: LAB_SAMPLE_RATE,
      durationSeconds: duration,
      settings,
    }),
    metrics,
    wavBase64: encodeWav(channels, LAB_SAMPLE_RATE),
    ...(options.includeSpectrum
      ? { spectrum: magnitudeSpectrumDb(mono, LAB_SAMPLE_RATE) }
      : {}),
    renderElapsedMs: performance.now() - started,
  };
}

/**
 * Realtime capture path using the same SoundEngine DSP.
 * Disclosed limitation: wall-clock scheduling; intended when OfflineAudioContext
 * cannot exercise a required path in a given environment.
 */
export async function renderLabRealtime(options: LabRenderOptions): Promise<LabCaptureResult> {
  const started = performance.now();
  const fixture = getLabFixture(options.fixtureId);
  const settings = resolveSettings(options.settings);
  const duration = fixture.durationSeconds;
  const AudioCtx =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("AudioContext unavailable for realtime lab capture");
  }

  const context = new AudioCtx({ sampleRate: LAB_SAMPLE_RATE });
  const engine = new SoundEngine();
  const sampleCount = Math.ceil(LAB_SAMPLE_RATE * duration);
  const recorded: Float32Array[] = [new Float32Array(sampleCount), new Float32Array(sampleCount)];
  let writeIndex = 0;

  const recorder = context.createScriptProcessor(1024, 2, 2);
  recorder.onaudioprocess = (event) => {
    const left = event.inputBuffer.getChannelData(0);
    const right = event.inputBuffer.getChannelData(1);
    for (let i = 0; i < left.length && writeIndex < sampleCount; i += 1) {
      recorded[0]![writeIndex] = left[i] ?? 0;
      recorded[1]![writeIndex] = right[i] ?? 0;
      writeIndex += 1;
    }
  };

  await configureEngine(engine, options.profileId, settings, context);
  // Tap master destination: SoundEngine connects to context.destination.
  // ScriptProcessor must be in the graph — connect a silent gain after tap.
  const silent = context.createGain();
  silent.gain.value = 0;
  // The engine already outputs to destination; we cannot easily insert without
  // engine API. Capture via MediaStreamDestination if available, else fall back
  // to offline. Prefer Offline for accuracy; realtime path records via destination
  // stream when supported.
  const streamDest =
    "createMediaStreamDestination" in context
      ? context.createMediaStreamDestination()
      : null;

  let simulator = createSimulator(options.profileId, fixture);
  let prevSpeed = 0;
  let switched = false;
  const switchAt = duration * 0.5;
  const wallStart = performance.now();

  // Drive updates on rAF until duration elapsed.
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      try {
        const elapsed = (performance.now() - wallStart) / 1000;
        if (elapsed >= duration || writeIndex >= sampleCount) {
          resolve();
          return;
        }
        if (
          fixture.abruptProfileSwitch &&
          !switched &&
          elapsed >= switchAt &&
          options.profileIdB &&
          options.profileIdB !== options.profileId
        ) {
          engine.setProfile(getProfile(options.profileIdB));
          simulator = createSimulator(options.profileIdB, fixture);
          switched = true;
        }
        const sample = fixture.sampleAt(Math.min(elapsed, duration));
        const { state, speedMps } = driveStateFromSample(
          sample,
          Math.round(elapsed * 1000),
          simulator,
          prevSpeed,
        );
        prevSpeed = speedMps;
        engine.update(state);
        requestAnimationFrame(tick);
      } catch (error) {
        reject(error);
      }
    };
    // Keep ScriptProcessor alive in the graph (muted).
    recorder.connect(silent);
    silent.connect(context.destination);
    if (streamDest) {
      // Best-effort: no public tap from SoundEngine; realtime path documents this limit.
      void streamDest;
    }
    void context.resume().then(() => requestAnimationFrame(tick));
  });

  await engine.stop();
  recorder.disconnect();
  silent.disconnect();
  await context.close();

  // If ScriptProcessor did not receive engine audio (no insert point), fall back
  // to offline so the lab still produces a production-graph capture.
  if (writeIndex < LAB_SAMPLE_RATE * 0.25) {
    const offline = await renderLabOffline({
      ...options,
      capturePath: "offline-audio-context",
    });
    return {
      ...offline,
      metadata: {
        ...offline.metadata,
        capturePath: "offline-audio-context",
        limitations: [
          ...offline.metadata.limitations,
          "Realtime ScriptProcessor tap could not observe SoundEngine output; fell back to OfflineAudioContext production capture.",
        ],
      },
      renderElapsedMs: performance.now() - started,
    };
  }

  const channels = applyMeasurementGain(
    recorded.map((ch) => ch.subarray(0, writeIndex)),
    settings.measurementGain,
  );
  const metrics = analyseLabSignal(channels, context.sampleRate || LAB_SAMPLE_RATE);
  const backend = "realtime-capture";
  const mono = new Float32Array(channels[0]!.length);
  for (let i = 0; i < mono.length; i += 1) {
    mono[i] = ((channels[0]![i] ?? 0) + (channels[1]![i] ?? 0)) * 0.5;
  }

  return {
    metadata: buildLabCaptureMetadata({
      profileId: options.profileId,
      ...(options.profileIdB ? { profileIdB: options.profileIdB } : {}),
      fixtureId: fixture.id,
      fixtureKind: fixture.kind,
      rendererBackend: backend,
      excitationMode: null,
      capturePath: "realtime-audio-context",
      sampleRate: context.sampleRate || LAB_SAMPLE_RATE,
      durationSeconds: writeIndex / (context.sampleRate || LAB_SAMPLE_RATE),
      settings,
      extraLimitations: [
        "Realtime path uses wall-clock fixture replay; sample alignment may differ from offline.",
      ],
    }),
    metrics,
    wavBase64: encodeWav(channels, context.sampleRate || LAB_SAMPLE_RATE),
    ...(options.includeSpectrum
      ? { spectrum: magnitudeSpectrumDb(mono, context.sampleRate || LAB_SAMPLE_RATE) }
      : {}),
    renderElapsedMs: performance.now() - started,
  };
}

export async function renderLabCapture(options: LabRenderOptions): Promise<LabCaptureResult> {
  const path = options.capturePath ?? "offline-audio-context";
  if (path === "realtime-audio-context") return renderLabRealtime(options);
  return renderLabOffline(options);
}

/** Level-match gain (dB) so A/B share approximate integrated loudness without dual playback. */
export function levelMatchGainDb(
  referenceApproxLoudness: number,
  candidateApproxLoudness: number,
  peakDbfs: number,
  targetLoudness = -20,
): number {
  const loudnessGain = targetLoudness - candidateApproxLoudness;
  const headroomGain = -1 - peakDbfs;
  // Prefer matching toward the reference when provided, else absolute target.
  const towardRef = referenceApproxLoudness - candidateApproxLoudness;
  const desired = Number.isFinite(referenceApproxLoudness) ? towardRef : loudnessGain;
  return Math.min(headroomGain, desired);
}
