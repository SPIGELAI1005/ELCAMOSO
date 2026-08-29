import type { MotionPipelineMetrics } from "@/lib/motion/pipeline-metrics";

function fmtMs(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)} ms`;
}

function fmtHz(value: number): string {
  return `${Math.round(value)} Hz`;
}

function healthLabel(health: MotionPipelineMetrics["networkHealth"]): string {
  switch (health) {
    case "live":
      return "Live";
    case "degraded":
      return "Degraded";
    case "stale":
      return "Stale";
    default:
      return "Offline";
  }
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] tracking-[0.06em]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </div>
  );
}

interface DrivePipelineMetricsProps {
  metrics: MotionPipelineMetrics;
  className?: string;
}

/** Developer-facing motion → audio pipeline timings (cockpit / debug). */
export function DrivePipelineMetrics({ metrics, className = "" }: DrivePipelineMetricsProps) {
  const { latencies, timestamps } = metrics;

  return (
    <section
      className={`rounded-xl border border-border/60 bg-surface-1/30 px-4 py-4 text-left ${className}`}
      aria-label="Motion pipeline metrics"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Pipeline</p>
        <p className="text-[10px] tracking-[0.18em] text-foreground uppercase">
          {healthLabel(metrics.networkHealth)}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <MetricRow label="Fallback tier" value={metrics.fallbackTier ?? "—"} />
        <MetricRow label="Sensor sampling" value={fmtMs(latencies.sensorSamplingMs)} />
        <MetricRow label="Phone → server" value={fmtMs(latencies.phoneToServerMs)} />
        <MetricRow label="Server → Tesla" value={fmtMs(latencies.serverToDisplayMs)} />
        <MetricRow label="Display → fusion" value={fmtMs(latencies.displayToFusionMs)} />
        <MetricRow label="Powertrain update" value={fmtMs(latencies.fusionToPowertrainMs)} />
        <MetricRow label="Audio event" value={fmtMs(latencies.powertrainToAudioMs)} />
        <MetricRow
          label="End to end"
          value={fmtMs(latencies.totalPipelineMs ?? latencies.endToEndMs)}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
        <div>
          <p className="text-[9px] tracking-[0.22em] text-muted-foreground uppercase">Phone</p>
          <p className="mt-1 font-mono text-sm tabular-nums">{fmtHz(metrics.phoneSendHz)}</p>
        </div>
        <div>
          <p className="text-[9px] tracking-[0.22em] text-muted-foreground uppercase">Fusion</p>
          <p className="mt-1 font-mono text-sm tabular-nums">{fmtHz(metrics.fusionHz)}</p>
        </div>
        <div>
          <p className="text-[9px] tracking-[0.22em] text-muted-foreground uppercase">Audio</p>
          <p className="mt-1 font-mono text-sm tabular-nums">{fmtHz(metrics.audioHz)}</p>
        </div>
      </div>

      {metrics.packetLossCount > 0 || metrics.reconnectCount > 0 ? (
        <div className="mt-3 space-y-1 border-t border-border/50 pt-3">
          {metrics.packetLossCount > 0 ? (
            <MetricRow label="Packet loss" value={String(metrics.packetLossCount)} />
          ) : null}
          {metrics.reconnectCount > 0 ? (
            <MetricRow label="Reconnects" value={String(metrics.reconnectCount)} />
          ) : null}
        </div>
      ) : null}

      {metrics.seq !== null ? (
        <p className="mt-3 text-[10px] tracking-[0.12em] text-muted-foreground">
          Seq {metrics.seq}
          {timestamps.sensorSampleAt ? ` · sample ${timestamps.sensorSampleAt}` : null}
        </p>
      ) : null}
    </section>
  );
}
