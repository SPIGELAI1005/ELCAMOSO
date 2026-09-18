import { Link } from "@tanstack/react-router";
import type { ExperienceFamilyMeta, ExperienceKind } from "@/lib/experiences";
import { cn } from "@/lib/utils";

const KIND_ORDER: ExperienceKind[] = ["engine", "symphony", "world", "fusion"];

export function ExperienceFamilyGrid({
  families,
  className,
  large,
}: {
  families: readonly ExperienceFamilyMeta[];
  className?: string;
  large?: boolean;
}) {
  const ordered = KIND_ORDER.map((k) => families.find((f) => f.kind === k)).filter(
    Boolean,
  ) as ExperienceFamilyMeta[];

  return (
    <ul
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        large ? "lg:grid-cols-2 lg:gap-6" : "lg:grid-cols-4",
        className,
      )}
    >
      {ordered.map((family) => (
        <li key={family.kind}>
          <Link
            to={family.href}
            className={cn(
              "group flex h-full flex-col justify-between border border-border/70 bg-surface-1/30 p-6 transition-colors hover:border-foreground/40 hover:bg-surface-1/50",
              large ? "min-h-[11rem] sm:p-8" : "min-h-[9rem]",
            )}
          >
            <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
              {family.label}
            </p>
            <div className="mt-6">
              <p
                className={cn(
                  "font-light text-foreground",
                  large ? "text-2xl sm:text-3xl" : "text-xl",
                )}
              >
                {family.headline}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{family.subcopy}</p>
            </div>
            <span className="mt-6 text-[10px] tracking-[0.24em] text-muted-foreground uppercase transition-colors group-hover:text-foreground">
              Open
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
