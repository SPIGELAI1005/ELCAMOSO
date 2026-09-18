import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SIMULATOR_CONTROLS,
  IDLE_POWERTRAIN,
  POWERTRAIN_PROFILES,
  POWERTRAIN_SCENARIOS,
  PowertrainSimulationSession,
  runPowertrainScenario,
  validatePowertrainTrace,
  getPowertrainProfile,
  type SimulatorControls,
  type VirtualPowertrainState,
} from "@/lib/powertrain/domain";

export const Route = createFileRoute("/debug/powertrain")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/" });
    }
  },
  component: PowertrainDebug,
  head: () => ({
    meta: [{ title: "Powertrain Simulator · ELCAMOSO" }],
  }),
});

const PRESETS: { id: string; label: string; apply: () => SimulatorControls }[] = [
  {
    id: "idle",
    label: "Idle",
    apply: () => ({ speedKmh: 0, accelerationMs2: 0, throttle: 0, braking: 0 }),
  },
  {
    id: "city",
    label: "City accel",
    apply: () => ({ speedKmh: 20, accelerationMs2: 2.2, throttle: 0.75, braking: 0 }),
  },
  {
    id: "highway",
    label: "Highway",
    apply: () => ({ speedKmh: 110, accelerationMs2: 0.3, throttle: 0.35, braking: 0 }),
  },
  {
    id: "lift-off",
    label: "Lift-off",
    apply: () => ({ speedKmh: 95, accelerationMs2: -0.15, throttle: 0.06, braking: 0.05 }),
  },
  {
    id: "brake",
    label: "Braking",
    apply: () => ({ speedKmh: 80, accelerationMs2: -3.5, throttle: 0, braking: 0.85 }),
  },
];

