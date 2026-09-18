import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { AuditionPanel } from "@/components/AuditionPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { allProfiles, getProfile, type SoundProfile } from "@/lib/sound/profiles";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { exportSoundPack, importSoundPack, getProfileGain } from "@/lib/drive/settings";
import { needsIntenseConfirm } from "@/lib/drive/safety";
import { t } from "@/lib/i18n";
import { FindSoundPanel } from "@/components/FindSoundPanel";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import { SoundProfileAccessIndicator } from "@/components/SoundProfileAccessIndicator";
import { UpgradePrompt } from "@/components/premium/UpgradePrompt";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";
import { chromeStickyTopClass, isLiveSessionStatus } from "@/lib/ui/chrome";
import {
  SOUND_MOODS,
  groupProfilesBySection,
  previewVerb,
  searchProfiles,
  type SoundMood,
} from "@/lib/sound/moods";

export const Route = createFileRoute("/sounds")({
  component: Sounds,
  head: () => createSeoHeadFromPath("/sounds"),
});

function Sounds() {
  const { settings, update } = useSettings();
  const access = useFeatureAccess();
  const reducedMotion = useReducedMotion();
  const snap = useSessionStore();
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<SoundMood>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [abB, setAbB] = useState(settings.profileId);
  const [holding, setHolding] = useState(false);
  const packRef = useRef<HTMLInputElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = getProfile(settings.profileId);
  const detail = detailId ? getProfile(detailId) : null;
  const liveMini = isLiveSessionStatus(snap.status);

  const profiles = useMemo(
    () => searchProfiles(query, mood).filter((p) => p.category !== "Garage"),
    // customSounds length refreshes when Garage customs register into allProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional content gate
    [query, mood, settings.customSounds.length],
  );
  const sections = useMemo(() => groupProfilesBySection(profiles), [profiles]);

  const select = (id: string) => {
    if (!access.canDriveWithProfile(id)) return;
    const profile = allProfiles().find((p) => p.id === id);
    if (profile && needsIntenseConfirm(profile, settings.volume, getProfileGain(settings, id))) {
      setConfirmId(id);
      return;
    }
    update({ profileId: id });
    setDetailId(null);
  };

  const preview = (profile: SoundProfile) => {
    if (!access.canPreviewProfile(profile.id)) return;
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    update({ profileId: profile.id });
    void getSession().listenProfile(profile.id, 60);
    const limitSeconds = access.previewDurationForProfile(profile.id);
    if (limitSeconds != null) {
      previewTimerRef.current = setTimeout(() => {
        getSession().stop();
        previewTimerRef.current = null;
      }, limitSeconds * 1000);
    }
  };

  const toggleFavourite = (id: string) => {
    const has = settings.favourites.includes(id);
    update({
      favourites: has ? settings.favourites.filter((f) => f !== id) : [...settings.favourites, id],
    });
  };

  const onHoldStart = (profile: SoundProfile) => {
    setHolding(true);
    preview(profile);
    getSession().setDemo({ selector: "D", throttle: 0.85, accel: 0.7, regen: 0 });
  };
  const onHoldEnd = () => {
    setHolding(false);
    getSession().setDemo({ selector: "D", throttle: 0.15, accel: 0.2, regen: 0.2 });
  };

  return (
    <main className="min-h-screen pb-28">
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 sm:px-10 sm:pt-16">
        <h1 className="text-3xl font-light">Choose your sound.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Pick a mood, then Listen. Everything uses the same Motion.
        </p>

        <FindSoundPanel className="mt-10" onSelect={select} />

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
                  {selected.traits.join(" · ")}
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
                {snap.status === "running" && snap.profileId === selected.id ? "Stop" : "Listen"}
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

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {SOUND_MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMood(m.id)}
              aria-pressed={mood === m.id}
              className={`h-9 shrink-0 rounded-full border px-3 text-[10px] tracking-[0.14em] uppercase ${
                mood === m.id
                  ? "border-foreground bg-secondary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-10 space-y-12">
          {sections.map(({ section, items }) => (
            <section key={section}>
              <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                {section}
              </h2>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {items.map((profile) => {
                  const starred = settings.favourites.includes(profile.id);
                  const lockedForDrive = !access.canDriveWithProfile(profile.id);
                  return (
                    <li key={profile.id} className="flex items-center justify-between gap-3 py-5">
                      <button
                        type="button"
                        onClick={() => {
                          if (lockedForDrive) {
                            trackMonetizationEvent("premium_feature_clicked", {
                              source: "sounds",
                              plan: "free",
                              context: "locked_sound",
                            });
                          }
                          setDetailId(profile.id);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="text-xl font-light">{profile.name}</span>
                          {lockedForDrive ? <SoundProfileAccessIndicator /> : null}
                        </span>
                        <span className="mt-2 block text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          {profile.traits.join(" · ")}
                          {starred ? " · ★" : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Preview ${profile.name}`}
                        onClick={() => preview(profile)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-sm hover:bg-secondary"
                      >
                        ▶
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {!sections.length ? (
          <p className="mt-10 text-sm text-muted-foreground">No sounds match that search.</p>
        ) : null}

        <Accordion type="single" collapsible className="mt-16 border-t border-border">
          <AccordionItem value="advanced" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <span className="text-base font-light tracking-normal normal-case">Advanced</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-10 pb-8">
              <div>
                <p className="text-sm text-muted-foreground">Compare two Sound Profiles.</p>
                <div className="mt-4 flex flex-wrap gap-3">
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
                    Start A / B
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
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
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importSoundPack(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <AuditionPanel profileId={settings.profileId} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12">
          <Link
            to="/studio"
            className="inline-flex h-12 items-center rounded-full border border-border px-8 text-[11px] tracking-[0.22em] uppercase hover:bg-secondary"
          >
            Open Studio
          </Link>
        </div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center">
          <div className="w-full max-w-md border border-border bg-background p-8 sm:mx-6">
            <p className="flex items-baseline gap-2 text-2xl font-light">
              {detail.name}
              {!access.canDriveWithProfile(detail.id) ? <SoundProfileAccessIndicator /> : null}
            </p>
            <p className="mt-3 text-xs tracking-[0.18em] text-muted-foreground uppercase">
              {detail.traits.join(" · ")}
            </p>
            <p className="mt-6 text-sm text-muted-foreground">{detail.description}</p>
            {!access.canDriveWithProfile(detail.id) ? (
              <div className="mt-6">
                <UpgradePrompt
                  context="locked_sound"
                  title={`${detail.name} · full drive`}
                  variant="compact"
                />
              </div>
            ) : null}
            <button
              type="button"
              onPointerDown={() => onHoldStart(detail)}
              onPointerUp={onHoldEnd}
              onPointerLeave={onHoldEnd}
              onPointerCancel={onHoldEnd}
              className="mt-8 h-14 w-full touch-none rounded-full border border-foreground bg-foreground text-[11px] tracking-[0.2em] text-background uppercase"
            >
              {holding ? "…" : previewVerb(detail)}
            </button>
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => toggleFavourite(detail.id)}
                className="h-11 text-sm"
                aria-label={
                  settings.favourites.includes(detail.id)
                    ? `Unstar ${detail.name}`
                    : `Star ${detail.name}`
                }
              >
                {settings.favourites.includes(detail.id) ? "♥ Favorite" : "♡ Favorite"}
              </button>
              <button
                type="button"
                onClick={() => select(detail.id)}
                disabled={!access.canDriveWithProfile(detail.id)}
                className="h-11 rounded-full bg-primary px-6 text-[11px] tracking-[0.2em] text-primary-foreground uppercase disabled:opacity-40"
              >
                {access.canDriveWithProfile(detail.id) ? "Use Sound" : "Included with Drive+"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="mt-6 w-full text-[11px] tracking-[0.2em] text-muted-foreground uppercase"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

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
