import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DriveRecorderCore,
  driveLogFileName,
  type DriveLog,
  type SensorKey,
  type SensorLiveStatus,
} from "@/lib/drive-recorder/recorder-core";
import {
  deleteDriveLog,
  gzipJson,
  listDriveLogs,
  saveDriveLog,
} from "@/lib/drive-recorder/storage";
import {
  requestMotionPermission,
  requestOrientationPermission,
} from "@/lib/motion/phone-sensor-permissions";

export const Route = createFileRoute("/recorder")({
  component: DriveRecorderPage,
  head: () => ({
    meta: [{ title: "Drive sensor recorder · ELCAMOSO" }, { name: "robots", content: "noindex" }],
  }),
});

const SENSOR_LABEL: Record<SensorKey, string> = {
  gps: "GPS (location & speed)",
  motion: "Motion (accelerometer)",
  orientation: "Orientation (compass/tilt)",
};

function collectEnvironment(): Record<string, unknown> {
  const env: Record<string, unknown> = {
    userAgent: navigator.userAgent,
    platform: (navigator as Navigator & { platform?: string }).platform,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      devicePixelRatio: window.devicePixelRatio,
      orientation: screen.orientation?.type ?? null,
    },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    apis: {
      geolocation: "geolocation" in navigator,
      deviceMotion: "DeviceMotionEvent" in window,
      deviceOrientation: "DeviceOrientationEvent" in window,
      wakeLock: "wakeLock" in navigator,
      compressionStream: typeof CompressionStream !== "undefined",
      audioWorklet: typeof AudioWorkletNode !== "undefined",
    },
  };
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      env["audio"] = {
        sampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency ?? null,
        outputLatency: (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? null,
        state: ctx.state,
      };
      void ctx.close().catch(() => undefined);
    } else env["audio"] = null;
  } catch (e) {
    env["audio"] = { error: String(e) };
  }
  return env;
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function downloadLog(log: DriveLog) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(log)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = driveLogFileName(log);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function DriveRecorderPage() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<Record<SensorKey, SensorLiveStatus> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [drivingState, setDrivingState] = useState<string | null>(null);
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const [uploadAvailable, setUploadAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [gpsError, setGpsError] = useState<string | null>(null);
  const core = useRef<DriveRecorderCore | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    void listDriveLogs().then(setLogs);
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/drive-logs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { uploadAvailable: false }))
      .then((j: { uploadAvailable?: boolean }) => setUploadAvailable(Boolean(j.uploadAvailable)))
      .catch(() => setUploadAvailable(false));
    return () => cleanup.current?.();
  }, [refresh]);

  const start = useCallback(async () => {
    const c = new DriveRecorderCore();
    core.current = c;
    setGpsError(null);
    c.environment = collectEnvironment();
    c.addEvent(Date.now(), "start", { visibility: document.visibilityState });
    const [motionOk, orientOk] = await Promise.all([
      requestMotionPermission(),
      requestOrientationPermission(),
    ]);
    c.permissions["motion"] = motionOk ? "granted-or-not-required" : "denied-or-unavailable";
    c.permissions["orientation"] = orientOk ? "granted-or-not-required" : "denied-or-unavailable";
    try {
      const q = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (q) c.permissions["geolocationQuery"] = q.state;
    } catch {
      c.permissions["geolocationQuery"] = "unsupported";
    }

    const disposers: (() => void)[] = [];
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (p) => {
          c.addGps(Date.now(), {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
            speed: p.coords.speed,
            heading: p.coords.heading,
            altitude: p.coords.altitude,
            altitudeAccuracy: p.coords.altitudeAccuracy,
            timestamp: p.timestamp,
          });
          if (!c.permissions["geolocation"]) c.permissions["geolocation"] = "granted";
        },
        (err) => {
          c.addEvent(Date.now(), "gps-error", { code: err.code, message: err.message });
          if (err.code === 1) c.permissions["geolocation"] = "denied";
          setGpsError(err.code === 1 ? "Location permission denied" : `GPS: ${err.message}`);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
      disposers.push(() => navigator.geolocation.clearWatch(watchId));
    } else c.permissions["geolocation"] = "unavailable";

    const onMotion = (e: DeviceMotionEvent) => c.addMotion(Date.now(), e);
    const onOrient = (e: DeviceOrientationEvent) => c.addOrientation(Date.now(), e);
    const onVis = () => c.addEvent(Date.now(), "visibility", document.visibilityState);
    const onPageHide = () => {
      c.addEvent(Date.now(), "pagehide");
      void saveDriveLog(c.toLog(Date.now()));
    };
    const onOnline = () => c.addEvent(Date.now(), navigator.onLine ? "online" : "offline");
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrient);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    disposers.push(() => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrient);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    });

    let wakeLock: { release: () => Promise<void> } | null = null;
    try {
      wakeLock =
        (await (
          navigator as Navigator & {
            wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock?.request("screen")) ?? null;
      c.addEvent(Date.now(), "wakelock", wakeLock ? "acquired" : "unsupported");
    } catch (e) {
      c.addEvent(Date.now(), "wakelock", `failed: ${String(e)}`);
    }
    disposers.push(() => void wakeLock?.release().catch(() => undefined));

    const ui = window.setInterval(() => {
      const now = Date.now();
      setStatus(c.status(now));
      setElapsed(now - c.startEpoch);
      const d = c.latestDerived();
      setSpeedKmh(d ? Math.round(d[1] * 3.6) : null);
      setDrivingState(d ? d[6] : null);
    }, 500);
    const persist = window.setInterval(() => void saveDriveLog(c.toLog(Date.now())), 5000);
    disposers.push(() => {
      window.clearInterval(ui);
      window.clearInterval(persist);
    });

    cleanup.current = () => disposers.forEach((d) => d());
    await saveDriveLog(c.toLog(Date.now()));
    setRecording(true);
  }, []);

  const stop = useCallback(async () => {
    const c = core.current;
    cleanup.current?.();
    cleanup.current = null;
    setRecording(false);
    if (!c) return;
    c.stop(Date.now());
    await saveDriveLog(c.toLog());
    core.current = null;
    refresh();
  }, [refresh]);

  const upload = useCallback(async (log: DriveLog) => {
    setMessage((m) => ({ ...m, [log.id]: "Uploading…" }));
    try {
      const body = await gzipJson(log);
      if (body.type !== "application/gzip")
        throw new Error("This browser cannot compress the file. Use Download instead.");
      const res = await fetch(`/api/drive-logs?id=${encodeURIComponent(log.id)}`, {
        method: "POST",
        headers: { "content-type": "application/gzip" },
        body,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; pathname?: string };
      if (!res.ok) throw new Error(j.error ?? `Upload failed (${res.status})`);
      setMessage((m) => ({ ...m, [log.id]: `✅ Uploaded: ${j.pathname}` }));
    } catch (e) {
      setMessage((m) => ({ ...m, [log.id]: `❌ ${e instanceof Error ? e.message : String(e)}` }));
    }
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-foreground">
      <h1 className="text-2xl font-semibold">Drive sensor recorder</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Records which sensors this browser delivers while you drive. Keep this page open and in
        front.
      </p>

      <button
        type="button"
        onClick={() => void (recording ? stop() : start())}
        className={`mt-6 w-full rounded-2xl py-10 text-3xl font-bold text-white shadow-lg ${recording ? "bg-red-600" : "bg-emerald-600"}`}
      >
        {recording ? `■ Stop recording  ${fmtDuration(elapsed)}` : "● Start recording"}
      </button>

      {gpsError && <p className="mt-3 text-base font-medium text-red-500">{gpsError}</p>}

      {recording && status && (
        <section className="mt-6 grid gap-3">
          <div className="text-lg">
            Speed: <b>{speedKmh ?? "–"} km/h</b> · State: <b>{drivingState ?? "–"}</b>
          </div>
          {(Object.keys(SENSOR_LABEL) as SensorKey[]).map((k) => {
            const s = status[k];
            const live = s.lastEventAgoMs !== null && s.lastEventAgoMs < 3000 && s.hasValues;
            return (
              <div
                key={k}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-lg"
              >
                <span>
                  <span
                    className={`mr-2 inline-block h-4 w-4 rounded-full ${live ? "bg-emerald-500" : s.totalEvents ? "bg-amber-500" : "bg-zinc-500"}`}
                  />
                  {SENSOR_LABEL[k]}
                </span>
                <span className="tabular-nums">
                  {live
                    ? `${s.rateHz} Hz`
                    : s.totalEvents
                      ? s.hasValues
                        ? "stalled"
                        : "no values"
                      : "no data"}
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Saved recordings</h2>
        {uploadAvailable === false && (
          <p className="mt-1 text-sm text-muted-foreground">
            Upload is not set up on the server yet – use Download.
          </p>
        )}
        {logs.length === 0 && <p className="mt-2 text-sm text-muted-foreground">None yet.</p>}
        <ul className="mt-2 grid gap-3">
          {logs.map((log) => (
            <li key={log.id} className="rounded-xl border border-border p-4">
              <div className="font-medium">
                {new Date(log.startedAt).toLocaleString()} · {fmtDuration(log.durationMs)}
                {!log.endedAt && " (not stopped – recovered)"}
              </div>
              <div className="text-sm text-muted-foreground">
                GPS {log.summary.gps.avgRateHz} Hz · motion {log.summary.motion.avgRateHz} Hz ·
                orientation {log.summary.orientation.avgRateHz} Hz · max {log.summary.maxSpeedKmh}{" "}
                km/h
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-secondary px-4 py-2"
                  onClick={() => downloadLog(log)}
                >
                  Download JSON
                </button>
                {uploadAvailable && (
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
                    onClick={() => void upload(log)}
                  >
                    Upload
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-red-500"
                  onClick={() => {
                    if (window.confirm("Delete this recording?"))
                      void deleteDriveLog(log.id).then(refresh);
                  }}
                >
                  Delete
                </button>
              </div>
              {message[log.id] && <p className="mt-2 text-sm">{message[log.id]}</p>}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm">
        <Link to="/settings" className="underline underline-offset-4">
          Back to settings
        </Link>
      </p>
    </main>
  );
}
