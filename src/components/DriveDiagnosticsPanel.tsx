import { useEffect, useState, type ReactNode } from "react";
import { DynamicDriveLayerPanel } from "@/components/DynamicDriveLayerPanel";
import type { AudioLayerDiagnostics, DriveDiagnosticsFrame } from "@/lib/diagnostics/types";
import { downloadDiagnosticsSession } from "@/lib/diagnostics/export";
import { getSession } from "@/lib/drive/session";

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value)} ms`;
}

function fmtHz(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value)} Hz`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] tracking-[0.06em]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-foreground" : "bg-border"}`}
      aria-hidden
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-border/50 px-3 py-2" open>
      <summary className="cursor-pointer text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        {title}
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function LayerRows({
  layers,
  emptyLabel,
}: {
  layers: AudioLayerDiagnostics[];
  emptyLabel: string;
}) {
  if (!layers.length) {
    return <p className="text-[10px] text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <>
      {layers.map((row) => (
        <MetricRow
          key={row.id}
          label={row.id.replace(/^dd-/, "")}
          value={`gain ${fmtNum(row.gain, 3)} · ${fmtNum(row.playbackRate, 2)}x · ${fmtNum(row.fundamentalHz, 0)} Hz`}
        />
      ))}
    </>
  );
}

function MotionSection({ frame }: { frame: DriveDiagnosticsFrame }) {
  const { motion } = frame;
  return (
    <Section title="Motion">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        <LiveDot live={motion.browserGps.live} />
        Browser GPS
      </div>
      <MetricRow label="Speed" value={`${fmtNum(motion.browserGps.speedKmh, 1)} km/h`} />
      <MetricRow label="Accuracy" value={`${fmtNum(motion.browserGps.accuracyM, 0)} m`} />
      <MetricRow label="Age" value={fmtMs(motion.browserGps.ageMs)} />

      <div className="mt-2 flex items-center gap-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        <LiveDot live={motion.phoneGps.live} />
        Phone GPS
      </div>
      <MetricRow label="Speed" value={`${fmtNum(motion.phoneGps.speedKmh, 1)} km/h`} />
      <MetricRow label="Accuracy" value={`${fmtNum(motion.phoneGps.accuracyM, 0)} m`} />
      <MetricRow label="Age" value={fmtMs(motion.phoneGps.ageMs)} />

      <MetricRow label="Acceleration raw" value={`${fmtNum(motion.accelerationRawMs2, 2)} m/s²`} />
      <MetricRow
        label="Acceleration filtered"
        value={`${fmtNum(motion.accelerationFilteredMs2, 2)} m/s²`}
      />

      <div className="mt-2 flex items-center gap-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        <LiveDot live={motion.teslaTelemetry.live} />
        Tesla telemetry
      </div>
      <MetricRow label="Speed" value={`${fmtNum(motion.teslaTelemetry.speedKmh, 1)} km/h`} />
      <MetricRow
        label="Acceleration"
        value={`${fmtNum(motion.teslaTelemetry.accelerationMs2, 2)} m/s²`}
      />
      <MetricRow label="Pedal" value={fmtPct(motion.teslaTelemetry.pedal)} />
      <MetricRow label="Motor RPM" value={fmtNum(motion.teslaTelemetry.motorRpm, 0)} />
      <MetricRow label="Operating state" value={motion.teslaTelemetry.operatingState ?? "—"} />
      <MetricRow label="Age" value={fmtMs(motion.teslaTelemetry.ageMs)} />
    </Section>
  );
}

function FusionSection({ frame }: { frame: DriveDiagnosticsFrame }) {
  const { fusion } = frame;
  return (
    <Section title="Fusion">
      <MetricRow label="Chosen speed" value={`${fmtNum(fusion.speedKmh, 1)} km/h`} />
      <MetricRow label="Chosen acceleration" value={`${fmtNum(fusion.accelerationMs2, 2)} m/s²`} />
      <MetricRow label="Confidence" value={fmtPct(fusion.confidence)} />
      <MetricRow label="Primary source" value={fusion.primarySource} />
      <MetricRow label="Fallback tier" value={fusion.fallbackTier} />
      <MetricRow label="Transitioning" value={fusion.transitioning ? "Yes" : "No"} />
    </Section>
  );
}

function PowertrainSection({ frame }: { frame: DriveDiagnosticsFrame }) {
  const { powertrain } = frame;
  const [profileLabel, setProfileLabel] = useState("—");
  useEffect(() => {
    const id = window.setInterval(() => {
      setProfileLabel(getSession().snapshot().profileName || "—");
    }, 500);
    setProfileLabel(getSession().snapshot().profileName || "—");
    return () => window.clearInterval(id);
  }, []);
  const gearLabel = powertrain.gear > 0 ? `D${powertrain.gear}` : "N";
  const phase = powertrain.shifting ? (powertrain.shiftPhase ?? "—") : "none";
  const queued =
    powertrain.queuedTargetGear == null || powertrain.queuedTargetGear === powertrain.gear
      ? "—"
      : String(powertrain.queuedTargetGear);
  const sensor =
    powertrain.motionSource ?? frame.fusion.primarySource ?? powertrain.fallbackTier ?? "—";

  return (
    <Section title="Powertrain runtime">
      <MetricRow label="PROFILE" value={profileLabel} />
      <MetricRow
        label="POWERTRAIN"
        value={powertrain.powertrainBackend === "dynamic" ? "Dynamic" : "Legacy"}
      />
      <MetricRow label="GEAR" value={gearLabel} />
      <MetricRow
        label="TARGET GEAR"
        value={powertrain.targetGear == null ? "—" : String(powertrain.targetGear)}
      />
      <MetricRow label="QUEUED GEAR" value={queued} />
      <MetricRow label="RPM" value={fmtNum(powertrain.mechanicalRpm ?? powertrain.rpm, 0)} />
      <MetricRow label="DRIVER DEMAND" value={fmtPct(powertrain.driverDemand ?? powertrain.throttle)} />
      <MetricRow label="ENGINE LOAD" value={fmtPct(powertrain.engineLoad ?? powertrain.load)} />
      <MetricRow label="SHIFT PHASE" value={phase} />
      <MetricRow label="SENSOR SOURCE" value={String(sensor)} />
      <MetricRow label="AUDIO BACKEND" value={frame.audio.synthesisMode || "—"} />
      <MetricRow label="Last shift reason" value={powertrain.lastShiftReason ?? "—"} />
      <MetricRow label="Display speed" value={`${fmtNum(powertrain.displaySpeedKmh, 1)} km/h`} />
      <MetricRow
        label="Mechanical speed"
        value={`${fmtNum(powertrain.mechanicalSpeedKmh, 1)} km/h`}
      />
      <MetricRow
        label="Shift decision speed"
        value={`${fmtNum(powertrain.shiftDecisionSpeedKmh, 1)} km/h`}
      />
    </Section>
  );
}

