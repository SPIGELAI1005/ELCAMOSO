/** Phone side: read GPS + DeviceMotion, send ~5 samples/s to the car. */
import { openSyncChannel, type SyncChannel } from "./channel";
import { MotionEstimator } from "./motion";
import type { PhoneSample } from "./protocol";

export interface StreamerStatus {
  channel: "connecting" | "live" | "error";
  gps: "waiting" | "ok" | "denied";
  motion: "ok" | "denied" | "unsupported";
  carClosed: boolean;
}

type PermFn = { requestPermission?: () => Promise<"granted" | "denied"> };

/** Must run inside a tap handler on iOS (permission prompts). */
export async function requestMotionPermission(): Promise<boolean> {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const D = DeviceMotionEvent as unknown as PermFn;
  if (typeof D.requestPermission === "function") {
    try {
      return (await D.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export async function startPhoneStreaming(
  code: string,
  motionAllowed: boolean,
  onStatus: (s: StreamerStatus) => void,
): Promise<() => void> {
  const status: StreamerStatus = {
    channel: "connecting",
    gps: "waiting",
    motion: motionAllowed
      ? "ok"
      : typeof DeviceMotionEvent === "undefined"
        ? "unsupported"
        : "denied",
    carClosed: false,
  };
  const emit = () => onStatus({ ...status });
  emit();

  const est = new MotionEstimator();
  let lastMotionTs = 0;
  let lastWithG: [number, number, number] = [0, 0, 9.81];
  let gps: Pick<PhoneSample, "altitude" | "altitudeAccuracy" | "speed" | "heading"> = {
    altitude: null,
    altitudeAccuracy: null,
    speed: null,
    heading: null,
  };
  let lastGpsSpeed: { v: number; t: number } | null = null;

  const ch: SyncChannel | null = await openSyncChannel(
    code,
    {
      closed: () => {
        status.carClosed = true;
        emit();
      },
      welcome: () => {},
    },
    (st) => {
      status.channel =
        st === "SUBSCRIBED"
          ? "live"
          : st === "CHANNEL_ERROR" || st === "TIMED_OUT"
            ? "error"
            : status.channel;
      if (st === "SUBSCRIBED") ch?.send("hello", {});
      emit();
    },
  );
  if (!ch) {
    status.channel = "error";
    emit();
    return () => {};
  }

  const onMotion = (e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null || g.z == null) return;
    const now = performance.now();
    const dt = lastMotionTs ? Math.min(0.2, (now - lastMotionTs) / 1000) : 1 / 60;
    lastMotionTs = now;
    lastWithG = [g.x, g.y, g.z];
    const a = e.acceleration;
    const lin: [number, number, number] | null =
      a && a.x != null && a.y != null && a.z != null ? [a.x, a.y, a.z] : null;
    est.push(lastWithG, lin, dt);
  };
  if (motionAllowed) window.addEventListener("devicemotion", onMotion);

  let watchId: number | null = null;
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        const c = p.coords;
        gps = {
          altitude: c.altitude,
          altitudeAccuracy: c.altitudeAccuracy,
          speed: c.speed,
          heading: c.heading,
        };
        if (c.speed != null) {
          if (lastGpsSpeed) {
            const dt = (p.timestamp - lastGpsSpeed.t) / 1000;
            if (dt > 0.3 && dt < 3) est.learnForward((c.speed - lastGpsSpeed.v) / dt, lastWithG);
          }
          lastGpsSpeed = { v: c.speed, t: p.timestamp };
        }
        if (status.gps !== "ok") {
          status.gps = "ok";
          emit();
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          status.gps = "denied";
          emit();
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
  }

  const send = setInterval(() => {
    const m = est.read();
    const sample: PhoneSample = {
      t: Date.now(),
      ...gps,
      longAccel: motionAllowed ? m.longAccel : null,
      latAccel: motionAllowed ? m.latAccel : null,
      bump: motionAllowed ? m.bump : null,
    };
    ch.send("sample", sample);
  }, 200);

  return () => {
    clearInterval(send);
    window.removeEventListener("devicemotion", onMotion);
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    ch.send("bye", {});
    ch.close();
  };
}
