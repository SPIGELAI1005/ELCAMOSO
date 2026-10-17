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

export function DriveDnaViz({
  dna,
  className,
  compact = false,
}: {
  dna: DriveDna;
  className?: string;
  /** Tighter spacing for post-drive / tablet / short viewports. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        compact
          ? "space-y-4 [@media(max-height:820px)]:space-y-3"
          : "space-y-6",
        className,
      )}
    >
      <div>
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Drive DNA</p>
        <p
          className={cn(
            "font-light",
            compact ? "mt-1.5 text-xl sm:mt-2 sm:text-2xl" : "mt-2 text-2xl",
          )}
        >
          {dna.archetype}
        </p>
        <p
          className={cn(
            "text-muted-foreground",
            compact
              ? "mt-1.5 text-xs sm:mt-2 sm:text-sm [@media(max-height:820px)]:mt-1"
              : "mt-2 text-sm",
          )}
        >
          A musical motion signature - not a safety or skill score.
        </p>
      </div>
      <ul
        className={cn(
          compact
            ? "space-y-3 sm:space-y-3.5 [@media(max-height:820px)]:space-y-2.5"
            : "space-y-4",
        )}
      >
        {DIMS.map((key) => (
          <li key={key}>
            <div className="flex justify-between text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              <span>{key}</span>
              <span>{dna[key]}</span>
            </div>
            <div
              className={cn(
                "overflow-hidden rounded-full bg-border/60",
                compact ? "mt-1.5 h-0.5 sm:mt-2 sm:h-1" : "mt-2 h-1",
              )}
            >
              <div
                className="h-full bg-foreground transition-[width] duration-500"
                style={{ width: `${dna[key]}%` }}
              />
            </div>
            <p
              className={cn(
                "text-muted-foreground",
                compact
                  ? "mt-1 text-[11px] leading-snug sm:mt-1.5 sm:text-xs [@media(max-height:820px)]:line-clamp-1"
                  : "mt-1.5 text-xs",
              )}
            >
              {DRIVE_DNA_COPY[key]}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