function AudioSection({ frame }: { frame: DriveDiagnosticsFrame }) {
  const { audio } = frame;
  const isDynamic = audio.synthesisMode === "dynamic-drive";

  return (
    <Section title="Audio">
      <MetricRow label="Synthesis" value={audio.synthesisMode} />
      {isDynamic && audio.dynamicLayers.length > 0 ? (
        <DynamicDriveLayerPanel
          layers={audio.dynamicLayers.map((row) => ({
            id: row.id,
            gain: row.gain,
            fundamentalHz: row.fundamentalHz ?? 0,
            playbackRate: row.playbackRate,
          }))}
          className="mt-2"
        />
      ) : null}

      <p className="pt-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        Active layers
      </p>
      <LayerRows layers={audio.activeLayers} emptyLabel="No steady layers audible" />

      <p className="pt-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        Transients
      </p>
      <LayerRows layers={audio.transients} emptyLabel="No transients firing" />

      <p className="pt-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        Master output
      </p>
      <MetricRow label="Peak" value={fmtNum(audio.master?.peak, 3)} />
      <MetricRow label="RMS" value={fmtNum(audio.master?.rms, 3)} />
      <MetricRow label="Headroom" value={fmtNum(audio.master?.headroom, 3)} />
      <MetricRow label="Limiter reduction" value={fmtNum(audio.master?.reduction, 3)} />
      <MetricRow label="Output latency" value={fmtMs(audio.master?.outputLatencyMs)} />
      <MetricRow label="Underruns" value={String(audio.master?.underruns ?? 0)} />
    </Section>
  );
}

function NetworkSection({ frame }: { frame: DriveDiagnosticsFrame }) {
  const { network } = frame;
  return (
    <Section title="Network">
      <MetricRow label="Phone latency" value={fmtMs(network.phoneLatencyMs)} />
      <MetricRow label="Vehicle latency" value={fmtMs(network.vehicleLatencyMs)} />
      <MetricRow label="Phone packet rate" value={fmtHz(network.phonePacketRateHz)} />
      <MetricRow label="Vehicle packet rate" value={fmtHz(network.vehiclePacketRateHz)} />
      <MetricRow label="Packet loss" value={String(network.packetLoss)} />
      <MetricRow label="Reconnect count" value={String(network.reconnectCount)} />
      <MetricRow label="Health" value={network.networkHealth} />
    </Section>
  );
}

interface DriveDiagnosticsPanelProps {
  className?: string;
}

/** Developer-only live Drive diagnostics (motion, fusion, powertrain, audio, network). */
export function DriveDiagnosticsPanel({ className = "" }: DriveDiagnosticsPanelProps) {
  const [frame, setFrame] = useState<DriveDiagnosticsFrame>(() =>
    getSession().getDriveDiagnostics(),
  );
  const [bufferFrames, setBufferFrames] = useState(0);

  useEffect(() => {
    const session = getSession();
    const tick = () => {
      setFrame(session.getDriveDiagnostics());
      setBufferFrames(session.getDriveDiagnosticsSessionFrameCount());
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const handleExport = () => {
    const payload = getSession().exportDriveDiagnosticsSession();
    downloadDiagnosticsSession(payload.frames, payload.meta);
  };

  const handleClear = () => {
    getSession().clearDriveDiagnosticsSession();
    setBufferFrames(0);
  };

  return (
    <section
      className={`rounded-xl border border-border/60 bg-surface-1/30 px-4 py-4 text-left ${className}`}
      aria-label="Drive diagnostics"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Debug mode</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="h-8 rounded-full border border-border px-3 text-[10px] tracking-[0.16em] text-muted-foreground uppercase hover:text-foreground"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="h-8 rounded-full border border-border px-3 text-[10px] tracking-[0.16em] uppercase hover:bg-secondary"
          >
            Export JSON
          </button>
        </div>
      </div>

      <p className="mt-2 text-[10px] tracking-[0.1em] text-muted-foreground">
        Session buffer: {bufferFrames} frames (~30 s at 2 Hz). Export omits location coordinates.
      </p>

      <div className="mt-4 max-h-[min(52vh,28rem)] space-y-3 overflow-y-auto pr-1">
        <MotionSection frame={frame} />
        <FusionSection frame={frame} />
        <PowertrainSection frame={frame} />
        <AudioSection frame={frame} />
        <NetworkSection frame={frame} />
      </div>
    </section>
  );
}
