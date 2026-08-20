import { useMemo, useState } from "react";
import { allProfiles, getProfile } from "@/lib/sound/profiles";
import type { ElcamosoSettings } from "@/lib/drive/settings";

/**
 * Favourites and curated playlists as a single strip, so the most memorable
 * profiles are one tap away during audition and demo drives.
 */
export function QuickJump({
  settings,
  onSelect,
  className = "",
}: {
  settings: ElcamosoSettings;
  onSelect: (profileId: string) => void;
  className?: string;
}) {
  const [listId, setListId] = useState<string>("favourites");

  const items = useMemo(() => {
    const known = new Map(allProfiles().map((p) => [p.id, p]));
    const ids =
      listId === "favourites"
        ? settings.favourites
        : (settings.playlists.find((p) => p.id === listId)?.profileIds ?? []);
    return ids.map((id) => known.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [listId, settings.favourites, settings.playlists]);

  const lists = [
    { id: "favourites", name: `Favourites (${settings.favourites.length})` },
    ...settings.playlists.map((p) => ({ id: p.id, name: `${p.name} (${p.profileIds.length})` })),
  ];

  const current = getProfile(settings.profileId);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Quick jump
        </h3>
        <span className="text-xs text-muted-foreground">Playing: {current.name}</span>
      </div>

      {lists.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setListId(list.id)}
              aria-pressed={listId === list.id}
              className={`h-9 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                listId === list.id
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {list.name}
            </button>
          ))}
        </div>
      ) : null}

      {items.length ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {items.map((profile) => (
            <button
              key={profile.id}
              onClick={() => onSelect(profile.id)}
              aria-pressed={settings.profileId === profile.id}
              className={`h-11 rounded-full border px-5 text-xs tracking-[0.16em] uppercase transition-colors ${
                settings.profileId === profile.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {profile.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Star a sound, or build a playlist in the Garage, to keep it here.
        </p>
      )}
    </div>
  );
}
