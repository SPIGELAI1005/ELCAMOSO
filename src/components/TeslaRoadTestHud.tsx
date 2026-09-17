import { useEffect, useRef, useState } from "react";
import type { DriveDiagnosticsFrame } from "@/lib/diagnostics/types";
import { getSession } from "@/lib/drive/session";

function fmt(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function sensorLabel(frame: DriveDiagnosticsFrame): string {
  const src = frame.fusion.primarySource;
  const tier = frame.fusion.fallbackTier;
  if (src === "tesla-browser" || src === "vehicle-telemetry") return "Tesla/browser";
  if (src === "phone") return "phone relay";
  if (frame.fusion.transitioning) return "fused";
  if (tier === "hold" || tier === "decay") return "fallback";
  return src || tier || "—";
}

function Field({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">{label}</p>
      <p
        className={`mt-1 font-mono tabular-nums text-foreground ${
          large ? "text-3xl font-light tracking-tight sm:text-4xl" : "text-lg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

interface TeslaRoadTestHudProps {
  className?: string;
  /** Compact developer strip vs full road-test card. */
  compact?: boolean;
}

/**
 * Developer-only Tesla browser road-test HUD.
 * Large readouts for gear / RPM / phase without cluttering production Drive UI.
 */
export function TeslaRoadTestHud({ className = "", compact = false }: TeslaRoadTestHudProps) {
  const [frame, setFrame] = useState<DriveDiagnosticsFrame>(() =>
    getSession().getDriveDiagnostics(),
  );
  const [profileName, setProfileName] = useState("—");
  const [shiftFlash, setShiftFlash] = useState<string | null>(null);
  const prevGear = useRef<number | null>(null);

  useEffect(() => {
    const session = getSession();
    const tick = () => {
      const next = session.getDriveDiagnostics();
      setFrame(next);
      const snap = session.snapshot();
      if (snap.profileName) setProfileName(snap.profileName);
      const gear = next.powertrain.gear;
      if (prevGear.current != null && gear > 0 && prevGear.current > 0 && gear !== prevGear.current) {
        setShiftFlash(`${prevGear.current} → ${gear}`);
      }
      prevGear.current = gear;
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!shiftFlash) return;
    const id = window.setTimeout(() => setShiftFlash(null), 1600);
    return () => window.clearTimeout(id);
  }, [shiftFlash]);

  const pt = frame.powertrain;
  const gearLabel = pt.gear > 0 ? `D${pt.gear}` : "N";
  const phase = pt.shifting ? (pt.shiftPhase ?? "—") : "none";
  const powertrain = pt.powertrainBackend === "dynamic" ? "Dynamic" : "Legacy";

  return (
    <section
      className={`rounded-xl border border-border/70 bg-black/70 px-4 py-4 text-left backdrop-blur-sm ${className}`}
      aria-label="Tesla road test HUD"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Road test HUD
        </p>
        {shiftFlash ? (
          <p className="font-mono text-2xl tracking-[0.08em] text-foreground">{shiftFlash}</p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Gear" value={gearLabel} large />
        <Field label="RPM" value={fmt(pt.mechanicalRpm ?? pt.rpm, 0)} large />
        <Field
          label="Speed"
          value={`${fmt(frame.fusion.speedKmh || pt.displaySpeedKmh, 0)} km/h`}
          large
        />
        <Field label="Demand" value={fmtPct(pt.driverDemand ?? pt.throttle)} large />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Shift phase" value={phase} />
        <Field label="Profile" value={profileName} />
        <Field label="Powertrain" value={powertrain} />
        <Field label="Sensor source" value={sensorLabel(frame)} />
      </div>

      {!compact ? (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 sm:grid-cols-4">
          <Field label="Target gear" value={pt.targetGear == null ? "—" : String(pt.targetGear)} />
          <Field
            label="Queued gear"
            value={pt.queuedTargetGear == null ? "—" : String(pt.queuedTargetGear)}
          />
          <Field label="Engine load" value={fmtPct(pt.engineLoad ?? pt.load)} />
          <Field label="Audio backend" value={frame.audio.synthesisMode || "—"} />
        </div>
      ) : null}
    </section>
  );
}
