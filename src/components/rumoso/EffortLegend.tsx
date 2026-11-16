import { EFFORT_ZONES } from "@/lib/rumoso/colors";

export function EffortLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`pointer-events-none rounded-xl border border-white/10 bg-black/55 backdrop-blur-md ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      }`}
      data-testid="rumoso-legend"
    >
      <p className="mb-1.5 text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
        Effort
      </p>
      <div className="flex flex-col gap-1">
        {EFFORT_ZONES.map((z) => (
          <div key={z.id} className="flex items-center gap-2">
            <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ background: z.color }} />
            <span className="whitespace-nowrap text-[10px] text-foreground/80">{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EffortBar({ effort }: { effort: number }) {
  const e = Math.min(100, Math.max(0, effort));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
      <div
        className="h-full rounded-full transition-[width,background-color] duration-300"
        style={{
          width: `${e}%`,
          background: `linear-gradient(90deg, #8a8f98 0%, #5eead4 25%, #fbbf24 50%, #f97316 72%, #e53935 100%)`,
        }}
      />
    </div>
  );
}
