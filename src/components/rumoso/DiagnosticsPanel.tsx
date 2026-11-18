import { useState } from "react";
import { copyText, downloadText, type RumosoDebugLog } from "@/lib/rumoso/debug-log";
import { RumosoIcon } from "./RumosoIcon";

export function DiagnosticsPanel({
  log,
  ticks,
}: {
  log: RumosoDebugLog;
  /** Re-render token so the snapshot stays fresh. */
  ticks: number;
}) {
  const [copied, setCopied] = useState(false);
  const snap = log.snapshot();
  void ticks;

  const copy = async () => {
    const ok = await copyText(log.toText());
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className="space-y-3 rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-md"
      data-testid="rumoso-diagnostics"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          <RumosoIcon name="diagnostics" className="size-3.5" />
          Diagnostics
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] tracking-[0.16em] text-foreground/80 uppercase"
          >
            {copied ? "Copied" : "Copy log"}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(`rumoso-diag-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`, log.toText())
            }
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] tracking-[0.16em] text-foreground/80 uppercase"
          >
            Download
          </button>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Stat label="Visibility" value={String(snap.visibility)} />
        <Stat label="Audio" value={String(snap.audioState)} />
        <Stat label="Motion events" value={String(snap.motionCount)} />
        <Stat label="GPS events" value={String(snap.gpsCount)} />
        <Stat
          label="Last motion"
          value={snap.lastMotionAgoMs == null ? "—" : `${Math.round(Number(snap.lastMotionAgoMs) / 100) / 10}s ago`}
        />
        <Stat
          label="Last GPS"
          value={snap.lastGpsAgoMs == null ? "—" : `${Math.round(Number(snap.lastGpsAgoMs) / 100) / 10}s ago`}
        />
        <Stat label="Motion while hidden" value={String(snap.motionWhileHidden)} />
        <Stat label="GPS while hidden" value={String(snap.gpsWhileHidden)} />
      </dl>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Lock the phone for a minute, come back, and check whether motion, GPS and audio kept
        counting. Copy the log if something stopped.
      </p>
      <pre className="max-h-48 overflow-auto rounded-xl bg-black/60 p-3 font-mono text-[10px] leading-relaxed text-foreground/70">
        {log.toText()}
      </pre>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}
