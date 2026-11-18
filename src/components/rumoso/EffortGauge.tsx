import { colorForEffort, zoneForEffort } from "@/lib/rumoso/colors";

export function EffortGauge({ effort, compact = false }: { effort: number; compact?: boolean }) {
  const e = Math.min(100, Math.max(0, Number.isFinite(effort) ? effort : 0));
  const zone = zoneForEffort(e);
  const color = colorForEffort(e);
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (e / 100) * c;
  return (
    <div className="flex flex-col items-center justify-center" data-testid="rumoso-gauge">
      <div className={compact ? "relative size-[56px]" : "relative size-[96px]"}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-[stroke-dasharray,stroke] duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono font-light tabular-nums leading-none ${compact ? "text-lg" : "text-2xl"}`}
            style={{ color }}
          >
            {Math.round(e)}
          </span>
        </div>
      </div>
      {compact ? null : (
        <span className="mt-1 text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
          {zone.label}
        </span>
      )}
    </div>
  );
}
