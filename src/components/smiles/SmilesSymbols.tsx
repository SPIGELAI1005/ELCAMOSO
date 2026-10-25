import { KM_PER_MI, type SmilesUnits } from "@/lib/smiles/smiles";
import { cn } from "@/lib/utils";

/** O))) logo geometry (matches ElcamosoLogo mark, viewBox 0 0 90 72). */
const WAVES = [
  { d: "M40 14 C 52 24, 52 48, 40 58", w: 3.2 },
  { d: "M54 9 C 69 22, 69 50, 54 63", w: 3.0 },
  { d: "M68 4 C 86 20, 86 52, 68 68", w: 2.8 },
] as const;

function Mark({ waveColor }: { waveColor: string }) {
  return (
    <>
      <circle cx="20" cy="36" r="17" fill="none" stroke="currentColor" strokeWidth="3.4" />
      {WAVES.map((w) => (
        <path key={w.d} d={w.d} fill="none" stroke={waveColor} strokeWidth={w.w} strokeLinecap="round" />
      ))}
    </>
  );
}

/** Miles symbol: the regular O))) logo. */
export function MilesSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 72" className={cn("inline-block", className)} aria-label="miles" role="img">
      <Mark waveColor="currentColor" />
    </svg>
  );
}

/** Smiles symbol: O))) rotated 90° clockwise, the ))) arcs sit below the O like a smile. */
export function SmileSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 90" className={cn("inline-block", className)} aria-label="smiles" role="img">
      <g transform="translate(72 0) rotate(90)">
        <Mark waveColor="currentColor" />
      </g>
    </svg>
  );
}

export function distanceValue(km: number, u: SmilesUnits) {
  return u === "us"
    ? { v: (km / KM_PER_MI).toFixed(1), label: "miles" }
    : { v: km.toFixed(1), label: "km" };
}

/** Big "19 ☺  /  2.6 O)))" row with small labels. */
export function SmilesSymbolRow({
  smiles,
  distanceKm,
  units,
  size = "md",
  className,
}: {
  smiles: number;
  distanceKm: number;
  units: SmilesUnits;
  size?: "sm" | "md";
  className?: string;
}) {
  const d = distanceValue(distanceKm, units);
  const num = size === "sm" ? "text-xl" : "text-3xl";
  const ic = size === "sm" ? "h-5" : "h-7";
  return (
    <div className={cn("flex items-end gap-3 font-extralight", className)}>
      <div className="flex flex-col items-center">
        <span className="flex items-center gap-1.5">
          <span className={num}>{smiles}</span>
          <SmileSymbol className={cn(ic, "w-auto")} />
        </span>
        <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">smiles</span>
      </div>
      <span className={cn(num, "text-muted-foreground/60")}>/</span>
      <div className="flex flex-col items-center">
        <span className="flex items-center gap-1.5">
          <span className={num}>{d.v}</span>
          <MilesSymbol className={cn(ic, "w-auto")} />
        </span>
        <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">{d.label}</span>
      </div>
    </div>
  );
}
