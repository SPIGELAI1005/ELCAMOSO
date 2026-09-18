import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { cn } from "@/lib/utils";

const PHASES = [
  { id: "calm", label: "Calm", stems: ["Atmosphere"] },
  { id: "building", label: "Building", stems: ["Atmosphere", "Bass"] },
  { id: "energetic", label: "Energetic", stems: ["Atmosphere", "Bass", "Drums", "Guitar"] },
  {
    id: "climax",
    label: "Climax",
    stems: ["Atmosphere", "Bass", "Drums", "Guitar", "Strings"],
  },
] as const;

/** Abstract motion-intent diagram - not a DAW equalizer. */
export function MotionIntentDiagram({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div className={cn("w-full", className)} aria-label="Motion becomes musical intent">
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
              {phase.stems.join(" · ")}
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
        Speed does not become tempo. Motion becomes musical intent.
      </p>
    </div>
  );
}
