import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { AuditionPanel } from "@/components/AuditionPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PROFILE_CATEGORIES,
  allProfiles,
  getProfile,
  intensityBand,
  type IntensityBand,
  type SoundProfile,
} from "@/lib/sound/profiles";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { exportSoundPack, importSoundPack } from "@/lib/drive/settings";
import { needsIntenseConfirm } from "@/lib/drive/safety";
import { getProfileGain } from "@/lib/drive/settings";
import { t } from "@/lib/i18n";
import { FindSoundPanel } from "@/components/FindSoundPanel";
import { chromeStickyTopClass, isLiveSessionStatus } from "@/lib/ui/chrome";

export const Route = createFileRoute("/sounds")({
  component: Sounds,
  head: () => ({
    meta: [
      { title: "Sounds - ELCAMOSO" },
      {
        name: "description",
        content:
          "Choose a sound personality for your EV: GT V8, Racing V10, Cyber Pulse, Space Ship, Santa Sleigh and more.",
      },
      { property: "og:title", content: "Sounds - ELCAMOSO" },
      {
        property: "og:description",
        content:
          "Choose a sound personality for your EV: GT V8, Racing V10, Cyber Pulse, Space Ship, Santa Sleigh and more.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/sounds" },
    ],
    links: [{ rel: "canonical", href: "/sounds" }],
  }),
});

