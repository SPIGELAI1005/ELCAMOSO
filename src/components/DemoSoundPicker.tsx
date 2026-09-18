import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  PROFILE_CATEGORIES,
  allProfiles,
  type ProfileCategory,
  type SoundProfile,
} from "@/lib/sound/profiles";
import type { ElcamosoSettings } from "@/lib/drive/settings";

/**
 * Compact Sound Profile picker for Demo Drive: categories + profile chips.
 */
export function DemoSoundPicker({
  settings,
  onSelect,
  className = "",
}: {
  settings: ElcamosoSettings;
  onSelect: (profileId: string) => void;
  className?: string;
}) {
  const current = useMemo(
    () => allProfiles().find((p) => p.id === settings.profileId),
    [settings.profileId],
  );
  const [category, setCategory] = useState<ProfileCategory | "Favourites">(
    () => current?.category ?? "Classic",
  );
  const categoryTouched = useRef(false);
  useLayoutEffect(() => {
    if (categoryTouched.current) return;
    if (current?.category) setCategory(current.category);
  }, [settings.profileId, current?.category]);

  const selectCategory = (next: ProfileCategory | "Favourites") => {
    categoryTouched.current = true;
    setCategory(next);
  };

  const categories = useMemo(() => {
    const cats: Array<ProfileCategory | "Favourites"> = ["Favourites"];
    for (const c of PROFILE_CATEGORIES) {
      if (c === "Garage" && !settings.customSounds.length) continue;
      cats.push(c);
    }
    return cats;
  }, [settings.customSounds.length]);

  const profiles = useMemo((): SoundProfile[] => {
    const all = allProfiles();
    if (category === "Favourites") {
      const starred = new Set(settings.favourites);
      return all.filter((p) => starred.has(p.id));
    }
    return all.filter((p) => p.category === category);
  }, [category, settings.favourites]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Sound Profile
        </h3>
        <span className="truncate text-xs text-muted-foreground">
          {current?.name ?? "Select a sound"}
        </span>
      </div>

      <div
        className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Sound categories"
      >
        {categories.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onPointerDown={() => selectCategory(cat)}
              onClick={() => selectCategory(cat)}
              className={`h-8 shrink-0 rounded-full border px-3.5 text-[10px] tracking-[0.16em] uppercase transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {profiles.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {profiles.map((profile) => {
            const selected = settings.profileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setCategory(profile.category);
                  onSelect(profile.id);
                }}
                aria-pressed={selected}
                className={`h-10 rounded-full border px-4 text-xs tracking-[0.12em] transition-colors ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                }`}
              >
                {profile.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {category === "Favourites"
            ? "Star sounds on the Sounds page to pin them here."
            : "No profiles in this category."}
        </p>
      )}
    </div>
  );
}
