import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  EXPERIENCE_FAMILIES,
  canAccessExperience,
  experienceForProfileId,
  listEngineExperiences,
  listFusionExperiences,
  listSymphonyExperiences,
  listWorldExperiences,
  type ExperienceKind,
} from "@/lib/experiences";
import { useSettings } from "@/lib/drive/useSettings";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { trackEvent } from "@/lib/telemetry/analytics";
import { cn } from "@/lib/utils";

interface ExperiencePickerProps {
  open: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * Parked / pre-drive experience selector.
 */
export function ExperiencePicker({ open, onClose, className }: ExperiencePickerProps) {
  const { settings, update } = useSettings();
  const { hasEntitlement } = useEntitlements();
  const [kind, setKind] = useState<ExperienceKind>("engine");
  const current = experienceForProfileId(settings.profileId);

  const items = useMemo(() => {
    if (kind === "engine") return listEngineExperiences().slice(0, 24);
    if (kind === "world") return listWorldExperiences();
    if (kind === "symphony") return listSymphonyExperiences();
    if (kind === "fusion") return listFusionExperiences();
    return [];
  }, [kind]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center",
        className,
      )}
      role="dialog"
      aria-modal
      aria-label="Choose experience"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background px-5 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Selected experience
            </p>
            <p className="mt-1 text-xl font-light">{current.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXPERIENCE_FAMILIES.map((family) => (
            <button
              key={family.kind}
              type="button"
              onClick={() => setKind(family.kind)}
              className={cn(
                "rounded-full border px-4 py-2 text-[10px] tracking-[0.2em] uppercase",
                kind === family.kind
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {family.label}
            </button>
          ))}
        </div>

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {items.map((item) => {
            const selectable =
              item.capabilities.selectableInDrive &&
              Boolean(item.capabilities.profileId) &&
              canAccessExperience(item, hasEntitlement);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={() => {
                    if (!item.capabilities.profileId) return;
                    update({ profileId: item.capabilities.profileId });
                    trackEvent("experience_selected", { family: item.kind, experience: item.id });
                    onClose();
                  }}
                  className="flex w-full items-start justify-between gap-4 py-4 text-left disabled:opacity-50"
                >
                  <div>
                    <p className="text-base font-light text-foreground">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.tagline}</p>
                  </div>
                  <span className="shrink-0 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    {selectable
                      ? current.capabilities.profileId === item.capabilities.profileId
                        ? "Active"
                        : "Select"
                      : item.entitlement === "drive_plus"
                        ? "Drive+"
                        : item.previewMode === "architecture"
                          ? "Preview"
                          : "Soon"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {kind === "symphony" ? (
          <Link
            to="/symphony"
            onClick={onClose}
            className="mt-6 inline-block text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
          >
            Drive Symphony overview
          </Link>
        ) : null}
        {kind === "fusion" ? (
          <Link
            to="/fusion"
            onClick={onClose}
            className="mt-6 inline-block text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
          >
            Open Fusion mixer
          </Link>
        ) : null}
        {kind === "world" ? (
          <Link
            to="/worlds"
            onClick={onClose}
            className="mt-6 inline-block text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
          >
            Browse Worlds
          </Link>
        ) : null}
      </div>
    </div>
  );
}
