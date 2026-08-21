import type { AudioPerf } from "@/lib/drive/session";

export function AudioPerfMeter({
  perf,
  active,
}: {
  perf: AudioPerf | null;
  active: boolean;
}) {
  if (!active || !perf) {
    return (
      <p className="mt-6 text-xs text-muted-foreground">
        Start Listen to watch audio latency and processing load for this audition.
      </p>
    );
  }

  return (
    <div className="mt-6 border border-border p-5">
      <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
        Audio monitor
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Stat label="Latency" value={`${Math.round(perf.baseLatencyMs)} ms`} />
        <Stat label="Output" value={`${Math.round(perf.outputLatencyMs)} ms`} />
        <Stat label="Load" value={`${Math.round(perf.loadPct)}%`} />
        <Stat label="Buffer stalls" value={String(perf.underruns)} />
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Load is the share of each animation frame spent updating layers and environments.
        Stalls rise when the audio clock lags the display clock.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-light tabular-nums">{value}</dd>
    </div>
  );
}
