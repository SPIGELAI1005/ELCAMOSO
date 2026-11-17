import { useCallback, useEffect, useRef, useState } from "react";

import { requestGeolocationPermission, requestMotionPermission, motionRequiresUserGesture, PHONE_GPS_WATCH_OPTIONS } from "@/lib/motion/phone-sensor-permissions";
import { keepScreenAwake, type KeepAwake } from "@/lib/phone-sync/wake-lock";
import { CadenceDetector } from "@/lib/rumoso/cadence";
import { RumosoDebugLog } from "@/lib/rumoso/debug-log";
import { EffortMapper, WARMUP_MS } from "@/lib/rumoso/effort";
import { PaceFilter, formatDistanceKm, formatDuration, formatPace } from "@/lib/rumoso/gps-pace";
import { publishRumosoMediaSession, setRumosoPlaybackState } from "@/lib/rumoso/media-session";
import { RUMOSO_MUSIC_PROFILES, RumosoMusicPlayer } from "@/lib/rumoso/music";
import {
  buildDemoRoute,
  buildDemoRun,
  cadenceForEffort,
  effortAtDemoTime,
  speedForEffort,
} from "@/lib/rumoso/simulate";
import { deleteRun, getRun, listRuns, newRunId, saveRun } from "@/lib/rumoso/store";
import {
  alongTrackAccel,
  averageCadence,
  averageEffort,
  averagePaceSecPerKm,
  currentPaceSecPerKm,
  effortZones,
  kmSplits,
  pathDistanceM,
  peakEffort,
} from "@/lib/rumoso/track";
import type { CoachMode, RunPhase, StoredRun, StoredRunSummary, TrackPoint } from "@/lib/rumoso/types";
import {
  COACH_LINES,
  VOICE_DUCK_ATTACK_S,
  VOICE_DUCK_GAIN,
  VOICE_DUCK_RELEASE_S,
  VOICE_DUCK_TAIL_S,
  applyCoachFire,
  createCoachState,
  evaluateCoach,
  type CoachLineId,
} from "@/lib/rumoso/voice";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { EffortGauge } from "./EffortGauge";
import { EffortBar, EffortLegend } from "./EffortLegend";
import { RumosoMap } from "./RumosoMap";
import { RunSummary } from "./RunSummary";
import { ReadyBackdrop } from "./ReadyBackdrop";
import { RumosoIcon, RumosoLockup, type RumosoUiIconName } from "./RumosoIcon";

export type RumosoDemoView = "ready" | "running" | "summary" | "diagnostics";


function initialDemoPoints(): TrackPoint[] {
  const now = Date.now();
  return buildDemoRoute({ durationMs: 12 * 60_000, distanceM: 2100, hz: 1 }).map((p, _, arr) => ({
    ...p,
    atMs: now - (arr[arr.length - 1]!.atMs - p.atMs),
  }));
}

