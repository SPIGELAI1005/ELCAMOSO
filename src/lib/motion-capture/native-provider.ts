import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { JourneyTraceV1 } from "@/lib/journey-trace";
import { WebMotionCaptureProvider } from "./web-provider";
import {
  IDLE_CAPTURE_STATUS,
  type MotionCaptureProvider,
  type MotionCaptureStartOptions,
  type MotionCaptureStatus,
  type MotionListener,
} from "./types";

interface NativeJourneyCapturePlugin {
  requestPermissions(): Promise<{ location: "granted" | "denied" | "prompt" }>;
  startCapture(options: MotionCaptureStartOptions): Promise<void>;
  stopCapture(): Promise<{ journey?: JourneyTraceV1 }>;
  getStatus(): Promise<MotionCaptureStatus>;
  listPendingJourneys(): Promise<{ journeys: JourneyTraceV1[] }>;
  acknowledgeJourneys(options: { journeyIds: string[] }): Promise<void>;
  addListener(
    eventName: "motionSample",
    listener: (sample: {
      timestamp: number;
      speedKmh: number;
      accelerationLongitudinal: number;
      accuracy: number;
    }) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeJourneyCapture = registerPlugin<NativeJourneyCapturePlugin>("NativeJourneyCapture");

/** Native persistence + OS background capture, with browser sensors for live foreground audio. */
export class NativeMotionCaptureProvider implements MotionCaptureProvider {
  readonly platform = "native" as const;
  readonly ownsJourneyPersistence = true;
  private foregroundSensors = new WebMotionCaptureProvider();
  private nativeListener: PluginListenerHandle | null = null;
  private persistJourney = false;

  async start(options: MotionCaptureStartOptions, listener: MotionListener): Promise<void> {
    this.persistJourney = options.persistJourney;

    if (!options.persistJourney) {
      // Live-only Drive needs foreground access, not iOS Always authorization.
      await this.foregroundSensors.start(options, listener);
      return;
    }

    const permission = await NativeJourneyCapture.requestPermissions();
    if (permission.location !== "granted") throw new Error("location-permission-denied");

    await NativeJourneyCapture.startCapture(options);
    this.nativeListener = await NativeJourneyCapture.addListener("motionSample", (sample) => {
      listener(
        {
          source: "phone",
          timestamp: sample.timestamp,
          speedKmh: sample.speedKmh,
          accelerationLongitudinal: sample.accelerationLongitudinal,
          accuracy: sample.accuracy,
        },
        performance.now(),
      );
    });
  }

  async stop(): Promise<JourneyTraceV1 | null> {
    await this.nativeListener?.remove();
    this.nativeListener = null;
    await this.foregroundSensors.stop();
    const nativeStatus = await NativeJourneyCapture.getStatus().catch(() => null);
    if (!this.persistJourney && !nativeStatus?.active) return null;
    this.persistJourney = false;
    const result = await NativeJourneyCapture.stopCapture();
    return result.journey ?? null;
  }

  async getStatus(): Promise<MotionCaptureStatus> {
    try {
      return await NativeJourneyCapture.getStatus();
    } catch {
      return { ...IDLE_CAPTURE_STATUS, backgroundCapable: true };
    }
  }

  async drainCompletedJourneys(): Promise<JourneyTraceV1[]> {
    const result = await NativeJourneyCapture.listPendingJourneys();
    return Array.isArray(result.journeys) ? result.journeys : [];
  }

  async acknowledgeJourneys(journeyIds: string[]) {
    if (journeyIds.length) await NativeJourneyCapture.acknowledgeJourneys({ journeyIds });
  }

  dispose() {
    void this.nativeListener?.remove();
    this.nativeListener = null;
    this.foregroundSensors.dispose();
  }
}
