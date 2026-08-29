import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { SnippetStudio } from "@/components/SnippetStudio";
import { materializeCustom, type CustomSound, type Playlist } from "@/lib/drive/settings";
import { describeProfileRule } from "@/lib/drive/profile-rules";
import { SOUND_PROFILES, allProfiles, getProfile } from "@/lib/sound/profiles";
import { copyShareLink } from "@/lib/sound/share";
import { trackEvent } from "@/lib/telemetry/analytics";

export const Route = createFileRoute("/garage")({
  component: Garage,
  head: () => ({
    meta: [
      { title: "Garage - Your saved EV sounds | ELCAMOSO" },
      {
        name: "description",
        content:
          "Every sound you have saved or starred, with drive history and one-tap switching before your next drive.",
      },
      { property: "og:title", content: "Garage - Your saved EV sounds | ELCAMOSO" },
      {
        property: "og:description",
        content: "Your saved ELCAMOSO sounds, favourites and drive history in one place.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/garage" },
    ],
    links: [{ rel: "canonical", href: "/garage" }],
  }),
});

function Garage() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const reducedMotion = useReducedMotion();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [shareNote, setShareNote] = useState<string | null>(null);

  const customs = settings.customSounds;
  const families = groupTakes(customs);
  const favourites = settings.favourites
    .map((id) => getProfile(id))
    .filter((p) => p && settings.favourites.includes(p.id));
  const recentlyUsed = deriveRecentlyUsed(settings);

  const select = (id: string) => update({ profileId: id });

  const remove = (id: string) => {
    const next = customs.filter((c) => c.id !== id);
    update({
      customSounds: next,
      favourites: settings.favourites.filter((f) => f !== id),
      ...(settings.profileId === id ? { profileId: SOUND_PROFILES[0]!.id } : {}),
    });
  };

  const duplicate = (sound: CustomSound) => {
    const copy: CustomSound = {
      ...sound,
      id: `custom-${Date.now().toString(36)}`,
      name: `${sound.name} copy`.slice(0, 40),
      createdAt: Date.now(),
      familyId: sound.familyId ?? sound.id,
      takeLabel: sound.takeLabel ? `${sound.takeLabel} copy`.slice(0, 24) : "Copy",
    };
    update({ customSounds: [...customs, copy] });
  };

  const rename = (id: string) => {
    update({
      customSounds: customs.map((c) =>
        c.id === id ? { ...c, name: draftName.trim() || c.name } : c,
      ),
    });
    setRenaming(null);
  };

  const toggleFavourite = (id: string) => {
    const has = settings.favourites.includes(id);
    update({
      favourites: has ? settings.favourites.filter((f) => f !== id) : [...settings.favourites, id],
    });
  };

  const createPlaylist = () => {
    const list: Playlist = {
      id: `list-${Date.now().toString(36)}`,
      name: `Playlist ${settings.playlists.length + 1}`,
      profileIds: [],
      createdAt: Date.now(),
    };
    update({ playlists: [...settings.playlists, list] });
  };

  const renamePlaylist = (id: string, name: string) =>
    update({
      playlists: settings.playlists.map((l) => (l.id === id ? { ...l, name } : l)),
    });

  const removePlaylist = (id: string) =>
    update({ playlists: settings.playlists.filter((l) => l.id !== id) });

  const togglePlaylistItem = (listId: string, profileId: string) =>
    update({
      playlists: settings.playlists.map((l) => {
        if (l.id !== listId) return l;
        const has = l.profileIds.includes(profileId);
        const profileIds = has
          ? l.profileIds.filter((p) => p !== profileId)
          : [...l.profileIds, profileId];
        const existing = l.segments ?? l.profileIds.map((id) => ({ profileId: id, minutes: 15 }));
        const segments = has
          ? existing.filter((s) => s.profileId !== profileId)
          : [...existing.filter((s) => s.profileId !== profileId), { profileId, minutes: 15 }];
        if (!segments.length) {
          const { segments: _drop, ...rest } = l;
          return { ...rest, profileIds };
        }
        return { ...l, profileIds, segments };
      }),
    });

  const setSegmentMinutes = (listId: string, profileId: string, minutes: number) =>
    update({
      playlists: settings.playlists.map((l) => {
        if (l.id !== listId) return l;
        const segments = (
          l.segments?.length
            ? l.segments
            : l.profileIds.map((id) => ({ profileId: id, minutes: 15 }))
        ).map((s) => (s.profileId === profileId ? { ...s, minutes } : s));
        return { ...l, segments };
      }),
    });

  const active = getProfile(settings.profileId);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">Garage</p>
        <h1 className="mt-4 text-3xl font-light">My Garage</h1>

        <section className="mt-12 flex flex-wrap items-center gap-8 border-y border-border py-8">
          <ElcamosoMark
            intensity={0.7}
            waveResponse={active.voice.waveResponse}
            reducedMotion={reducedMotion}
            className="h-10 w-auto"
          />
          <div className="flex-1">
            <p className="text-xs tracking-[0.24em] text-muted-foreground uppercase">In the car</p>
            <p className="mt-2 text-2xl font-light">{active.name}</p>
          </div>
          <Link
            to="/drive"
            className="h-12 shrink-0 rounded-full bg-primary px-8 text-xs leading-[3rem] tracking-[0.24em] text-primary-foreground uppercase"
          >
            Drive
          </Link>
          <Link
            to="/replay"
            className="h-12 shrink-0 rounded-full border border-border px-8 text-xs leading-[3rem] tracking-[0.24em] uppercase"
          >
            Recordings
          </Link>
        </section>

        <dl className="mt-10 grid grid-cols-3 gap-6 text-center">
          <Stat label="Drives" value={settings.driveCount} />
          <Stat label="My Sounds" value={customs.length} />
          <Stat
            label="Last drive"
            value={
              settings.lastDriveAt
                ? new Date(settings.lastDriveAt).toLocaleDateString()
                : "None yet"
            }
          />
        </dl>

        <section className="mt-16">
          <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Favorites
          </h2>
          {favourites.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Star a sound in{" "}
              <Link to="/sounds" className="text-foreground underline underline-offset-4">
                Sounds
              </Link>{" "}
              to keep it one tap away.
            </p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {favourites.map((p) => (
                <button
                  key={p.id}
                  onClick={() => select(p.id)}
                  className={`h-11 rounded-full border px-6 text-[11px] tracking-[0.16em] uppercase ${
                    settings.profileId === p.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16">
          <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Recently Used
          </h2>
          {recentlyUsed.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No recent sounds yet.</p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {recentlyUsed.map((p) => (
                <button
                  key={p.id}
                  onClick={() => select(p.id)}
                  className={`h-11 rounded-full border px-6 text-[11px] tracking-[0.16em] uppercase ${
                    settings.profileId === p.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
              My Sounds
            </h2>
            <Link
              to="/studio"
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Create new
            </Link>
          </div>
          {shareNote ? <p className="mt-4 text-sm text-muted-foreground">{shareNote}</p> : null}

          {customs.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Nothing here yet. Build your first sound in the{" "}
              <Link to="/studio" className="text-foreground underline underline-offset-4">
                Studio
              </Link>{" "}
              and it lands in this Garage.
            </p>
          ) : (
            <div className="mt-6 divide-y divide-border border-y border-border">
              {families.map((family) => {
                const sound =
                  family.takes.find((t) => t.id === settings.profileId) ?? family.takes[0]!;
                const profile = materializeCustom(sound);
                const selected = family.takes.some((t) => t.id === settings.profileId);
                const starred = settings.favourites.includes(sound.id);
                return (
                  <div key={family.id} className="py-7">
                    <div className="flex items-start gap-5">
                      <ElcamosoMark
                        intensity={selected ? 1 : 0.34}
                        waveResponse={profile.voice.waveResponse}
                        reducedMotion={reducedMotion}
                        className="mt-1 h-6 w-auto shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        {renaming === sound.id ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              maxLength={40}
                              aria-label="New name"
                              className="h-10 flex-1 border-b border-border bg-transparent text-lg font-light outline-none focus:border-foreground"
                            />
                            <button
                              onClick={() => rename(sound.id)}
                              className="text-[11px] tracking-[0.24em] uppercase hover:text-foreground"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-xl font-light">{sound.name}</p>
                        )}
                        <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          From {getProfile(sound.baseId).name}
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">{profile.description}</p>
                        {sound.rules?.length ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {sound.rules.map(describeProfileRule).join(" · ")}
                          </p>
                        ) : null}
                        {family.takes.length > 1 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {family.takes.map((take) => (
                              <button
                                key={take.id}
                                type="button"
                                onClick={() => select(take.id)}
                                className={`h-10 rounded-full border px-4 text-[11px] tracking-[0.16em] uppercase ${
                                  settings.profileId === take.id
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border text-muted-foreground"
                                }`}
                              >
                                {take.takeLabel || "Main"}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-4 text-[11px] tracking-[0.2em] uppercase">
                          <Action
                            onClick={() => select(sound.id)}
                            label={selected ? "Selected" : "Select"}
                            muted={selected}
                          />
                          <Action
                            onClick={() => toggleFavourite(sound.id)}
                            label={starred ? "Starred" : "Star"}
                            muted={starred}
                          />
                          <Action
                            onClick={() => {
                              setRenaming(sound.id);
                              setDraftName(sound.name);
                            }}
                            label="Rename"
                          />
                          <Action onClick={() => duplicate(sound)} label="Duplicate" />
                          <Action
                            onClick={() => {
                              void copyShareLink(sound).then(() => {
                                trackEvent("share_create", { via: "garage" });
                                setShareNote(
                                  `${sound.name}: link copied. Anyone with it can Listen in the browser.`,
                                );
                              });
                            }}
                            label="Share"
                          />
                          <Action onClick={() => remove(sound.id)} label="Delete" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-16 border-t border-border pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
              Playlists
            </h2>
            <button
              onClick={createPlaylist}
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              New playlist
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Curated sets you can step through while auditioning or on a demo drive. Add minutes per
            sound for a timed road-trip crossfade.
          </p>

          {settings.playlists.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No playlists yet. Create one and add the sounds you keep coming back to.
            </p>
          ) : (
            <div className="mt-8 space-y-10">
              {settings.playlists.map((list) => (
                <div key={list.id} className="border-t border-border pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <input
                      value={list.name}
                      maxLength={40}
                      aria-label="Playlist name"
                      onChange={(e) => renamePlaylist(list.id, e.target.value)}
                      className="h-10 flex-1 border-b border-border bg-transparent text-lg font-light outline-none focus:border-foreground"
                    />
                    <Action onClick={() => removePlaylist(list.id)} label="Delete" />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {list.profileIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Empty. Add sounds below.</p>
                    ) : (
                      list.profileIds.map((id) => {
                        const minutes =
                          list.segments?.find((s) => s.profileId === id)?.minutes ?? 15;
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-2 rounded-full border border-foreground px-3 py-1"
                          >
                            <button
                              onClick={() => togglePlaylistItem(list.id, id)}
                              aria-label={`Remove ${getProfile(id).name}`}
                              className="text-[11px] tracking-[0.16em] uppercase"
                            >
                              {getProfile(id).name} ×
                            </button>
                            <label className="flex items-center gap-1 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                              <input
                                type="number"
                                min={1}
                                max={240}
                                value={minutes}
                                aria-label={`Minutes for ${getProfile(id).name}`}
                                onChange={(e) =>
                                  setSegmentMinutes(list.id, id, Number(e.target.value) || 15)
                                }
                                className="h-8 w-12 border-b border-border bg-transparent text-center text-xs text-foreground outline-none"
                              />
                              min
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <label className="mt-6 block text-xs tracking-[0.16em] text-muted-foreground uppercase">
                    Add a sound
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) togglePlaylistItem(list.id, e.target.value);
                      }}
                      className="mt-3 block h-11 w-full border-b border-border bg-transparent text-sm tracking-normal text-foreground normal-case outline-none focus:border-foreground"
                    >
                      <option value="">Choose a sound</option>
                      {allProfiles()
                        .filter((p) => !list.profileIds.includes(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        <SnippetStudio
          className="mt-16 border-t border-border pt-10"
          snippets={settings.snippets}
          onChange={(snippets) => update({ snippets })}
        />

        <div className="mt-16 flex flex-wrap gap-4">
          <button
            onClick={() => void navigate({ to: "/studio" })}
            className="h-14 rounded-full border border-border px-10 text-xs tracking-[0.24em] uppercase hover:bg-secondary"
          >
            Open Studio
          </button>
          <Link
            to="/sounds"
            className="inline-flex h-14 items-center rounded-full border border-border px-10 text-xs tracking-[0.24em] uppercase hover:bg-secondary"
          >
            Browse sounds
          </Link>
        </div>
      </div>
    </main>
  );
}

function groupTakes(sounds: CustomSound[]) {
  const map = new Map<string, CustomSound[]>();
  for (const sound of sounds) {
    const key = sound.familyId ?? sound.id;
    const list = map.get(key) ?? [];
    list.push(sound);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([id, takes]) => ({
    id,
    takes: takes.sort((a, b) => a.createdAt - b.createdAt),
  }));
}

/** Last drive profile, then Studio customs by recency, then favourites. */
function deriveRecentlyUsed(settings: ReturnType<typeof useSettings>["settings"]) {
  if (!settings.lastDriveAt && !settings.customSounds.length && !settings.favourites.length) {
    return [];
  }

  const seen = new Set<string>();
  const out: ReturnType<typeof getProfile>[] = [];

  const push = (id: string) => {
    if (!id || seen.has(id)) return;
    const profile = getProfile(id);
    if (!profile) return;
    seen.add(id);
    out.push(profile);
  };

  if (settings.lastDriveAt) push(settings.profileId);

  const customsByRecency = [...settings.customSounds].sort((a, b) => b.createdAt - a.createdAt);
  for (const sound of customsByRecency) {
    push(sound.id);
    if (out.length >= 8) break;
  }

  if (out.length < 8) {
    for (const id of settings.favourites) {
      push(id);
      if (out.length >= 8) break;
    }
  }

  return out;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="text-2xl font-extralight tabular-nums">{value}</dd>
      <dt className="mt-2 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        {label}
      </dt>
    </div>
  );
}

function Action({
  onClick,
  label,
  muted,
}: {
  onClick: () => void;
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-9 ${muted ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}
