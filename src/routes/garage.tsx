import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { materializeCustom, type CustomSound } from "@/lib/drive/settings";
import { SOUND_PROFILES, getProfile } from "@/lib/sound/profiles";

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

  const customs = settings.customSounds;
  const favourites = settings.favourites
    .map((id) => getProfile(id))
    .filter((p) => p && settings.favourites.includes(p.id));

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
      favourites: has
        ? settings.favourites.filter((f) => f !== id)
        : [...settings.favourites, id],
    });
  };

  const active = getProfile(settings.profileId);

  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Garage
        </p>
        <h1 className="mt-4 text-3xl font-light">Your sounds</h1>

        <section className="mt-12 flex flex-wrap items-center gap-8 border-y border-border py-8">
          <ElcamosoMark
            intensity={0.7}
            waveResponse={active.voice.waveResponse}
            reducedMotion={reducedMotion}
            className="h-10 w-auto"
          />
          <div className="flex-1">
            <p className="text-xs tracking-[0.24em] text-muted-foreground uppercase">
              In the car
            </p>
            <p className="mt-2 text-2xl font-light">{active.name}</p>
          </div>
          <Link
            to="/drive"
            className="h-12 shrink-0 rounded-full bg-primary px-8 text-xs leading-[3rem] tracking-[0.24em] text-primary-foreground uppercase"
          >
            Drive
          </Link>
        </section>

        <dl className="mt-10 grid grid-cols-3 gap-6 text-center">
          <Stat label="Drives" value={settings.driveCount} />
          <Stat label="Studio sounds" value={customs.length} />
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
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
              Studio sounds
            </h2>
            <Link
              to="/studio"
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Create new
            </Link>
          </div>

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
              {customs.map((sound) => {
                const profile = materializeCustom(sound);
                const selected = settings.profileId === sound.id;
                const starred = settings.favourites.includes(sound.id);
                return (
                  <div key={sound.id} className="py-7">
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
                        <p className="mt-3 text-sm text-muted-foreground">
                          {profile.description}
                        </p>
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

        <section className="mt-16">
          <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Starred
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
