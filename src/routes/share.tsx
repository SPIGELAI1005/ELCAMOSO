import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useAudition } from "@/lib/drive/useAudition";
import { materializeCustom, type CustomSound } from "@/lib/drive/settings";
import { registerCustomProfiles } from "@/lib/sound/profiles";
import { decodeSharePayload } from "@/lib/sound/share";
import { loadShareFn } from "@/lib/cloud/server-fns";

export const Route = createFileRoute("/share")({
  validateSearch: (search: Record<string, unknown>): { p?: string; c?: string } => {
    const p = typeof search["p"] === "string" ? search["p"] : undefined;
    const c = typeof search["c"] === "string" ? search["c"] : undefined;
    return { ...(p ? { p } : {}), ...(c ? { c } : {}) };
  },
  component: ShareSound,
  head: () => createSeoHeadFromPath("/share"),
});

function ShareSound() {
  const { p, c } = Route.useSearch();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const [sound, setSound] = useState<CustomSound | null>(() => (p ? decodeSharePayload(p) : null));
  const [loading, setLoading] = useState(() => Boolean(c) && !p);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (p) {
        const decoded = decodeSharePayload(p);
        if (!cancelled) {
          setSound(decoded);
          setLoading(false);
        }
        return;
      }
      if (c) {
        setLoading(true);
        const remote = await loadShareFn({ data: { code: c } });
        if (!cancelled) {
          setSound(remote);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setSound(null);
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [p, c]);

  const previewId = sound?.id ?? "shared-preview";
  const profile = sound ? materializeCustom(sound) : null;
  if (sound && profile) {
    registerCustomProfiles([...settings.customSounds.map(materializeCustom), profile]);
  }

  const { active, state, start, stop } = useAudition({
    profileId: previewId,
    volume: settings.volume,
    refreshKey: profile,
    ...(sound?.environmentId ? { environmentId: sound.environmentId } : {}),
    ...(sound?.mix ? { mix: sound.mix } : {}),
  });

  const keep = () => {
    if (!sound) return;
    update({ customSounds: [...settings.customSounds, sound], profileId: sound.id });
    setNote("Saved to your Garage.");
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-lg px-6 pt-16 pb-28 text-center sm:px-10">
        <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Shared sound
        </p>
        {loading ? (
          <>
            <h1 className="mt-4 text-3xl font-light">Opening shared sound</h1>
            <p className="mt-4 text-sm text-muted-foreground">One moment.</p>
          </>
        ) : !sound || !profile ? (
          <>
            <h1 className="mt-4 text-3xl font-light">This link could not be read</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Ask for a fresh share link from Studio or Garage.
            </p>
          </>
        ) : (
          <>
            <ElcamosoMark
              intensity={active ? state.load : 0.4}
              waveResponse={profile.voice.waveResponse}
              className="mx-auto mt-10 h-12 w-auto"
            />
            <h1 className="mt-8 text-3xl font-light">{sound.name}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{profile.description}</p>
            <div className="mt-10 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => (active ? stop() : void start())}
                className="h-14 rounded-full bg-primary text-sm tracking-[0.2em] text-primary-foreground uppercase"
              >
                {active ? "Stop" : "Listen"}
              </button>
              <button
                type="button"
                onClick={keep}
                className="h-14 rounded-full border border-border text-sm tracking-[0.2em] uppercase"
              >
                Save to Garage
              </button>
              <button
                type="button"
                onClick={() => {
                  keep();
                  void navigate({ to: "/drive" });
                }}
                className="h-14 text-xs tracking-[0.2em] text-muted-foreground uppercase"
              >
                Save and drive
              </button>
            </div>
            {note ? <p className="mt-6 text-sm text-muted-foreground">{note}</p> : null}
          </>
        )}
        <Link
          to="/studio"
          className="mt-12 inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase"
        >
          Open Studio
        </Link>
      </div>
    </main>
  );
}
