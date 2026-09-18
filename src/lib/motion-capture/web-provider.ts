import { resolveGpsSpeed, type GpsPoint } from "@/lib/drive/gps-speed";
import { browserGpsMotionSample, browserImuMotionSample } from "@/lib/motion/sensor-fusion";
import type {
  MotionCaptureProvider,
  MotionCaptureStartOptions,
  MotionCaptureStatus,
  MotionListener,
} from "./types";

/** Browser implementation: foreground/best-effort only. */
export class WebMotionCaptureProvider implements MotionCaptureProvider {
  readonly platform = "web" as const;
  readonly ownsJourneyPersistence = false;
  private watchId: number | null = null;
  private motionHandler: ((event: DeviceMotionEvent) => void) | null = null;
  private previousGps: GpsPoint | null = null;
  private startedAt: number | null = null;
  private sampleCount = 0;
  private quality: MotionCaptureStatus["quality"] = "balanced";
  private permission: MotionCaptureStatus["permission"] = "prompt";

  async start(options: MotionCaptureStartOptions, listener: MotionListener): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error("no-geo");
    this.dispose();
    this.startedAt = options.startedAt;
    this.quality = options.quality;
    this.sampleCount = 0;
    this.previousGps = null;

    const DeviceMotion = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DeviceMotion?.requestPermission === "function") {
      try {
        await DeviceMotion.requestPermission();
      } catch {
        // Location remains the baseline; IMU is an optional foreground enhancement.
      }
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const receivedAt = performance.now();
          const resolved = resolveGpsSpeed({
            reportedSpeed: position.coords.speed,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            atMs: receivedAt,
            previous: this.previousGps,
            accuracyM: position.coords.accuracy,
          });
          this.previousGps = resolved.point;
          if (resolved.source !== "none") {
            this.sampleCount += 1;
            listener(
              browserGpsMotionSample({
                speedMs: resolved.speed,
                accuracyM: Number.isFinite(position.coords.accuracy)
                  ? position.coords.accuracy
                  : null,
                timestamp: position.timestamp || Date.now(),
              }),
              receivedAt,
            );
          }
          if (!settled) {
            settled = true;
            this.permission = "granted";
            resolve();
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            this.permission = error.code === error.PERMISSION_DENIED ? "denied" : "prompt";
            reject(error);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: options.quality === "high-detail" ? 250 : 1000,
          timeout: 15_000,
        },
      );
    });

    this.motionHandler = (event) => {
      const longitudinal = event.accelerationIncludingGravity?.y ?? event.acceleration?.y;
      if (typeof longitudinal !== "number") return;
      this.sampleCount += 1;
      listener(
        browserImuMotionSample({ accelMs2: longitudinal, timestamp: Date.now() }),
        performance.now(),
      );
    };
    window.addEventListener("devicemotion", this.motionHandler);
  }

  async stop() {
    this.dispose();
    return null;
  }

  async getStatus(): Promise<MotionCaptureStatus> {
    return {
      active: this.startedAt !== null,
      backgroundCapable: false,
      startedAt: this.startedAt,
      durationMs: this.startedAt ? Date.now() - this.startedAt : 0,
      sampleCount: this.sampleCount,
      distanceM: 0,
      quality: this.quality,
      detail: this.motionHandler ? "full" : "reduced",
      permission: this.permission,
    };
  }

  async drainCompletedJourneys() {
    return [];
  }

  async acknowledgeJourneys() {}

  dispose() {
    if (this.watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.motionHandler && typeof window !== "undefined") {
      window.removeEventListener("devicemotion", this.motionHandler);
      this.motionHandler = null;
    }
    this.previousGps = null;
    this.startedAt = null;
  }
}
