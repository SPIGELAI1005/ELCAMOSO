import { useCallback, useEffect, useRef, useState } from "react";
import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import type { ProfileTuning } from "@/lib/drive/settings";
import type { LayerMix } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";

export interface DemoControls {
  /** 0..1 pedal demand */
  throttle: number;
  /** 0..1 extra acceleration bias */
  accel: number;
  /** 0..1 regeneration braking */
  regen: number;
}

interface Options {
  profileId: string;
  volume: number;
  profileGain: number;
  tuning?: ProfileTuning | undefined;
  /** driving environment id */
  environmentId?: string;
  /** per-layer mixer */
  mix?: LayerMix;
  /** custom audio snippets mapped to driving states */
  snippets?: SoundSnippet[];
}

export const DEMO_DEFAULTS: DemoControls = { throttle: 0.3, accel: 0.5, regen: 0 };

/**
 * Demo drive: a full simulated vehicle so sound behaviour can be previewed with
 * throttle, acceleration and regen even when no motion sensors are available.
 */
export function useDemoDrive({
  profileId,
  volume,
  profileGain,
  tuning,
  environmentId,
  mix,
  snippets,
}: Options) {
  const [active, setActive] = useState(false);
  const [state, setState] = useState<DriveState>(IDLE_STATE);
  const [controls, setControlsState] = useState<DemoControls>(DEMO_DEFAULTS);

  const engineRef = useRef<SoundEngine | null>(null);
  const stateRef = useRef<DriveState>(IDLE_STATE);
  const controlsRef = useRef<DemoControls>(DEMO_DEFAULTS);
  const speedRef = useRef(0);
  const lastTick = useRef(0);
  const rafId = useRef<number | null>(null);

  const profileRef = useRef(getProfile(profileId));
  profileRef.current = getProfile(profileId);
  const tuningRef = useRef<ProfileTuning | undefined>(tuning);
  tuningRef.current = tuning;
  const spaceRef = useRef({ environmentId, mix, snippets });
  spaceRef.current = { environmentId, mix, snippets };

  const setControls = useCallback((next: Partial<DemoControls>) => {
    controlsRef.current = { ...controlsRef.current, ...next };
    setControlsState(controlsRef.current);
  }, []);

  const reset = useCallback(() => {
    speedRef.current = 0;
    setControls(DEMO_DEFAULTS);
  }, [setControls]);

  const loop = useCallback(() => {
    const now = performance.now();
    const dt = Math.min(0.5, Math.max(0.001, (now - lastTick.current) / 1000));
    lastTick.current = now;

    const { throttle, accel, regen } = controlsRef.current;
    const drag = 0.02 * speedRef.current + 0.25;
    const push = throttle * (1.6 + accel * 4.4);
    const brake = regen * 4.2;
    const a = push - brake - (speedRef.current > 0 ? drag : 0);
    const previousSpeed = speedRef.current;
    speedRef.current = Math.max(0, Math.min(80, previousSpeed + a * dt));
    const acceleration = (speedRef.current - previousSpeed) / dt;

    const next = computeDriveState({
      speed: speedRef.current,
      acceleration: Number.isFinite(acceleration) ? acceleration : 0,
      previous: stateRef.current,
      profile: profileRef.current,
      dt,
      tuning: tuningRef.current,
    });
    // the operator's pedals win over the derived estimate in demo drive
    const blended: DriveState = {
      ...next,
      throttle: Math.max(next.throttle, throttle),
      regen: Math.max(next.regen, regen),
    };
    stateRef.current = blended;
    engineRef.current?.update(blended);
    setState(blended);
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
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    if (engineRef.current) return;
    const engine = new SoundEngine();
    await engine.start(profileRef.current, {
      environmentId: spaceRef.current.environmentId,
      mix: spaceRef.current.mix,
      snippets: spaceRef.current.snippets,
    });
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
    engineRef.current?.setProfile(getProfile(profileId));
  }, [profileId]);

  useEffect(() => {
    if (environmentId) engineRef.current?.setEnvironment(environmentId);
  }, [environmentId]);

  useEffect(() => {
    if (mix) engineRef.current?.setMix(mix);
  }, [mix]);

  useEffect(() => {
    if (snippets) void engineRef.current?.setSnippets(snippets);
  }, [snippets]);

  useEffect(() => () => stop(), [stop]);

  return { active, state, controls, setControls, reset, start, stop };
}
