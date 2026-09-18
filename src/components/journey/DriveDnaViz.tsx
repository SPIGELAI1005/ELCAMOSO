import type { DriveDna } from "@/lib/journey";
import { DRIVE_DNA_COPY } from "@/lib/journey";
import { cn } from "@/lib/utils";

const DIMS: (keyof Omit<DriveDna, "archetype">)[] = [
  "energy",
  "flow",
  "rhythm",
  "variation",
  "regen",
];

export function DriveDnaViz({ dna, className }: { dna: DriveDna; className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Drive DNA</p>
        <p className="mt-2 text-2xl font-light">{dna.archetype}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A musical motion signature - not a safety or skill score.
        </p>
      </div>
      <ul className="space-y-4">
        {DIMS.map((key) => (
          <li key={key}>
            <div className="flex justify-between text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              <span>{key}</span>
              <span>{dna[key]}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full bg-foreground transition-[width] duration-500"
                style={{ width: `${dna[key]}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{DRIVE_DNA_COPY[key]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