export function RumosoApp({
  accessEmail,
  dev = false,
  demo,
}: {
  accessEmail: string;
  dev?: boolean;
  demo?: RumosoDemoView;
}) {
  const [phase, setPhase] = useState<RunPhase>(() =>
    demo === "summary" ? "summary" : demo === "running" || demo === "diagnostics" ? "running" : "ready",
  );
  const [points, setPoints] = useState<TrackPoint[]>(() =>
    demo === "running" || demo === "diagnostics" ? initialDemoPoints() : [],
  );
  const [effort, setEffort] = useState(() => points[points.length - 1]?.effort ?? 0);
  const [cadence, setCadence] = useState(() => points[points.length - 1]?.cadenceSpm ?? 0);
  const [paceSec, setPaceSec] = useState<number | null>(() => currentPaceSecPerKm(points));
  const [speedMps, setSpeedMps] = useState(() => points[points.length - 1]?.speedMps ?? 0);
  const [distanceM, setDistanceM] = useState(() => pathDistanceM(points));
  const [elapsedMs, setElapsedMs] = useState(
    demo === "running" || demo === "diagnostics" ? 12 * 60_000 : 0,
  );
  const [musicId, setMusicId] = useState(RUMOSO_MUSIC_PROFILES[0]!.id);
  const [coachMode, setCoachMode] = useState<CoachMode>("hype");
  const [wakeOn, setWakeOn] = useState(true);
  const [warmupOn, setWarmupOn] = useState(false);
  const [warmupLeftMs, setWarmupLeftMs] = useState(0);
  const [diagnostics, setDiagnostics] = useState(demo === "diagnostics");
  const [diagTick, setDiagTick] = useState(0);
  const [simulateOn, setSimulateOn] = useState(Boolean(demo && demo !== "ready"));
  const [simulateEffort, setSimulateEffort] = useState(54);
  const [autoRamp, setAutoRamp] = useState(false);
  const [lastCue, setLastCue] = useState<string | null>(null);
  const [voiceFallback, setVoiceFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wakeMode, setWakeMode] = useState<string>("off");
  const [recent, setRecent] = useState<StoredRunSummary[]>([]);
  const [summary, setSummary] = useState<StoredRun | null>(() => (demo === "summary" ? buildDemoRun() : null));
  const [motionReady, setMotionReady] = useState(!motionRequiresUserGesture());

  const cadenceDet = useRef(new CadenceDetector());
  const paceFilt = useRef(new PaceFilter());
  const effortMap = useRef(new EffortMapper());
  const music = useRef(new RumosoMusicPlayer());
  const log = useRef(new RumosoDebugLog());
  const ctxRef = useRef<AudioContext | null>(null);
  const voiceBuf = useRef<Map<CoachLineId, AudioBuffer>>(new Map());
  const wakeRef = useRef<KeepAwake | null>(null);
  const watchRef = useRef<number | null>(null);
  const releaseMedia = useRef<(() => void) | null>(null);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const startedAtRef = useRef(
    demo === "running" || demo === "diagnostics" ? Date.now() - 12 * 60_000 : 0,
  );
  const pausedAccumRef = useRef(0);
  const pauseStartedRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastEffortRef = useRef(0);
  const lastSpeedRef = useRef<number | null>(null);
  const pointsRef = useRef<TrackPoint[]>([]);
  const coachModeRef = useRef(coachMode);
  const simulateRef = useRef(simulateOn);
  const simulateEffortRef = useRef(simulateEffort);
  const autoRampRef = useRef(autoRamp);
  const autoRampStartedRef = useRef(0);
  const duckTimer = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const cadenceRef = useRef(0);

  coachModeRef.current = coachMode;
  simulateRef.current = simulateOn;
  simulateEffortRef.current = simulateEffort;
  autoRampRef.current = autoRamp;
  pointsRef.current = points;
  runningRef.current = phase === "running" || phase === "warming";
  pausedRef.current = phase === "paused";

  useEffect(() => {
    void listRuns().then(setRecent);
  }, []);

  const refreshDiag = useCallback(() => setDiagTick((n) => n + 1), []);

  const stopSensors = useCallback(() => {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    window.removeEventListener("devicemotion", onMotion as EventListener);
  }, []);

  const teardown = useCallback(async () => {
    runningRef.current = false;
    stopSensors();
    wakeRef.current?.release();
    wakeRef.current = null;
    releaseMedia.current?.();
    releaseMedia.current = null;
    setRumosoPlaybackState("none");
    await music.current.stop();
    if (duckTimer.current) window.clearTimeout(duckTimer.current);
  }, [stopSensors]);

  useEffect(() => () => void teardown(), [teardown]);

  useEffect(() => {
    const onVis = () => {
      log.current.onVisibility(document.visibilityState);
      if (ctxRef.current) log.current.onAudio(ctxRef.current.state);
      refreshDiag();
    };
    document.addEventListener("visibilitychange", onVis);
    log.current.onVisibility(document.visibilityState);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshDiag]);

  function onMotion(ev: DeviceMotionEvent) {
    log.current.onMotion();
    const lin = ev.acceleration;
    const grav = ev.accelerationIncludingGravity;
    const tMs = ev.timeStamp || performance.now();
    if (lin && lin.x != null && lin.y != null && lin.z != null) {
      const r = cadenceDet.current.push({ tMs, ax: lin.x, ay: lin.y, az: lin.z, linear: true });
      cadenceRef.current = r.smoothedSpm;
      setCadence(r.smoothedSpm);
    } else if (grav && grav.x != null && grav.y != null && grav.z != null) {
      const r = cadenceDet.current.push({ tMs, ax: grav.x, ay: grav.y, az: grav.z, linear: false });
      cadenceRef.current = r.smoothedSpm;
      setCadence(r.smoothedSpm);
    }
  }

  const appendGps = useCallback((fix: TrackPoint) => {
    if (!runningRef.current || pausedRef.current) return;
    setPoints((prev) => {
      const next = prev.concat(fix);
      pointsRef.current = next;
      setDistanceM(pathDistanceM(next));
      setPaceSec(currentPaceSecPerKm(next) ?? formatPaceValue(fix));
      return next;
    });
  }, []);

  const playCue = useCallback(async (line: CoachLineId, text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    setLastCue(text);
    const ctx = ctxRef.current;
    music.current.setDuck(true, VOICE_DUCK_ATTACK_S, VOICE_DUCK_RELEASE_S, VOICE_DUCK_GAIN);
    const unduck = () => {
      window.setTimeout(() => {
        music.current.setDuck(false, VOICE_DUCK_ATTACK_S, VOICE_DUCK_RELEASE_S, VOICE_DUCK_GAIN);
        speakingRef.current = false;
      }, VOICE_DUCK_TAIL_S * 1000);
    };
    const buf = voiceBuf.current.get(line);
    if (ctx && buf) {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = 1;
      src.buffer = buf;
      src.connect(g);
      g.connect(ctx.destination);
      src.onended = unduck;
      src.start();
      return;
    }
    if (typeof speechSynthesis !== "undefined") {
      setVoiceFallback(true);
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.onend = unduck;
      u.onerror = unduck;
      speechSynthesis.speak(u);
      return;
    }
    unduck();
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    const now = Date.now();
    const dt = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0.2;
    lastTickRef.current = now;
    if (pausedRef.current) return;

    const elapsed = now - startedAtRef.current - pausedAccumRef.current;
    setElapsedMs(elapsed);

    let nextEffort: number;
    let cad = cadenceRef.current;
    let spd = lastSpeedRef.current ?? 0;

    if (simulateRef.current) {
      if (autoRampRef.current) {
        const t = (now - autoRampStartedRef.current) / 1000;
        nextEffort = effortAtDemoTime(t);
        setSimulateEffort(nextEffort);
        simulateEffortRef.current = nextEffort;
      } else {
        nextEffort = simulateEffortRef.current;
      }
      cad = cadenceForEffort(nextEffort);
      cadenceRef.current = cad;
      spd = speedForEffort(nextEffort);
      setCadence(cad);
      setSpeedMps(spd);
      setPaceSec(spd > 0.4 ? 1000 / spd : null);
      // Advance a simulated point along a local loop.
      const origin = pointsRef.current[0] ?? {
        lat: 48.1645,
        lon: 11.5913,
        atMs: now,
        effort: nextEffort,
        cadenceSpm: cad,
        speedMps: spd,
        source: "simulate" as const,
      };
      const elapsedS = elapsed / 1000;
      const mPerDegLat = 111_320;
      const mPerDegLon = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
      const dist = spd * elapsedS;
      const ang = dist / 180;
      const fix: TrackPoint = {
        lat: origin.lat + (Math.sin(ang) * 180) / mPerDegLat,
        lon: origin.lon + ((1 - Math.cos(ang)) * 180) / mPerDegLon,
        atMs: now,
        effort: nextEffort,
        cadenceSpm: cad,
        speedMps: spd,
        source: "simulate",
      };
      if (
        !pointsRef.current.length ||
        now - pointsRef.current[pointsRef.current.length - 1]!.atMs >= 900
      ) {
        appendGps(fix);
      }
      lastSpeedRef.current = spd;
      setEffort(nextEffort);
    } else {
      const accel = alongTrackAccel(lastSpeedRef.current, spd, dt);
      nextEffort = effortMap.current.update(
        {
          cadenceSpm: cad || null,
          speedMps: spd || null,
          accelMps2: accel,
        },
        dt,
      );
      if (effortMap.current.warmingUp) {
        const left = effortMap.current.pushWarmup(now, {
          cadenceSpm: cad || null,
          speedMps: spd || null,
          accelMps2: accel,
        });
        setWarmupLeftMs(left);
        if (left === 0) setPhase("running");
      }
      setEffort(nextEffort);
    }

    const dEffort = dt > 0 ? (nextEffort - lastEffortRef.current) / dt : 0;
    lastEffortRef.current = nextEffort;
    music.current.setEffort(nextEffort, dEffort);
    if (ctxRef.current) log.current.onAudio(ctxRef.current.state);

    const coach = coachStateRef.current;
    if (coach) {
      coach.mode = coachModeRef.current;
      const trig = evaluateCoach(coach, { nowMs: now, effort: nextEffort });
      if (trig) {
        applyCoachFire(coach, trig, now);
        void playCue(trig.line, trig.text);
        log.current.note(`coach:${trig.reason}`, { line: trig.line });
      }
    }
    refreshDiag();
  }, [appendGps, playCue, refreshDiag]);

  const tickRef = useRef(tick);
  tickRef.current = tick;

  const coachStateRef = useRef(createCoachState(coachMode, Date.now()));

  const startRun = useCallback(async () => {
    setError(null);
    cadenceDet.current.reset();
    paceFilt.current.reset();
    effortMap.current.reset();
    setPoints([]);
    pointsRef.current = [];
    setDistanceM(0);
    setElapsedMs(0);
    setLastCue(null);
    pausedAccumRef.current = 0;
    lastTickRef.current = 0;
    lastSpeedRef.current = null;

    const motionOk = await requestMotionPermission();
    setMotionReady(motionOk || !motionRequiresUserGesture());
    log.current.permission("motion", { ok: motionOk });
    const gpsOk = await requestGeolocationPermission();
    log.current.permission("geolocation", { ok: gpsOk });

    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new AC();
    ctxRef.current = ctx;
    await ctx.resume().catch(() => undefined);
    log.current.onAudio(ctx.state);

    try {
      await music.current.start(ctx, musicId);
      music.current.setEffort(simulateOn ? simulateEffort : 20, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Music failed to start");
      log.current.note("music-failed");
    }

    voiceBuf.current.clear();
    let loaded = 0;
    await Promise.all(
      COACH_LINES.map(async (line) => {
        try {
          const res = await fetch(line.src);
          if (!res.ok) return;
          const buf = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0));
          voiceBuf.current.set(line.id, buf);
          loaded += 1;
        } catch {
          /* fallback later */
        }
      }),
    );
    if (loaded === 0) setVoiceFallback(true);

    if (wakeOn) {
      const lock = await keepScreenAwake();
      wakeRef.current = lock;
      setWakeMode(lock.mode);
      log.current.note("wakelock", { mode: lock.mode });
    }

    releaseMedia.current = publishRumosoMediaSession({
      onPause: () => setPhase("paused"),
      onPlay: () => setPhase("running"),
      onStop: () => void finishRunRef.current?.(),
    });
    setRumosoPlaybackState("playing");

    window.addEventListener("devicemotion", onMotion as EventListener);
    if (gpsOk && navigator.geolocation && !simulateOn) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          log.current.onGps(now, { accuracy: pos.coords.accuracy, speed: pos.coords.speed });
          const reading = paceFilt.current.update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            atMs: now,
            reportedSpeed: pos.coords.speed,
            accuracyM: pos.coords.accuracy,
          });
          lastSpeedRef.current = reading.speedMps;
          setSpeedMps(reading.speedMps);
          setPaceSec(reading.paceSecPerKm);
          if (!runningRef.current || pausedRef.current) return;
          appendGps({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            atMs: now,
            effort: lastEffortRef.current,
            cadenceSpm: cadenceRef.current || null,
            speedMps: reading.speedMps,
            accuracyM: reading.accuracyM,
            source: reading.source === "none" ? "delta" : reading.source,
          });
        },
        (err) => log.current.note("gps-error", { message: err.message, code: err.code }),
        { ...PHONE_GPS_WATCH_OPTIONS, maximumAge: 1000, timeout: 15_000 },
      );
    }

    const now = Date.now();
    startedAtRef.current = now;
    coachStateRef.current = createCoachState(coachModeRef.current, now);
    if (warmupOn && !simulateOn) {
      effortMap.current.startWarmup(now);
      setWarmupLeftMs(WARMUP_MS);
      setPhase("warming");
    } else {
      setPhase("running");
    }
    if (autoRamp) autoRampStartedRef.current = now;
    runningRef.current = true;
    pausedRef.current = false;
  }, [appendGps, autoRamp, musicId, simulateEffort, simulateOn, wakeOn, warmupOn]);

  const finishRun = useCallback(async () => {
    const now = Date.now();
    const durationMs = Math.max(0, now - startedAtRef.current - pausedAccumRef.current);
    const pts = pointsRef.current;
    const distance = pathDistanceM(pts);
    const run: StoredRun = {
      id: newRunId(),
      startedAt: new Date(startedAtRef.current).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationMs,
      movingMs: durationMs,
      distanceM: distance,
      avgPaceSecPerKm: averagePaceSecPerKm(distance, durationMs),
      avgEffort: averageEffort(pts),
      peakEffort: peakEffort(pts),
      avgCadenceSpm: averageCadence(pts),
      musicProfileId: musicId,
      coachMode: coachModeRef.current,
      points: pts,
      splits: kmSplits(pts),
      zones: effortZones(pts),
    };
    await teardown();
    if (pts.length >= 2) {
      await saveRun(run);
      setRecent(await listRuns());
      setSummary(run);
      setPhase("summary");
    } else {
      setPhase("ready");
      setSummary(null);
    }
  }, [musicId, teardown]);

  const finishRunRef = useRef(finishRun);
  finishRunRef.current = finishRun;

  useEffect(() => {
    if (demo) return;
    if (phase !== "running" && phase !== "warming") return;
    const id = window.setInterval(() => tickRef.current(), 200);
    return () => window.clearInterval(id);
  }, [phase, demo]);

  useEffect(() => {
    if (phase === "paused") {
      pauseStartedRef.current = Date.now();
      setRumosoPlaybackState("paused");
      music.current.setMaster(0);
    } else if (phase === "running") {
      if (pauseStartedRef.current) {
        pausedAccumRef.current += Date.now() - pauseStartedRef.current;
        pauseStartedRef.current = 0;
      }
      setRumosoPlaybackState("playing");
      music.current.setMaster(0.9);
    }
  }, [phase]);

  const onPauseToggle = () => {
    if (phase === "paused") setPhase("running");
    else if (phase === "running" || phase === "warming") setPhase("paused");
  };

  const onReset = () => {
    void teardown();
    setPhase("ready");
    setSummary(null);
    setPoints([]);
    setDistanceM(0);
    setElapsedMs(0);
    setEffort(0);
    setDiagnostics(false);
    setAutoRamp(false);
  };

  const live = phase === "running" || phase === "warming" || phase === "paused";

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground" data-testid="rumoso-app">
      <header className="relative z-[2] flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <h1 className="m-0 min-w-0">
          <RumosoLockup className="h-9 w-auto max-w-[min(100%,13.5rem)]" />
        </h1>
        <button
          type="button"
          onClick={() => setDiagnostics((v) => !v)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] tracking-[0.18em] uppercase ${
            diagnostics ? "border-foreground bg-foreground text-background" : "border-white/15 text-muted-foreground"
          }`}
          data-testid="rumoso-diagnostics-toggle"
        >
          <RumosoIcon name="diagnostics" className="size-3.5" />
          Diagnostics
        </button>
      </header>

      {phase === "summary" && summary ? (
        <RunSummary
          run={summary}
          onDone={onReset}
          onDelete={async () => {
            await deleteRun(summary.id);
            setRecent(await listRuns());
            onReset();
          }}
        />
      ) : (
        <>
          <div className="rumoso-map-hud relative min-h-[46vh] flex-1">
            <RumosoMap
              points={points}
              follow={live && !diagnostics && points.length < 8}
              fitRoute={points.length >= 8}
              className="size-full"
            />
            {phase === "ready" ? <ReadyBackdrop /> : null}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
              <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
                <p className="font-mono text-3xl font-light tabular-nums leading-none">
                  {formatDuration(elapsedMs)}
                </p>
                <p className="mt-1 text-[9px] tracking-[0.2em] text-muted-foreground uppercase">Time</p>
              </div>
              <EffortLegend compact />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 grid grid-cols-4 items-stretch gap-1.5 p-3">
              <LiveStat icon="distance" label="Distance" value={`${formatDistanceKm(distanceM)}`} unit="km" />
              <LiveStat icon="pace" label="Pace" value={formatPace(paceSec)} />
              <LiveStat icon="cadence" label="Cadence" value={cadence > 0 ? `${Math.round(cadence)}` : "—"} unit="spm" />
              <div className="flex items-center justify-center rounded-xl border border-white/10 bg-black/55 px-1 py-1 backdrop-blur-md">
                <EffortGauge effort={effort} compact />
              </div>
            </div>
          </div>

          {phase === "warming" ? (
            <p className="px-5 py-2 text-center text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Warm-up walk · {Math.ceil(warmupLeftMs / 1000)}s
            </p>
          ) : null}
          {lastCue ? (
            <p className="px-5 text-center text-sm text-foreground/80">“{lastCue}”</p>
          ) : null}
          {error ? <p className="px-5 text-center text-sm text-[#e53935]">{error}</p> : null}

          <div className="space-y-3 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {live ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onPauseToggle}
                  className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 text-sm tracking-[0.2em] uppercase"
                  data-testid="rumoso-pause"
                >
                  <RumosoIcon name={phase === "paused" ? "run-start" : "pause"} className="size-4" />
                  {phase === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={() => void finishRun()}
                  className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-sm tracking-[0.2em] text-background uppercase"
                  data-testid="rumoso-stop"
                >
                  <RumosoIcon name="stop" className="size-4" />
                  Stop
                </button>
              </div>
            ) : (
              <>
                <ReadySettings
                  musicId={musicId}
                  onMusic={setMusicId}
                  coachMode={coachMode}
                  onCoach={setCoachMode}
                  wakeOn={wakeOn}
                  onWake={setWakeOn}
                  warmupOn={warmupOn}
                  onWarmup={setWarmupOn}
                  motionNeedsGesture={motionRequiresUserGesture() && !motionReady}
                  onMotion={() =>
                    void requestMotionPermission().then((ok) => {
                      setMotionReady(ok);
                      log.current.permission("motion", { ok });
                    })
                  }
                  wakeMode={wakeMode}
                  voiceFallback={voiceFallback}
                />
                <button
                  type="button"
                  onClick={() => void startRun()}
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm tracking-[0.22em] text-background uppercase"
                  data-testid="rumoso-start"
                >
                  <RumosoIcon name="run-start" className="size-4" />
                  Start run
                </button>
                {recent.length > 0 ? (
                  <RecentRuns
                    runs={recent}
                    onOpen={async (id) => {
                      const run = await getRun(id);
                      if (run) {
                        setSummary(run);
                        setPhase("summary");
                      }
                    }}
                  />
                ) : null}
              </>
            )}

            {(dev || simulateOn || live) && !demo && (
              <SimulatePanel
                on={simulateOn}
                setOn={setSimulateOn}
                effort={simulateEffort}
                setEffort={(v) => {
                  setSimulateEffort(v);
                  simulateEffortRef.current = v;
                }}
                autoRamp={autoRamp}
                setAutoRamp={(v) => {
                  setAutoRamp(v);
                  autoRampRef.current = v;
                  if (v) autoRampStartedRef.current = Date.now();
                }}
                disabled={phase === "summary"}
              />
            )}

            {diagnostics ? <DiagnosticsPanel log={log.current} ticks={diagTick} /> : null}

            {formatPrivateTestFooter(accessEmail, dev) || voiceFallback ? (
              <p className="text-center text-[10px] text-muted-foreground">
                {[formatPrivateTestFooter(accessEmail, dev), voiceFallback ? "coach falling back to speechSynthesis" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function formatPaceValue(fix: TrackPoint): number | null {
  return fix.speedMps != null && fix.speedMps > 0.4 ? 1000 / fix.speedMps : null;
}

function LiveStat({
  icon,
  label,
  value,
  unit,
}: {
  icon: RumosoUiIconName;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center rounded-xl border border-white/10 bg-black/55 px-2 py-1.5 backdrop-blur-md">
      <p className="font-mono text-base font-light tabular-nums leading-none">
        {value}
        {unit ? <span className="ml-0.5 text-[9px] text-muted-foreground">{unit}</span> : null}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[8px] tracking-[0.18em] text-muted-foreground uppercase">
        <RumosoIcon name={icon} className="size-2.5" />
        {label}
      </p>
    </div>
  );
}

/** Dev may show dev@localhost. Production shows the signed-in admin email, or nothing — never the dev placeholder. */
export function formatPrivateTestFooter(email: string, dev: boolean): string | null {
  const value = email.trim();
  const isDevPlaceholder = !value || /^dev@localhost$/i.test(value);
  if (dev) return `Private test · ${value || "dev@localhost"}`;
  if (isDevPlaceholder) return "Private test";
  return `Private test · ${value}`;
}

function ReadySettings(props: {
  musicId: string;
  onMusic: (id: string) => void;
  coachMode: CoachMode;
  onCoach: (m: CoachMode) => void;
  wakeOn: boolean;
  onWake: (v: boolean) => void;
  warmupOn: boolean;
  onWarmup: (v: boolean) => void;
  motionNeedsGesture: boolean;
  onMotion: () => void;
  wakeMode: string;
  voiceFallback: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          <RumosoIcon name="music-profile" className="size-3.5" />
          Music
        </p>
        <div className="flex gap-2">
          {RUMOSO_MUSIC_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => props.onMusic(p.id)}
              className={`flex-1 rounded-2xl border px-3 py-2.5 text-left ${
                p.id === props.musicId ? "border-foreground bg-white/10" : "border-white/10"
              }`}
            >
              <span className="block text-sm">{p.name}</span>
              <span className="block text-[11px] text-muted-foreground">{p.tagline}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          <RumosoIcon name="coach-voice" className="size-3.5" />
          Coach
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["calm", "hype", "off"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => props.onCoach(m)}
              className={`h-10 rounded-full border text-[11px] tracking-[0.18em] uppercase ${
                props.coachMode === m ? "border-foreground bg-foreground text-background" : "border-white/15 text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <TogglePill label="Wake lock" on={props.wakeOn} onToggle={props.onWake} />
        <TogglePill label="60s warm-up" on={props.warmupOn} onToggle={props.onWarmup} />
        {props.motionNeedsGesture ? (
          <button
            type="button"
            onClick={props.onMotion}
            className="h-9 rounded-full border border-white/15 px-3 text-[11px] tracking-[0.16em] uppercase"
          >
            Allow motion
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TogglePill({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      className={`h-9 rounded-full border px-3 text-[11px] tracking-[0.16em] uppercase ${
        on ? "border-foreground bg-white/10" : "border-white/15 text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function SimulatePanel(props: {
  on: boolean;
  setOn: (v: boolean) => void;
  effort: number;
  setEffort: (v: number) => void;
  autoRamp: boolean;
  setAutoRamp: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3" data-testid="rumoso-simulate">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Simulate run</p>
        <TogglePill label={props.on ? "On" : "Off"} on={props.on} onToggle={props.setOn} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={props.effort}
        disabled={!props.on || props.disabled}
        onChange={(e) => {
          props.setAutoRamp(false);
          props.setEffort(Number(e.target.value));
        }}
        className="w-full accent-white"
        aria-label="Simulated effort"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Effort {Math.round(props.effort)} · {colorLabel(props.effort)}
        </span>
        <button
          type="button"
          disabled={!props.on}
          onClick={() => props.setAutoRamp(!props.autoRamp)}
          className="tracking-[0.16em] uppercase"
        >
          {props.autoRamp ? "Stop ramp" : "Auto-ramp"}
        </button>
      </div>
      <EffortBar effort={props.effort} />
    </section>
  );
}

function colorLabel(effort: number): string {
  if (effort >= 80) return "Hard";
  if (effort >= 65) return "Push";
  if (effort >= 45) return "Steady";
  if (effort >= 25) return "Easy";
  return "Walk";
}

function RecentRuns({
  runs,
  onOpen,
}: {
  runs: StoredRunSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Recent runs</p>
      <ul className="space-y-1.5">
        {runs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm"
            >
              <span>{new Date(r.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatDistanceKm(r.distanceM)} km · {formatPace(r.avgPaceSecPerKm)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
