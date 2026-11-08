import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { cn } from "@/lib/utils";

const PHASES = [
  { id: "still", label: "Still", layers: ["The place holds"] },
  { id: "moving", label: "Moving", layers: ["The world wakes"] },
  { id: "push", label: "Push", layers: ["Energy rises"] },
  { id: "release", label: "Release", layers: ["The world eases"] },
] as const;

/** How a World follows the drive. Not a music arrangement. */
export function WorldMotionDiagram({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div className={cn("w-full", className)} aria-label="Motion wakes the world">
      <ol className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
        {PHASES.map((phase, index) => (
          <li key={phase.id} className="flex flex-1 flex-col items-center text-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border border-border",
                !reduced && "transition-opacity",
              )}
              style={{ opacity: 0.45 + index * 0.18 }}
            >
              <span className="text-[10px] tracking-[0.2em] uppercase">{index + 1}</span>
            </div>
            <p className="mt-3 text-sm font-light text-foreground">{phase.label}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {phase.layers.join(" · ")}
            </p>
            {index < PHASES.length - 1 ? (
              <span className="mt-3 text-muted-foreground sm:hidden" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Speed does not play a loop. Motion wakes the world.
      </p>
    </div>
  );
}
