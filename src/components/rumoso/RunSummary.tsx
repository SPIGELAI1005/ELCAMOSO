import { EFFORT_ZONES, colorForEffort } from "@/lib/rumoso/colors";
import { formatDistanceKm, formatDuration, formatPace } from "@/lib/rumoso/gps-pace";
import type { StoredRun } from "@/lib/rumoso/types";
import { EffortLegend } from "./EffortLegend";
import { RumosoMap } from "./RumosoMap";

export function RunSummary({
  run,
  onDone,
  onDelete,
}: {
  run: StoredRun;
  onDone: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="rumoso-summary">
      <div className="relative h-[42vh] min-h-[220px] w-full shrink-0">
        <RumosoMap points={run.points} follow={false} fitRoute className="size-full" />
        <div className="absolute top-3 right-3 z-10">
          <EffortLegend compact />
        </div>
      </div>
      <div className="space-y-6 px-5 py-5 pb-10">
        <header>
          <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Run complete</p>
          <h2 className="mt-1 text-2xl font-light">
            {formatDistanceKm(run.distanceM)} <span className="text-base text-muted-foreground">km</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(run.startedAt).toLocaleString(undefined, {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </header>

        <dl className="grid grid-cols-3 gap-3">
          <SummaryStat label="Time" value={formatDuration(run.durationMs)} />
          <SummaryStat label="Avg pace" value={formatPace(run.avgPaceSecPerKm)} />
          <SummaryStat label="Cadence" value={run.avgCadenceSpm ? `${Math.round(run.avgCadenceSpm)}` : "—"} />
          <SummaryStat label="Avg effort" value={Math.round(run.avgEffort).toString()} />
          <SummaryStat label="Peak" value={Math.round(run.peakEffort).toString()} />
          <SummaryStat label="Coach" value={run.coachMode} />
        </dl>

        <section>
          <h3 className="mb-3 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Effort zones
          </h3>
          <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-white/10">
            {run.zones.map((z) =>
              z.fraction < 0.005 ? null : (
                <div
                  key={z.id}
                  style={{
                    width: `${z.fraction * 100}%`,
                    background: EFFORT_ZONES.find((e) => e.id === z.id)?.color,
                  }}
                />
              ),
            )}
          </div>
          <ul className="space-y-1.5">
            {run.zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: EFFORT_ZONES.find((e) => e.id === z.id)?.color }}
                  />
                  {z.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDuration(z.durationMs)} · {Math.round(z.fraction * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <EffortTimeChart run={run} />
        </section>

        <section>
          <h3 className="mb-3 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Splits
          </h3>
          {run.splits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Splits appear after the first kilometre.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                <tr>
                  <th className="pb-2 font-normal">Km</th>
                  <th className="pb-2 font-normal">Pace</th>
                  <th className="pb-2 text-right font-normal">Effort</th>
                </tr>
              </thead>
              <tbody>
                {run.splits.map((s) => (
                  <tr key={s.km} className="border-t border-white/8">
                    <td className="py-2 font-mono tabular-nums">{s.km}</td>
                    <td className="py-2 font-mono tabular-nums">{formatPace(s.paceSecPerKm)}</td>
                    <td className="py-2 text-right font-mono tabular-nums" style={{ color: colorForEffort(s.avgEffort) }}>
                      {Math.round(s.avgEffort)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onDone}
            className="h-12 flex-1 rounded-full bg-foreground text-sm tracking-[0.18em] text-background uppercase"
          >
            Done
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="h-12 rounded-full border border-white/15 px-5 text-sm tracking-[0.16em] text-muted-foreground uppercase"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <dt className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-light tabular-nums capitalize">{value}</dd>
    </div>
  );
}

function EffortTimeChart({ run }: { run: StoredRun }) {
  const pts = run.points;
  if (pts.length < 2) return null;
  const w = 320;
  const h = 88;
  const t0 = pts[0]!.atMs;
  const span = Math.max(1, pts[pts.length - 1]!.atMs - t0);
  const path = pts
    .map((p, i) => {
      const x = ((p.atMs - t0) / span) * w;
      const y = h - (p.effort / 100) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-24 w-full" aria-label="Effort over time">
      {[25, 45, 65, 80].map((mark) => (
        <line
          key={mark}
          x1="0"
          x2={w}
          y1={h - (mark / 100) * (h - 8) - 4}
          y2={h - (mark / 100) * (h - 8) - 4}
          stroke="rgba(255,255,255,0.06)"
        />
      ))}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" />
    </svg>
  );
}
