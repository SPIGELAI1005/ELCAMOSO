import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CALIBRATION_SCENARIOS,
  CalibrationRecorder,
  compareCalibrationTraces,
  computeCalibrationMetrics,
  downloadCalibrationTrace,
  driveStateFromCalibrationSample,
  extractShiftEvents,
  listStoredCalibrationTraces,
  listSubjectiveNotes,
  parseCalibrationTrace,
  PROBLEM_MARKER_LABELS,
  replayCalibrationTrace,
  runCalibrationScenario,
  saveCalibrationTraceLocally,
  saveSubjectiveNote,
  type CalibrationSubjectiveNote,
  type CalibrationTrace,
} from "@/lib/calibration";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { SoundEngine } from "@/lib/sound/engine";
import type { RealismEngineMode } from "@/lib/sound/realism/v2";
import { getProfile, SOUND_PROFILES } from "@/lib/sound/profiles";
import { isCombustionRealismV2Profile } from "@/lib/sound/realism/v2";

export const Route = createFileRoute("/debug/calibration")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  component: DebugCalibrationLab,
  head: () => ({
    meta: [{ title: "Calibration Lab · ELCAMOSO Debug" }],
  }),
});

type LabMode = "lab" | "road";

function DebugCalibrationLab() {
  const [labMode, setLabMode] = useState<LabMode>("lab");
  const [trace, setTrace] = useState<CalibrationTrace | null>(null);
  const [replayTrace, setReplayTrace] = useState<CalibrationTrace | null>(null);
  const [scenarioId, setScenarioId] = useState(CALIBRATION_SCENARIOS[0]!.id);
  const [profileId, setProfileId] = useState("gt-v8");
  const [realismEngine, setRealismEngine] = useState<RealismEngineMode>("v2");
  const [dynamicDrive, setDynamicDrive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [cursorMs, setCursorMs] = useState(0);
  const [selectedShiftIdx, setSelectedShiftIdx] = useState<number | null>(null);
  const [stored, setStored] = useState(() => listStoredCalibrationTraces());
  const [roadRecording, setRoadRecording] = useState(false);
  const [roadMarkers, setRoadMarkers] = useState<
    { id: string; tMs: number; label: string; note: string }[]
  >([]);
  const [compareBefore, setCompareBefore] = useState<CalibrationTrace | null>(null);

  const engineRef = useRef<SoundEngine | null>(null);
  const recorderRef = useRef<CalibrationRecorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const playIndexRef = useRef(0);
  const lastTickRef = useRef(0);
  const snap = useSessionStore();

  const active = replayTrace ?? trace;
  const metrics = useMemo(() => (active ? computeCalibrationMetrics(active) : null), [active]);
  const shifts = useMemo(() => (active ? extractShiftEvents(active.samples) : []), [active]);
  const comparison = useMemo(() => {
    if (!compareBefore || !active) return null;
    return compareCalibrationTraces(compareBefore, active);
  }, [compareBefore, active]);

  const stopAudio = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    setPaused(false);
    void engineRef.current?.stop();
    engineRef.current = null;
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const loadScenario = () => {
    const def = CALIBRATION_SCENARIOS.find((s) => s.id === scenarioId)!;
    const t = runCalibrationScenario(def);
    setTrace(t);
    setReplayTrace(null);
    setCursorMs(0);
    setSelectedShiftIdx(null);
    saveCalibrationTraceLocally(t);
    setStored(listStoredCalibrationTraces());
  };

  const runReplay = () => {
    if (!trace) return;
    const result = replayCalibrationTrace(trace, {
      profileId,
      audioSeed: 42,
      resimulatePowertrain: true,
    });
    setReplayTrace(result.output);
    setCursorMs(0);
  };

  const pausedRef = useRef(false);
  const rateRef = useRef(rate);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  const startPlayback = async () => {
    if (!active?.samples.length) return;
    stopAudio();
    const engine = new SoundEngine();
    engine.setSynthesisMode("improved");
    engine.setDynamicDriveEnabled(dynamicDrive);
    engine.setRealismEngine(isCombustionRealismV2Profile(profileId) ? realismEngine : "current");
    await engine.start(getProfile(profileId), { signature: false, seed: 42 });
    // Approximate loudness match between Current and V2 for A/B listening.
    engine.setVolume(realismEngine === "v2" ? 0.48 : 0.52);
    engineRef.current = engine;
    playIndexRef.current = Math.max(
      0,
      active.samples.findIndex((s) => s.tMs >= cursorMs),
    );
    lastTickRef.current = performance.now();
    setPlaying(true);
    setPaused(false);
    pausedRef.current = false;

    let prev: DriveState = IDLE_STATE;
    const samples = active.samples;
    const tick = () => {
      const eng = engineRef.current;
      if (!eng || !samples.length) return;
      if (pausedRef.current) {
        lastTickRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const now = performance.now();
      const elapsed = (now - lastTickRef.current) * rateRef.current;
      lastTickRef.current = now;
      const cur = samples[playIndexRef.current];
      if (!cur) {
        stopAudio();
        return;
      }
      const targetT = cur.tMs + elapsed;
      while (
        playIndexRef.current < samples.length - 1 &&
        samples[playIndexRef.current + 1]!.tMs <= targetT
      ) {
        playIndexRef.current += 1;
      }
      const sample = samples[playIndexRef.current]!;
      const state = driveStateFromCalibrationSample(sample, prev);
      prev = state;
      eng.update(state);
      setCursorMs(sample.tMs);
      if (playIndexRef.current >= samples.length - 1) {
        stopAudio();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  /** Switch Current ↔ V2 without restarting motion cursor. */
  const switchRealismLive = (mode: RealismEngineMode) => {
    setRealismEngine(mode);
    const eng = engineRef.current;
    if (eng && playing) {
      eng.setRealismEngine(isCombustionRealismV2Profile(profileId) ? mode : "current");
      eng.setVolume(mode === "v2" ? 0.48 : 0.52);
    }
  };

  const switchDynamicLive = (enabled: boolean) => {
    setDynamicDrive(enabled);
    const eng = engineRef.current;
    if (eng && playing) eng.setDynamicDriveEnabled(enabled);
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCalibrationTrace(JSON.parse(text));
    setTrace(parsed);
    setReplayTrace(null);
    saveCalibrationTraceLocally(parsed);
    setStored(listStoredCalibrationTraces());
  };

  /* ---------- Tesla road-test mode ---------- */
  const startRoadRecording = () => {
    const rec = new CalibrationRecorder(50);
    recorderRef.current = rec;
    rec.start({
      profileId: snap.profileId || profileId,
      personalityId: null,
      realismEngine,
      dynamicDrive: true,
      synthesisMode: "improved",
      label: "Tesla road calibration",
      origin: "road",
    });
    setRoadRecording(true);
    setRoadMarkers([]);
    getSession().setDebugDriveDiagnostics(true);
  };

  const markProblem = () => {
    const m = recorderRef.current?.markProblem();
    if (m) setRoadMarkers((prev) => [...prev, m]);
  };

  const stopRoadRecording = () => {
    const finished = recorderRef.current?.stop() ?? null;
    setRoadRecording(false);
    if (finished) {
      // Attach empty markers already present
      setTrace(finished);
      setReplayTrace(null);
      saveCalibrationTraceLocally(finished);
      setStored(listStoredCalibrationTraces());
      setRoadMarkers(finished.markers);
    }
    recorderRef.current = null;
  };

  // Poll session while road recording — buffered recorder throttles writes (no JSON in hot path).
  useEffect(() => {
    if (!roadRecording) return;
    const id = window.setInterval(() => {
      const s = getSession().snapshot();
      if (s.kind !== "drive" || s.status !== "running" || !s.state || !recorderRef.current) return;
      const session = getSession();
      const diag = session.getDriveDiagnostics();
      const fusion = diag.fusion;
      const motion = {
        timestamp: performance.now(),
        speedKmh: fusion.speedKmh || s.state.speed * 3.6,
        accelerationMs2: diag.motion.accelerationRawMs2 || s.state.acceleration,
        accelerationFiltered: fusion.accelerationMs2 || s.state.acceleration,
        decelerationMs2: Math.max(0, -(fusion.accelerationMs2 || s.state.acceleration)),
        inferredThrottle: s.state.powertrain?.driverDemand ?? s.state.throttle,
        motionConfidence: fusion.confidence || 0.85,
        primarySource: (fusion.primarySource || "tesla-browser") as
          "tesla-browser" | "phone" | "vehicle-telemetry" | "simulator",
        sourceHealth: { phone: false, browser: true, vehicleTelemetry: false },
        fallbackTier: (fusion.fallbackTier || "browser") as
          "vehicle-telemetry" | "phone" | "browser" | "hold" | "decay",
        transitioning: fusion.transitioning ?? false,
      };
      recorderRef.current.tick(motion, s.state, {
        braking: diag.powertrain.braking ?? s.state.regen,
      });
    }, 50);
    return () => clearInterval(id);
  }, [roadRecording]);

  const saveRating = (partial: Partial<CalibrationSubjectiveNote>) => {
    if (!active) return;
    const note: CalibrationSubjectiveNote = {
      id: `note-${Date.now().toString(36)}`,
      traceId: active.id,
      at: Date.now(),
      realismEngine,
      mechanicalVsElectronic: null,
      shiftFeel: null,
      loadResponse: null,
      fatigue: null,
      freeText: "",
      ...partial,
    };
    saveSubjectiveNote(note);
  };

  const sampleAtCursor = active?.samples.find((s) => s.tMs >= cursorMs) ?? active?.samples[0];
  const selectedShift = selectedShiftIdx != null ? shifts[selectedShiftIdx] : null;

  if (labMode === "road") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-6 py-10">
        <div>
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Dev · Tesla road test
          </p>
          <h1 className="mt-2 text-3xl font-light">Calibration recording</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Passenger or parked use only. Do not interact while driving. Start a Drive session
            first, then record here.
          </p>
          <button
            type="button"
            className="mt-4 text-[11px] tracking-[0.2em] uppercase text-muted-foreground underline"
            onClick={() => setLabMode("lab")}
          >
            Back to lab
          </button>
        </div>

        <button
          type="button"
          disabled={roadRecording}
          onClick={startRoadRecording}
          className="h-24 rounded-2xl border border-border bg-secondary text-lg tracking-wide uppercase disabled:opacity-40"
        >
          Start calibration recording
        </button>
        <button
          type="button"
          disabled={!roadRecording}
          onClick={markProblem}
          className="h-24 rounded-2xl border border-amber-500/50 text-lg tracking-wide uppercase disabled:opacity-40"
        >
          Mark problem
        </button>
        <button
          type="button"
          disabled={!roadRecording}
          onClick={stopRoadRecording}
          className="h-24 rounded-2xl border border-border text-lg tracking-wide uppercase disabled:opacity-40"
        >
          Stop
        </button>

        <p className="text-sm text-muted-foreground">
          Session: {snap.kind}/{snap.status} · Markers: {roadMarkers.length}
          {recorderRef.current?.isRecording ? ` · Samples buffering…` : null}
        </p>

        {roadMarkers.length > 0 && !roadRecording && (
          <div className="space-y-4">
            <h2 className="text-sm tracking-[0.2em] uppercase text-muted-foreground">
              Attach notes to markers
            </h2>
            {roadMarkers.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{(m.tMs / 1000).toFixed(1)} s</p>
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={m.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setRoadMarkers((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, label } : x)),
                    );
                    if (trace) {
                      const next = {
                        ...trace,
                        markers: trace.markers.map((x) => (x.id === m.id ? { ...x, label } : x)),
                      };
                      setTrace(next);
                      saveCalibrationTraceLocally(next);
                    }
                  }}
                >
                  <option value="">Select…</option>
                  {PROBLEM_MARKER_LABELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <textarea
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional detail"
                  value={m.note}
                  onChange={(e) => {
                    const note = e.target.value;
                    setRoadMarkers((prev) => prev.map((x) => (x.id === m.id ? { ...x, note } : x)));
                  }}
                />
              </div>
            ))}
            {trace && (
              <button
                type="button"
                className="h-12 w-full rounded-full border border-border text-[11px] tracking-[0.2em] uppercase"
                onClick={() => downloadCalibrationTrace(trace)}
              >
                Export JSON
              </button>
            )}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Debug</p>
        <h1 className="mt-2 text-3xl font-light">Calibration lab</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Replay road traces and deterministic scenarios. Compare Current vs Realism V2 on the same
          motion without re-driving. No GPS routes are stored.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-[11px] tracking-[0.18em] uppercase">
          <Link to="/debug" className="text-muted-foreground underline">
            Sound
          </Link>
          <Link to="/debug/powertrain" className="text-muted-foreground underline">
            Powertrain
          </Link>
          <button
            type="button"
            className="text-muted-foreground underline"
            onClick={() => setLabMode("road")}
          >
            Tesla road-test mode
          </button>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Scenario</p>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            {CALIBRATION_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadScenario}
            className="h-10 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
          >
            Generate scenario trace
          </button>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Import / stored</p>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
            }}
          />
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={trace?.id ?? ""}
            onChange={(e) => {
              const t = stored.find((x) => x.id === e.target.value);
              if (t) {
                setTrace(t);
                setReplayTrace(null);
              }
            }}
          >
            <option value="">Stored traces…</option>
            {stored.map((t) => (
              <option key={t.id} value={t.id}>
                {t.meta.label} ({t.samples.length})
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="text-muted-foreground">Profile</span>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {SOUND_PROFILES.filter((p) => p.drivetrainMode === "virtual-transmission")
              .slice(0, 20)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Audio engine</p>
            <div className="mt-2 flex gap-2">
              {(["current", "v2"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchRealismLive(m)}
                  className={`h-10 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                    realismEngine === m ? "border-foreground bg-secondary" : "border-border"
                  }`}
                >
                  {m === "current" ? "Current" : "Realism V2"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Powertrain</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => switchDynamicLive(true)}
                className={`h-10 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                  dynamicDrive ? "border-foreground bg-secondary" : "border-border"
                }`}
              >
                Dynamic
              </button>
              <button
                type="button"
                onClick={() => switchDynamicLive(false)}
                className={`h-10 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                  !dynamicDrive ? "border-foreground bg-secondary" : "border-border"
                }`}
              >
                Legacy
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={runReplay}
            disabled={!trace}
            className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] uppercase disabled:opacity-40"
          >
            Resimulate powertrain
          </button>
          <button
            type="button"
            onClick={() => active && downloadCalibrationTrace(active)}
            disabled={!active}
            className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] uppercase disabled:opacity-40"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => active && setCompareBefore(active)}
            disabled={!active}
            className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] uppercase disabled:opacity-40"
          >
            Set as before
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void startPlayback()}
          disabled={!active}
          className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase disabled:opacity-40"
        >
          Play
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          disabled={!playing}
          className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase disabled:opacity-40"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => {
            stopAudio();
            setCursorMs(0);
            playIndexRef.current = 0;
          }}
          className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
        >
          Restart
        </button>
        {[0.5, 1, 2].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            className={`h-11 rounded-full border px-4 text-[11px] ${
              rate === r ? "border-foreground bg-secondary" : "border-border"
            }`}
          >
            {r}×
          </button>
        ))}
      </section>

      {active && (
        <>
          <section>
            <input
              type="range"
              min={0}
              max={active.durationMs || 1}
              value={cursorMs}
              onChange={(e) => setCursorMs(Number(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              t = {(cursorMs / 1000).toFixed(2)} s / {(active.durationMs / 1000).toFixed(1)} s
              {sampleAtCursor
                ? ` · ${sampleAtCursor.speedKmh.toFixed(1)} km/h · G${sampleAtCursor.gear} · ${sampleAtCursor.rpm.toFixed(0)} rpm · demand ${sampleAtCursor.driverDemand.toFixed(2)}`
                : null}
            </p>
            <TraceSparklines samples={active.samples} cursorMs={cursorMs} shifts={shifts} />
            <div className="mt-3 flex flex-wrap gap-2">
              {shifts.map((sh, i) => (
                <button
                  key={`${sh.atMs}-${i}`}
                  type="button"
                  onClick={() => {
                    setSelectedShiftIdx(i);
                    setCursorMs(sh.atMs);
                  }}
                  className={`rounded-full border px-3 py-1 text-[10px] tracking-wide ${
                    selectedShiftIdx === i ? "border-foreground" : "border-border"
                  }`}
                >
                  {sh.fromGear}→{sh.toGear} @ {sh.speedBeforeKmh.toFixed(0)}
                </button>
              ))}
            </div>
          </section>

          {selectedShift && (
            <section className="rounded-xl border border-border p-4 text-sm">
              <h2 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                Shift detail
              </h2>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                <li>
                  Gears: {selectedShift.fromGear} → {selectedShift.toGear} (
                  {selectedShift.direction})
                </li>
                <li>Reason: {selectedShift.reason}</li>
                <li>
                  Speed: {selectedShift.speedBeforeKmh.toFixed(1)} →{" "}
                  {selectedShift.speedAfterKmh.toFixed(1)} km/h
                </li>
                <li>
                  RPM: {selectedShift.rpmBefore.toFixed(0)} → {selectedShift.rpmAfter.toFixed(0)}{" "}
                  (mech {selectedShift.mechanicalRpmAfter.toFixed(0)})
                </li>
                <li>Demand: {selectedShift.driverDemand.toFixed(2)}</li>
                <li>Duration: {selectedShift.durationMs} ms</li>
              </ul>
            </section>
          )}

          {metrics && (
            <section className="rounded-xl border border-border p-4 text-sm">
              <h2 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                Automated metrics
              </h2>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                <li>Upshifts: {metrics.upshifts}</li>
                <li>Downshifts: {metrics.downshifts}</li>
                <li>Hunting events: {metrics.gearHuntingEvents}</li>
                <li>
                  Avg time between shifts: {metrics.averageTimeBetweenShiftsMs?.toFixed(0) ?? "—"}{" "}
                  ms
                </li>
                <li>Min gear hold: {metrics.minimumGearHoldMs ?? "—"} ms</li>
                <li>RPM discontinuities: {metrics.rpmDiscontinuitiesOutsideShifts}</li>
                <li>Largest shift RPM error: {metrics.largestShiftRpmError.toFixed(0)}</li>
                <li>Redline violations: {metrics.redlineViolations}</li>
                <li>Kickdown response: {metrics.kickdownResponseMs ?? "—"} ms</li>
                <li>Sensor-transition shifts: {metrics.sensorTransitionInducedShifts}</li>
              </ul>
              {metrics.flags.length > 0 && (
                <p className="mt-3 text-amber-500/90">Flags: {metrics.flags.join("; ")}</p>
              )}
            </section>
          )}

          <section className="rounded-xl border border-border p-4">
            <h2 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
              Subjective review (local only)
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ mechanicalVsElectronic: "mechanical" })}
              >
                Mechanical
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ mechanicalVsElectronic: "electronic" })}
              >
                Electronic
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ shiftFeel: "natural" })}
              >
                Natural shift
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ shiftFeel: "artificial" })}
              >
                Artificial shift
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ loadResponse: "good" })}
              >
                Good load
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ loadResponse: "weak" })}
              >
                Weak load
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ fatigue: "comfortable" })}
              >
                Comfortable
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase"
                onClick={() => saveRating({ fatigue: "fatiguing" })}
              >
                Fatiguing
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Notes stored locally ({listSubjectiveNotes(active.id).length} for this trace). Not an
              automated quality score.
            </p>
          </section>

          {comparison && (
            <section className="rounded-xl border border-border p-4 text-sm">
              <h2 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                Comparison report
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {comparison.narrative.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function TraceSparklines({
  samples,
  cursorMs,
  shifts,
}: {
  samples: CalibrationTrace["samples"];
  cursorMs: number;
  shifts: ReturnType<typeof extractShiftEvents>;
}) {
  const w = 640;
  const h = 120;
  if (samples.length < 2) return null;
  const maxT = samples[samples.length - 1]!.tMs || 1;
  const maxSpeed = Math.max(1, ...samples.map((s) => s.speedKmh));
  const maxRpm = Math.max(1, ...samples.map((s) => s.rpm));
  const path = (pick: (s: (typeof samples)[0]) => number, maxV: number) =>
    samples
      .map((s, i) => {
        const x = (s.tMs / maxT) * w;
        const y = h - (pick(s) / maxV) * (h - 8) - 4;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const maxGear = Math.max(1, ...samples.map((s) => s.gear));
  const cursorX = (cursorMs / maxT) * w;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        Speed · RPM · mech RPM · demand · load · gear (shift marks in coral)
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-lg border border-border bg-black/40">
        <path
          d={path((s) => s.speedKmh, maxSpeed)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={1.2}
        />
        <path
          d={path((s) => s.rpm, maxRpm)}
          fill="none"
          stroke="#8af"
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <path
          d={path((s) => s.mechanicalRpm, maxRpm)}
          fill="none"
          stroke="#48f"
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <path
          d={path((s) => s.driverDemand * maxRpm, maxRpm)}
          fill="none"
          stroke="#8f8"
          strokeOpacity={0.6}
          strokeWidth={1}
        />
        <path
          d={path((s) => s.engineLoad * maxRpm, maxRpm)}
          fill="none"
          stroke="#fc8"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        <path
          d={path((s) => (s.gear / maxGear) * maxRpm * 0.85, maxRpm)}
          fill="none"
          stroke="#f8f"
          strokeOpacity={0.55}
          strokeWidth={1.2}
        />
        {shifts.map((sh, i) => (
          <line
            key={i}
            x1={(sh.atMs / maxT) * w}
            x2={(sh.atMs / maxT) * w}
            y1={0}
            y2={h}
            stroke="#f86"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        ))}
        <line
          x1={cursorX}
          x2={cursorX}
          y1={0}
          y2={h}
          stroke="#fff"
          strokeOpacity={0.8}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}
