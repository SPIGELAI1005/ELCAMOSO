import { Link } from "@tanstack/react-router";
import { canAccessExperience, type ExperienceDescriptor } from "@/lib/experiences";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { cn } from "@/lib/utils";

export function ExperienceCardList({
  items,
  onSelect,
  className,
}: {
  items: readonly ExperienceDescriptor[];
  onSelect?: (item: ExperienceDescriptor) => void;
  className?: string;
}) {
  const { hasEntitlement } = useEntitlements();
  return (
    <ul className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item) => {
        const accessible = canAccessExperience(item, hasEntitlement);
        return (
          <li key={item.id} className="flex items-start justify-between gap-4 py-7">
            <div className="min-w-0 text-left">
              <p className="text-xl font-light">{item.name}</p>
              <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                {item.tagline}
              </p>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {item.previewMode !== "playable" ? (
                <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  {item.previewMode === "architecture" ? "Preview architecture" : "Coming next"}
                </span>
              ) : null}
              {onSelect && item.capabilities.selectableInDrive && accessible ? (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.2em] uppercase hover:border-foreground"
                >
                  Use in Drive
                </button>
              ) : item.entitlement === "drive_plus" && !accessible ? (
                <Link
                  to="/pricing"
                  className="h-10 rounded-full border border-border px-4 text-[10px] leading-10 tracking-[0.2em] uppercase hover:border-foreground"
                >
                  Drive+
                </Link>
              ) : item.kind === "engine" || item.kind === "world" ? (
                <Link
                  to="/drive"
                  className="h-10 rounded-full border border-border px-4 text-[10px] leading-10 tracking-[0.2em] uppercase hover:border-foreground"
                >
                  Drive
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
