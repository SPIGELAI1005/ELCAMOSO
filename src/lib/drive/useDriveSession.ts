import { useCallback, useEffect, useRef, useState } from "react";
import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import type { ProfileTuning } from "@/lib/drive/settings";

export type DriveStatus = "idle" | "starting" | "driving" | "error";

interface Options {
  profileId: string;
  volume: number;
  demoMotion: boolean;
  tuning?: ProfileTuning | undefined;
}

export function useDriveSession({ profileId, volume, demoMotion, tuning }: Options) {
  const tuningRef = useRef<ProfileTuning | undefined>(tuning);
  tuningRef.current = tuning;
  const [status, setStatus] = useState<DriveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DriveState>(IDLE_STATE);

  const engineRef = useRef<SoundEngine | null>(null);
  const stateRef = useRef<DriveState>(IDLE_STATE);
  const rawSpeed = useRef(0);
  const lastSpeed = useRef(0);
  const lastTick = useRef(0);
  const watchId = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const demoPhase = useRef(0);

  const profileRef = useRef(getProfile(profileId));
  profileRef.current = getProfile(profileId);

  const stop = useCallback(() => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    if (watchId.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    engineRef.current?.stop();
    engineRef.current = null;
    stateRef.current = IDLE_STATE;
    setState(IDLE_STATE);
    setStatus("idle");
  }, []);

  const loop = useCallback(() => {
    const now = performance.now();
    const dt = Math.min(0.5, Math.max(0.001, (now - lastTick.current) / 1000));
    lastTick.current = now;

    if (demoMotion) {
      demoPhase.current += dt * 0.16;
      const p = demoPhase.current;
      rawSpeed.current = Math.max(0, 16 + Math.sin(p) * 13 + Math.sin(p * 2.7) * 4);
    }

    const speed = rawSpeed.current;
    const acceleration = (speed - lastSpeed.current) / dt;
    lastSpeed.current = speed;

    const next = computeDriveState({
      speed,
      acceleration: Number.isFinite(acceleration) ? acceleration : 0,
      previous: stateRef.current,
      profile: profileRef.current,
      dt,
      tuning: tuningRef.current,
    });
    stateRef.current = next;
    engineRef.current?.update(next);
    setState(next);
    rafId.current = requestAnimationFrame(loop);
  }, [demoMotion]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");
    try {
      const engine = new SoundEngine();
      await engine.start(profileRef.current);
      engine.setVolume(volume);
      engineRef.current = engine;

      if (!demoMotion) {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          throw new Error("no-geo");
        }
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
              rawSpeed.current = Math.max(0, pos.coords.speed ?? 0);
              if (!settled) {
                settled = true;
                resolve();
              }
            },
            (err) => {
              if (!settled) {
                settled = true;
                reject(err);
              }
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
          );
        });
      }

      lastTick.current = performance.now();
      lastSpeed.current = 0;
      setStatus("driving");
      rafId.current = requestAnimationFrame(loop);
    } catch {
      engineRef.current?.stop();
      engineRef.current = null;
      setStatus("error");
      setError("Location unavailable");
    }
  }, [demoMotion, loop, volume]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setProfile(getProfile(profileId));
  }, [profileId]);

  useEffect(() => () => stop(), [stop]);

  return { status, error, state, start, stop };
}
