import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { useAudition } from "@/lib/drive/useAudition";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { LayerMixer } from "@/components/LayerMixer";
import { SnippetStudio } from "@/components/SnippetStudio";
import { DEFAULT_LAYER_MIX, type LayerMix } from "@/lib/sound/environments";
import {
  DEFAULT_TWEAKS,
  materializeCustom,
  type CustomSound,
  type StudioTweaks,
} from "@/lib/drive/settings";
import {
  SOUND_PROFILES,
  getProfile,
  registerCustomProfiles,
} from "@/lib/sound/profiles";

export const Route = createFileRoute("/studio")({
  component: Studio,
  head: () => ({
    meta: [
      { title: "Studio - Design your own EV sound | ELCAMOSO" },
      {
        name: "description",
        content:
          "Shape pitch, brightness, texture and rhythm into your own ELCAMOSO sound, preview it with simulated motion and keep it in your Garage.",
      },
      { property: "og:title", content: "Studio - Design your own EV sound | ELCAMOSO" },
      {
        property: "og:description",
        content: "Shape your own ELCAMOSO sound and keep it in your Garage.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/studio" },
    ],
    links: [{ rel: "canonical", href: "/studio" }],
  }),
});

const PREVIEW_ID = "studio-preview";

function Studio() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const reducedMotion = useReducedMotion();

  const [baseId, setBaseId] = useState(SOUND_PROFILES[0]!.id);
  const [name, setName] = useState("My Sound");
  const [note, setNote] = useState("");
  const [tweaks, setTweaks] = useState<StudioTweaks>(DEFAULT_TWEAKS);
  const [environmentId, setEnvironmentId] = useState(settings.environmentId);
  const [mix, setMix] = useState<LayerMix>(settings.layerMix ?? DEFAULT_LAYER_MIX);
  const [saved, setSaved] = useState<string | null>(null);

  const draft: CustomSound = useMemo(
    () => ({
      id: PREVIEW_ID,
      name,
      baseId,
      createdAt: Date.now(),
      tweaks,
      note,
      environmentId,
      mix,
    }),
    [name, baseId, tweaks, note, environmentId, mix],
  );

  // Register the live draft so the preview engine can resolve it by id.
  const previewProfile = useMemo(() => {
    const profile = materializeCustom(draft);
    registerCustomProfiles([
      ...settings.customSounds.map(materializeCustom),
      profile,
    ]);
    return profile;
  }, [draft, settings.customSounds]);

  const { active, state, start, stop, targetKmh, setTarget } = useAudition({
    profileId: PREVIEW_ID,
    volume: settings.volume,
    refreshKey: previewProfile,
    environmentId,
    mix,
    snippets: settings.snippets,
  });

  const set = (next: Partial<StudioTweaks>) => setTweaks((t) => ({ ...t, ...next }));

  const save = () => {
    const id = `custom-${Date.now().toString(36)}`;
    const sound: CustomSound = { ...draft, id, name: name.trim() || "Untitled sound" };
    update({ customSounds: [...settings.customSounds, sound] });
    setSaved(sound.name);
  };

  const saveAndDrive = () => {
    const id = `custom-${Date.now().toString(36)}`;
    const sound: CustomSound = { ...draft, id, name: name.trim() || "Untitled sound" };
    update({ customSounds: [...settings.customSounds, sound], profileId: id });
    stop();
    void navigate({ to: "/drive" });
  };

  const base = getProfile(baseId);

  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
          Studio
        </p>
        <h1 className="mt-4 text-3xl font-light">Design a sound of your own</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Start from a character you like, then shape it. Everything you hear is generated
          live, so the preview is exactly what you will hear on the road.
        </p>

        <section className="mt-14 border-t border-border pt-8">
          <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Starting character
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {SOUND_PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => setBaseId(p.id)}
                aria-pressed={baseId === p.id}
                className={`h-10 rounded-full border px-5 text-[11px] tracking-[0.16em] uppercase transition-colors ${
                  baseId === p.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{base.description}</p>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <ElcamosoMark
                intensity={active ? state.load : 0.34}
                throttle={active ? state.throttle : 0}
                regen={active ? state.regen : 0}
                waveResponse={previewProfile.voice.waveResponse}
                reducedMotion={reducedMotion}
                className="h-8 w-auto"
              />
              <div>
                <h2 className="text-lg font-light">Live preview</h2>
                <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  {Math.round(state.speed * 3.6)} km/h · simulated motion
                </p>
              </div>
            </div>
            <button
              onClick={() => (active ? stop() : void start())}
              aria-pressed={active}
              className="h-12 rounded-full border border-border px-8 text-xs tracking-[0.24em] uppercase hover:bg-secondary"
            >
              {active ? "Stop" : "Listen"}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={180}
            value={targetKmh}
            onChange={(e) => setTarget(Number(e.target.value))}
            aria-label="Simulated speed"
            className="mt-8 h-px w-full appearance-none bg-border accent-foreground"
          />
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
              Shape
            </h2>
            <button
              onClick={() => setTweaks(DEFAULT_TWEAKS)}
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Reset
            </button>
          </div>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <Dial
              id="s-pitch"
              label="Pitch"
              hint="Lower for weight, higher for urgency"
              min={0.5}
              max={2}
              value={tweaks.pitch}
              onChange={(v) => set({ pitch: v })}
            />
            <Dial
              id="s-brightness"
              label="Brightness"
              hint="How open and forward the sound sits"
              min={0.4}
              max={2}
              value={tweaks.brightness}
              onChange={(v) => set({ brightness: v })}
            />
            <Dial
              id="s-grit"
              label="Grit"
              hint="Air, rasp and mechanical texture"
              min={0}
              max={2}
              value={tweaks.grit}
              onChange={(v) => set({ grit: v })}
            />
            <Dial
              id="s-texture"
              label="Atmosphere"
              hint="Water, gravel and wind beds"
              min={0}
              max={2}
              value={tweaks.texture}
              onChange={(v) => set({ texture: v })}
            />
            <Dial
              id="s-rhythm"
              label="Rhythm"
              hint="Pace of hooves, bells and chuffs"
              min={0}
              max={2}
              value={tweaks.rhythm}
              onChange={(v) => set({ rhythm: v })}
            />
            <Dial
              id="s-character"
              label="Character"
              hint="Spread and looseness of the voice"
              min={0}
              max={2}
              value={tweaks.character}
              onChange={(v) => set({ character: v })}
            />
          </div>
          <label className="mt-10 flex items-center gap-4 text-sm">
            <input
              type="checkbox"
              checked={tweaks.signals}
              onChange={(e) => set({ signals: e.target.checked })}
              className="h-4 w-4 accent-foreground"
            />
            Signature moments (horns, whinnies, laughter)
          </label>
        </section>

        <EnvironmentPicker
          className="mt-12 border-t border-border pt-8"
          value={environmentId}
          onChange={setEnvironmentId}
        />

        <LayerMixer
          className="mt-12 border-t border-border pt-8"
          mix={mix}
          onChange={setMix}
        />

        <SnippetStudio
          className="mt-12 border-t border-border pt-8"
          snippets={settings.snippets}
          onChange={(snippets) => update({ snippets })}
        />

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Name it
          </h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label="Sound name"
            className="mt-6 h-12 w-full border-b border-border bg-transparent text-xl font-light outline-none focus:border-foreground"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={160}
            placeholder="A short description"
            aria-label="Description"
            className="mt-6 h-11 w-full border-b border-border bg-transparent text-sm text-muted-foreground outline-none focus:border-foreground"
          />
          <div className="mt-10 flex flex-wrap gap-4">
            <button
              onClick={save}
              className="h-14 rounded-full border border-border px-10 text-xs tracking-[0.24em] uppercase hover:bg-secondary"
            >
              Save to Garage
            </button>
            <button
              onClick={saveAndDrive}
              className="h-14 rounded-full bg-primary px-10 text-xs tracking-[0.24em] text-primary-foreground uppercase"
            >
              Save and drive
            </button>
          </div>
          {saved ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {saved} is in your{" "}
              <Link to="/garage" className="text-foreground underline underline-offset-4">
                Garage
              </Link>
              .
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Dial({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.toFixed(2)}x
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 h-px w-full appearance-none bg-border accent-foreground"
      />
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
