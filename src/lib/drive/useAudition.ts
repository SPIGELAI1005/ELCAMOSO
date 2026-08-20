import { useCallback, useEffect, useRef, useState } from "react";
import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import type { ProfileTuning } from "@/lib/drive/settings";

interface Options {
  profileId: string;
  volume: number;
  tuning?: ProfileTuning | undefined;
  profileGain?: number;
  /** change this to rebuild the voice while keeping the same profile id */
  refreshKey?: unknown;
}

/**
 * Audition mode: a motion simulator that drives the sound engine without any
 * sensors, so a profile can be previewed and tuned before a real drive.
 */
export function useAudition({
  profileId,
  volume,
  tuning,
  profileGain = 1,
  refreshKey,
}: Options) {
  const [active, setActive] = useState(false);
  const [state, setState] = useState<DriveState>(IDLE_STATE);
  const [targetKmh, setTargetKmh] = useState(60);
  const [meter, setMeter] = useState<{ peak: number; rms: number; headroom: number; reduction: number } | null>(
    null,
  );

  const engineRef = useRef<SoundEngine | null>(null);
  const stateRef = useRef<DriveState>(IDLE_STATE);
  const speedRef = useRef(0);
  const targetRef = useRef(60);
  const lastTick = useRef(0);
  const lastMeter = useRef(0);
  const rafId = useRef<number | null>(null);

  const profileRef = useRef(getProfile(profileId));
  profileRef.current = getProfile(profileId);
  const tuningRef = useRef<ProfileTuning | undefined>(tuning);
  tuningRef.current = tuning;

  const setTarget = useCallback((kmh: number) => {
    targetRef.current = kmh;
    setTargetKmh(kmh);
  }, []);

  const loop = useCallback(() => {
    const now = performance.now();
    const dt = Math.min(0.5, Math.max(0.001, (now - lastTick.current) / 1000));
    lastTick.current = now;

    const target = targetRef.current / 3.6;
    const rate = target > speedRef.current ? 2.6 : 3.4;
    const delta = target - speedRef.current;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
    const previousSpeed = speedRef.current;
    speedRef.current = Math.max(0, previousSpeed + step);
    const acceleration = (speedRef.current - previousSpeed) / dt;

    const next = computeDriveState({
      speed: speedRef.current,
      acceleration: Number.isFinite(acceleration) ? acceleration : 0,
      previous: stateRef.current,
      profile: profileRef.current,
      dt,
      tuning: tuningRef.current,
    });
    stateRef.current = next;
    engineRef.current?.update(next);
    setState(next);
    // Loudness readout is sampled a few times a second: enough for a meter,
    // cheap enough to sit inside the animation loop.
    if (now - lastMeter.current > 120) {
      lastMeter.current = now;
      setMeter(engineRef.current?.getMeter() ?? null);
    }
    rafId.current = requestAnimationFrame(loop);
  }, []);

  const stop = useCallback(() => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    void engineRef.current?.stop();
    engineRef.current = null;
    speedRef.current = 0;
    stateRef.current = IDLE_STATE;
    setState(IDLE_STATE);
    setMeter(null);
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    if (engineRef.current) return;
    const engine = new SoundEngine();
    await engine.start(profileRef.current, { signature: false });
    engine.setProfileGain(profileGain);
    engine.setVolume(volume);
    engineRef.current = engine;
    lastTick.current = performance.now();
    setActive(true);
    rafId.current = requestAnimationFrame(loop);
  }, [loop, profileGain, volume]);

  useEffect(() => {
    engineRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    engineRef.current?.setProfileGain(profileGain);
  }, [profileGain]);

  useEffect(() => {
    engineRef.current?.setProfile(getProfile(profileId), true);
  }, [profileId, refreshKey]);

  useEffect(() => () => stop(), [stop]);

  return { active, state, start, stop, targetKmh, setTarget, meter };
}