function Sounds() {
  const { settings, update } = useSettings();
  const reducedMotion = useReducedMotion();
  const snap = useSessionStore();
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<IntensityBand | "all">("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [abB, setAbB] = useState(settings.profileId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const packRef = useRef<HTMLInputElement>(null);

  const selected = getProfile(settings.profileId);
  const liveMini = isLiveSessionStatus(snap.status);

  const profiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProfiles().filter((p) => {
      if (favouritesOnly && !settings.favourites.includes(p.id)) return false;
      if (band !== "all" && intensityBand(p) !== band) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.traits.some((trait) => trait.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        p.id.includes(q)
      );
    });
  }, [query, band, favouritesOnly, settings.customSounds, settings.favourites]);

  const catalog = PROFILE_CATEGORIES.map((category) => ({
    category,
    items: profiles.filter((p) => p.category === category),
  })).filter((group) => group.items.length > 0);

  const defaultOpen =
    catalog.find((g) => g.items.some((p) => p.id === settings.profileId))?.category ??
    catalog[0]?.category ??
    "";

  const select = (id: string) => {
    const profile = allProfiles().find((p) => p.id === id);
    if (
      profile &&
      needsIntenseConfirm(profile, settings.volume, getProfileGain(settings, id))
    ) {
      setConfirmId(id);
      return;
    }
    update({ profileId: id });
  };

  const preview = (profile: SoundProfile) => {
    getSession().syncConfig({ profileId: profile.id });
    getSession().setAuditionKmh(60);
    void getSession().startAudition();
  };

  const toggleFavourite = (id: string) => {
    const has = settings.favourites.includes(id);
    update({
      favourites: has
        ? settings.favourites.filter((f) => f !== id)
        : [...settings.favourites, id],
    });
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-28 sm:px-10 sm:pt-16">
        <h1 className="text-3xl font-light">Choose your sound</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Open a family, pick a Sound Profile, then Listen. Everything uses the same Motion.
        </p>

        <FindSoundPanel className="mt-10" onSelect={select} />

        {/* Sticky listen strip: stays under BrandNav (+ MiniPlayer when live). */}
        <section
          className={`sticky z-30 mt-10 border border-border bg-background/95 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6 ${chromeStickyTopClass(liveMini)}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <ElcamosoMark
                intensity={1}
                waveResponse={selected.voice.waveResponse}
                reducedMotion={reducedMotion}
                className="h-7 w-auto shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-light">{selected.name}</p>
                <p className="mt-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  {selected.category} · {intensityBand(selected)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (snap.status === "running" && snap.profileId === selected.id) {
                    getSession().stop();
                    return;
                  }
                  preview(selected);
                }}
                className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase hover:bg-secondary"
              >
                {snap.status === "running" && snap.profileId === selected.id
                  ? "Stop"
                  : "Listen"}
              </button>
              <Link
                to="/drive"
                className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[11px] tracking-[0.2em] text-primary-foreground uppercase"
              >
                Start Drive
              </Link>
            </div>
          </div>
        </section>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sounds"
          aria-label="Search sounds"
          className="mt-8 h-11 w-full border-b border-border bg-transparent text-sm outline-none focus:border-foreground"
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {(["all", "gentle", "balanced", "intense"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setBand(id)}
              aria-pressed={band === id}
              className={`h-9 rounded-full border px-3 text-[10px] tracking-[0.14em] uppercase ${
                band === id
                  ? "border-foreground bg-secondary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {id}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFavouritesOnly((v) => !v)}
            aria-pressed={favouritesOnly}
            className={`h-9 rounded-full border px-3 text-[10px] tracking-[0.14em] uppercase ${
              favouritesOnly
                ? "border-foreground bg-secondary"
                : "border-border text-muted-foreground"
            }`}
          >
            Favourites
          </button>
        </div>

        <Accordion
          type="single"
          collapsible
          defaultValue={defaultOpen}
          className="mt-8 border-t border-border"
        >
          {catalog.map(({ category, items }, index) => (
            <AccordionItem key={category} value={category} className="border-border">
              <AccordionTrigger className="py-6 hover:no-underline">
                <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-baseline sm:gap-5">
                  <span className="text-[10px] tracking-[0.28em] text-muted-foreground tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-base font-light tracking-normal normal-case">
                    {category}
                  </span>
                  <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case tabular-nums">
                    {items.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-8">
                <ul className="divide-y divide-border border-y border-border">
                  {items.map((profile) => {
                    const isSelected = settings.profileId === profile.id;
                    const starred = settings.favourites.includes(profile.id);
                    return (
                      <li key={profile.id} className="py-6">
                        <button
                          type="button"
                          onClick={() => select(profile.id)}
                          aria-pressed={isSelected}
                          className="flex w-full items-start gap-5 text-left transition-opacity hover:opacity-80"
                        >
                          <ElcamosoMark
                            intensity={isSelected ? 1 : 0.34}
                            waveResponse={profile.voice.waveResponse}
                            reducedMotion={reducedMotion}
                            className="mt-1 h-6 w-auto shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="text-xl font-light">{profile.name}</span>
                              {isSelected ? (
                                <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                                  Selected
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-2 block text-xs tracking-[0.18em] text-muted-foreground uppercase">
                              {profile.traits.join(" · ")} · {intensityBand(profile)}
                            </span>
                            <span className="mt-3 block max-w-md text-sm text-muted-foreground">
                              {profile.description}
                            </span>
                          </span>
                        </button>
                        <div className="mt-4 flex flex-wrap items-center gap-3 pl-11">
                          <button
                            type="button"
                            onClick={() => preview(profile)}
                            className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] uppercase"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavourite(profile.id)}
                            className="h-10 px-2 text-base"
                            aria-label={
                              starred ? `Unstar ${profile.name}` : `Star ${profile.name}`
                            }
                          >
                            {starred ? "\u2605" : "\u2606"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {!catalog.length ? (
          <p className="mt-10 text-sm text-muted-foreground">No sounds match that search.</p>
        ) : null}

        <Accordion type="single" collapsible className="mt-4 border-t border-border">
          <AccordionItem value="compare" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-baseline sm:gap-5">
                <span className="text-base font-light tracking-normal normal-case">
                  Compare
                </span>
                <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">
                  A / B listen
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-8">
              <p className="text-sm text-muted-foreground">
                Compare two Sound Profiles at the same simulated speed. Levels are matched
                before you flip.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <select
                  aria-label="Sound Profile A"
                  value={settings.profileId}
                  onChange={(e) => update({ profileId: e.target.value })}
                  className="h-11 border border-border bg-background px-3 text-sm"
                >
                  {allProfiles().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sound Profile B"
                  value={abB}
                  onChange={(e) => setAbB(e.target.value)}
                  className="h-11 border border-border bg-background px-3 text-sm"
                >
                  {allProfiles().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void getSession().startAb(settings.profileId, abB)}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                >
                  Start A/B
                </button>
                <button
                  type="button"
                  onClick={() => getSession().flipAb()}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                >
                  Flip {snap.ab ? snap.ab.active.toUpperCase() : ""}
                </button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="packs" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-baseline sm:gap-5">
                <span className="text-base font-light tracking-normal normal-case">
                  Sound packs
                </span>
                <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">
                  Export and import
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-8">
              <p className="text-sm text-muted-foreground">
                Share the active Sound Profile, mix, environment, snippets and cabin EQ as one
                JSON file.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => exportSoundPack()}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                >
                  Export pack
                </button>
                <button
                  type="button"
                  onClick={() => packRef.current?.click()}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                >
                  Import pack
                </button>
                <input
                  ref={packRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Import sound pack"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importSoundPack(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="audition" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-baseline sm:gap-5">
                <span className="text-base font-light tracking-normal normal-case">
                  Fine-tune
                </span>
                <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">
                  Audition and response
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <AuditionPanel profileId={settings.profileId} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Link
            to="/studio"
            className="inline-flex h-12 items-center rounded-full border border-border px-8 text-[11px] tracking-[0.22em] uppercase hover:bg-secondary"
          >
            Open Studio
          </Link>
        </div>
      </div>

      {confirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-6">
          <div className="max-w-sm border border-border bg-background p-8 text-center">
            <p className="text-lg font-light">{t(settings.language, "intense.confirm")}</p>
            <div className="mt-8 flex justify-center gap-4">
              <button
                type="button"
                className="h-11 rounded-full bg-primary px-6 text-[11px] tracking-[0.2em] text-primary-foreground uppercase"
                onClick={() => {
                  update({ profileId: confirmId });
                  setConfirmId(null);
                }}
              >
                Continue
              </button>
              <button
                type="button"
                className="h-11 text-[11px] tracking-[0.2em] uppercase"
                onClick={() => setConfirmId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