function PowertrainDebug() {
  const [profileId, setProfileId] = useState(POWERTRAIN_PROFILES[0]!.id);
  const [controls, setControls] = useState<SimulatorControls>(DEFAULT_SIMULATOR_CONTROLS);
  const [integrate, setIntegrate] = useState(true);
  const [running, setRunning] = useState(true);
  const [state, setState] = useState<VirtualPowertrainState>(IDLE_POWERTRAIN);
  const [scenarioReport, setScenarioReport] = useState<string | null>(null);

  const sessionRef = useRef(new PowertrainSimulationSession(profileId));
  const controlsRef = useRef(controls);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    sessionRef.current.setProfile(profileId);
    sessionRef.current.reset(controlsRef.current);
  }, [profileId]);

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastRef.current) / 1000);
    lastRef.current = now;

    const { controls: nextControls, powertrain } = sessionRef.current.tick(
      controlsRef.current,
      dt,
      integrate,
    );
    controlsRef.current = nextControls;
    setControls(nextControls);
    setState(powertrain);
    if (running) rafRef.current = requestAnimationFrame(tick);
  }, [integrate, running]);

  useEffect(() => {
    if (!running) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, tick]);

  const patch = (partial: Partial<SimulatorControls>) => {
    setControls((c) => {
      const next = { ...c, ...partial };
      controlsRef.current = next;
      return next;
    });
  };

  const reset = () => {
    sessionRef.current.reset();
    const idle = DEFAULT_SIMULATOR_CONTROLS;
    controlsRef.current = idle;
    setControls(idle);
    setState(IDLE_POWERTRAIN);
    setScenarioReport(null);
  };

  const runScenario = (scenarioId: string) => {
    const scenario = POWERTRAIN_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setRunning(false);
    const profile = getPowertrainProfile(scenario.profileId ?? profileId);
    const result = runPowertrainScenario(scenario, profile);
    const validation = validatePowertrainTrace(result, profile);
    const last = result.samples[result.samples.length - 1]!;
    setScenarioReport(
      validation.ok
        ? `${scenario.label}: ${result.shiftCount} shifts, final ${last.speedKmh.toFixed(0)} km/h, gear ${last.gear || "N"} - trace OK`
        : `${scenario.label}: ${validation.issues.length} issue(s)\n${validation.issues.slice(0, 5).join("\n")}`,
    );
  };

  const profile = sessionRef.current.getProfile();
  const rpmPct = state.normalizedRpm * 100;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Dev only</p>
        <h1 className="mt-3 text-3xl font-light">Dynamic Drive Simulator</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Powertrain domain only - no audio, no vehicle sensors. Pick any personality; tune speed,
          acceleration, throttle and braking; inspect gear, RPM, load and driving state.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            to="/debug"
            className="inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
          >
            ← Sound debug
          </Link>
          <Link
            to="/debug/calibration"
            className="inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
          >
            Calibration lab →
          </Link>
        </div>

        <section className="mt-10 space-y-6 border border-border p-6">
          <label className="block text-sm">
            <span className="text-muted-foreground">Powertrain profile</span>
            <select
              className="mt-2 h-11 w-full border border-border bg-background px-3"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              {POWERTRAIN_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.transmission.gears} gears · {p.engine.redlineRpm} rpm
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next = p.apply();
                  controlsRef.current = next;
                  setControls(next);
                  setScenarioReport(null);
                }}
                className="h-9 rounded-full border border-border px-4 text-[11px] tracking-[0.18em] uppercase hover:bg-secondary"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Transmission scenarios
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POWERTRAIN_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => runScenario(s.id)}
                  className="h-9 rounded-full border border-border px-4 text-[11px] tracking-[0.14em] uppercase hover:bg-secondary"
                >
                  {s.label}
                </button>
              ))}
            </div>
            {scenarioReport ? (
              <pre className="mt-3 whitespace-pre-wrap border border-border bg-secondary/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {scenarioReport}
              </pre>
            ) : null}
          </div>

          <SliderRow
            label="Speed"
            value={controls.speedKmh}
            min={0}
            max={200}
            step={1}
            unit="km/h"
            onChange={(v) => patch({ speedKmh: v })}
          />
          <SliderRow
            label="Acceleration"
            value={controls.accelerationMs2}
            min={-6}
            max={5}
            step={0.1}
            unit="m/s²"
            onChange={(v) => patch({ accelerationMs2: v })}
          />
          <SliderRow
            label="Throttle"
            value={controls.throttle}
            min={0}
            max={1}
            step={0.01}
            unit=""
            onChange={(v) => patch({ throttle: v })}
          />
          <SliderRow
            label="Braking"
            value={controls.braking}
            min={0}
            max={1}
            step={0.01}
            unit=""
            onChange={(v) => patch({ braking: v })}
          />

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={integrate}
                onChange={(e) => setIntegrate(e.target.checked)}
              />
              Integrate speed from throttle / brake
            </label>
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="h-10 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
            >
              {running ? "Pause" : "Run"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-10 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="mt-8 border border-border p-6">
          <div className="mb-6 flex justify-center">
            <span className="rounded-full border border-border px-4 py-1.5 text-[11px] tracking-[0.24em] uppercase">
              {state.drivingMode.replace("-", " ")}
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-5xl font-light tabular-nums tracking-tight">
              {Math.round(state.rpm).toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] tracking-[0.32em] text-muted-foreground uppercase">
              RPM
            </p>
            <div className="mt-6 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-foreground transition-[width] duration-75"
                style={{ width: `${rpmPct}%` }}
              />
            </div>
            <p className="mt-8 text-4xl font-light tabular-nums">
              {state.gear > 0 ? state.gear : "N"}
            </p>
            <p className="mt-1 text-[11px] tracking-[0.32em] text-muted-foreground uppercase">
              Gear
            </p>
            <p className="mt-6 text-sm text-muted-foreground">{profile.name}</p>
          </div>
          <div className="mx-auto mt-8 grid max-w-md gap-4">
            <MeterBar label="Driver demand" value={state.driverDemand} />
            <MeterBar label="Engine load" value={state.engineLoad} />
          </div>
        </section>

        <section className="mt-8 grid gap-4 border border-border p-6 text-sm sm:grid-cols-2">
          <Readout label="Backend" value={state.diagnostics?.powertrainBackend ?? "dynamic"} />
          <Readout label="Driving state" value={state.drivingMode} />
          <Readout label="Target gear" value={String(state.targetGear)} />
          <Readout label="Queued target" value={String(state.queuedTargetGear)} />
          <Readout label="Driver demand" value={state.driverDemand.toFixed(2)} />
          <Readout label="Engine load" value={state.engineLoad.toFixed(2)} />
          <Readout
            label="Mechanical RPM"
            value={Math.round(state.mechanicalRpm).toLocaleString()}
          />
          <Readout label="Normalized RPM" value={state.normalizedRpm.toFixed(2)} />
          <Readout
            label="Shift phase"
            value={
              state.shifting
                ? `${state.shiftPhase ?? "?"} ${((state.shiftProgress ?? 0) * 100).toFixed(0)}%`
                : "idle"
            }
          />
          <Readout label="Last shift reason" value={state.lastShiftReason ?? "none"} />
          <Readout
            label="Rev match"
            value={state.revMatchActive ? state.revMatchProgress.toFixed(2) : "no"}
          />
          <Readout label="Overrun" value={state.overrun ? "yes" : "no"} />
          <Readout label="Engine" value={state.engineRunning ? "running" : "off"} />
          <Readout
            label="Display speed"
            value={`${(state.diagnostics?.displaySpeedKmh ?? controls.speedKmh).toFixed(1)} km/h`}
          />
          <Readout
            label="Mechanical speed"
            value={`${(state.diagnostics?.mechanicalSpeedKmh ?? controls.speedKmh).toFixed(1)} km/h`}
          />
          <Readout
            label="Shift-decision speed"
            value={`${(state.diagnostics?.shiftDecisionSpeedKmh ?? controls.speedKmh).toFixed(1)} km/h`}
          />
          <Readout
            label="Braking"
            value={(state.diagnostics?.braking ?? controls.braking).toFixed(2)}
          />
          <Readout label="Motion source" value={state.diagnostics?.motionSource ?? "simulator"} />
          <Readout label="Fallback tier" value={state.diagnostics?.fallbackTier ?? "-"} />
          <Readout label="Redline" value={String(profile.engine.redlineRpm)} />
          <Readout label="Gears" value={String(profile.transmission.gears)} />
        </section>
      </div>
    </main>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        className="mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function MeterBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="flex justify-between text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-foreground/80 transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
