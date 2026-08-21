import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { useAudition } from "@/lib/drive/useAudition";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { LayerMixer } from "@/components/LayerMixer";
import { SnippetStudio } from "@/components/SnippetStudio";
import { DEFAULT_LAYER_MIX, type LayerMix } from "@/lib/sound/environments";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DEFAULT_TWEAKS,
  materializeCustom,
  type CustomSound,
  type StudioPreset,
  type StudioTweaks,
} from "@/lib/drive/settings";
import {
  PROFILE_CATEGORIES,
  SOUND_PROFILES,
  getProfile,
  registerCustomProfiles,
} from "@/lib/sound/profiles";
import { promptToSoundFn } from "@/lib/cloud/server-fns";
import { nameFromTweaks } from "@/lib/sound/recipes";
import { AudioPerfMeter } from "@/components/AudioPerfMeter";
import { ProfileRulesEditor } from "@/components/ProfileRulesEditor";
import { copyShareLink } from "@/lib/sound/share";
import { trackEvent } from "@/lib/telemetry/analytics";
import type { ProfileRule } from "@/lib/drive/rules";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { chromeStickyTopClass, isLiveSessionStatus } from "@/lib/ui/chrome";

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
  const [rules, setRules] = useState<ProfileRule[]>([]);
  const [takeLabel, setTakeLabel] = useState("");
  const [familyId, setFamilyId] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptNote, setPromptNote] = useState<string | null>(null);
  const [sideB, setSideB] = useState<{
    tweaks: StudioTweaks;
    mix: LayerMix;
    environmentId: string;
  } | null>(null);
  const past = useRef<{ tweaks: StudioTweaks; mix: LayerMix; environmentId: string }[]>([]);
  const future = useRef<{ tweaks: StudioTweaks; mix: LayerMix; environmentId: string }[]>([]);
  const sessionSnap = useSessionStore();
  const ab = sessionSnap.ab;

  const pushHistory = () => {
    past.current = [...past.current, { tweaks, mix, environmentId }].slice(-50);
    future.current = [];
  };

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ tweaks, mix, environmentId });
    setTweaks(prev.tweaks);
    setMix(prev.mix);
    setEnvironmentId(prev.environmentId);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ tweaks, mix, environmentId });
    setTweaks(next.tweaks);
    setMix(next.mix);
    setEnvironmentId(next.environmentId);
  };

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
      rules,
      ...(familyId ? { familyId } : {}),
      ...(takeLabel.trim() ? { takeLabel: takeLabel.trim() } : {}),
    }),
    [name, baseId, tweaks, note, environmentId, mix, rules, familyId, takeLabel],
  );

  const previewProfile = useMemo(() => {
    const profile = materializeCustom(draft);
    const profiles = [...settings.customSounds.map(materializeCustom), profile];
    if (sideB) {
      profiles.push(
        materializeCustom({
          ...draft,
          id: `${PREVIEW_ID}-b`,
          name: `${name} B`,
          tweaks: sideB.tweaks,
          mix: sideB.mix,
          environmentId: sideB.environmentId,
        }),
      );
    }
    registerCustomProfiles(profiles);
    return profile;
  }, [draft, settings.customSounds, sideB, name]);

  const { active, state, start, stop, targetKmh, setTarget, perf } = useAudition({
    profileId: PREVIEW_ID,
    volume: settings.volume,
    refreshKey: previewProfile,
    environmentId,
    mix,
    snippets: settings.snippets,
  });

  const captureSideB = () => {
    setSideB({ tweaks, mix, environmentId });
  };

  const startStudioAb = async () => {
    const b = sideB ?? { tweaks, mix, environmentId };
    if (!sideB) setSideB(b);
    const bId = `${PREVIEW_ID}-b`;
    registerCustomProfiles([
      ...settings.customSounds.map(materializeCustom),
      materializeCustom(draft),
      materializeCustom({
        ...draft,
        id: bId,
        name: `${name} B`,
        tweaks: b.tweaks,
        mix: b.mix,
        environmentId: b.environmentId,
      }),
    ]);
    await getSession().startAb(PREVIEW_ID, bId);
  };

  const set = (next: Partial<StudioTweaks>) => {
    pushHistory();
    setTweaks((t) => ({ ...t, ...next }));
  };

  const save = () => {
    const id = `custom-${Date.now().toString(36)}`;
    const sound: CustomSound = {
      ...draft,
      id,
      name: name.trim() || "Untitled sound",
      familyId: familyId ?? id,
      rules,
    };
    update({ customSounds: [...settings.customSounds, sound] });
    setFamilyId(sound.familyId);
    setSaved(sound.name);
    setShareNote(null);
  };

  const saveAndDrive = () => {
    const id = `custom-${Date.now().toString(36)}`;
    const sound: CustomSound = {
      ...draft,
      id,
      name: name.trim() || "Untitled sound",
      familyId: familyId ?? id,
      rules,
    };
    update({ customSounds: [...settings.customSounds, sound], profileId: id });
    stop();
    void navigate({ to: "/drive" });
  };

  const saveAsTake = () => {
    const id = `custom-${Date.now().toString(36)}`;
    const family = familyId ?? id;
    const sound: CustomSound = {
      ...draft,
      id,
      name: name.trim() || "Untitled sound",
      familyId: family,
      takeLabel: takeLabel.trim() || "Take",
      rules,
    };
    update({ customSounds: [...settings.customSounds, sound] });
    setFamilyId(family);
    setSaved(`${sound.name} (${sound.takeLabel})`);
  };

  const applyPrompt = async () => {
    const recipe = await promptToSoundFn({ data: { prompt } });
    pushHistory();
    setName(recipe.name);
    setNote(recipe.description);
    setBaseId(recipe.baseId);
    setTweaks(recipe.tweaks);
    setEnvironmentId(recipe.environmentId);
    setMix(recipe.mix);
    setPromptNote("Recipe loaded. Listen, then save if you want it.");
  };

  const startVoice = () => {
    const w = window as Window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: ((ev: {
          results: { [n: number]: { [n: number]: { transcript: string } } };
        }) => void) | null;
        start: () => void;
      };
      SpeechRecognition?: new () => {
        lang: string;
        onresult: ((ev: {
          results: { [n: number]: { [n: number]: { transcript: string } } };
        }) => void) | null;
        start: () => void;
      };
    };
    const Speech = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Speech) {
      setPromptNote("Voice input is not available on this device.");
      return;
    }
    const rec = new Speech();
    rec.lang =
      settings.language === "de" ? "de-DE" : settings.language === "ro" ? "ro-RO" : "en-GB";
    rec.onresult = (event) => {
      setPrompt(event.results[0]?.[0]?.transcript ?? "");
    };
    rec.start();
  };

  const base = getProfile(baseId);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-28 sm:px-10 sm:pt-16">
        <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">Studio</p>
        <h1 className="mt-4 text-3xl font-light">Design a sound of your own</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Pick a starting character, shape it while you Listen, then keep it in your Garage.
        </p>

        {/* Sticky listen strip under BrandNav (+ MiniPlayer when live). */}
        <section
          className={`sticky z-30 mt-10 border border-border bg-background/95 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6 ${chromeStickyTopClass(isLiveSessionStatus(sessionSnap.status))}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <ElcamosoMark
                intensity={active ? state.load : 0.34}
                throttle={active ? state.throttle : 0}
                regen={active ? state.regen : 0}
                waveResponse={previewProfile.voice.waveResponse}
                reducedMotion={reducedMotion}
                className="h-7 w-auto shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-light">{name.trim() || "Untitled sound"}</p>
                <p className="mt-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  {Math.round(state.speed * 3.6)} km/h · {base.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (active) stop();
                else {
                  trackEvent("studio_listen", { baseId });
                  void start();
                }
              }}
              aria-pressed={active}
              className="h-11 rounded-full border border-border px-7 text-[11px] tracking-[0.22em] uppercase hover:bg-secondary"
            >
              {active ? "Stop" : "Listen"}
            </button>
            {baseId === "submarine" ? (
              <button
                type="button"
                disabled={!active}
                onClick={() => getSession().triggerLayer("sonar")}
                className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.22em] uppercase text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Sonar ping
              </button>
            ) : null}
          </div>
          <input
            type="range"
            min={0}
            max={180}
            value={targetKmh}
            onChange={(e) => setTarget(Number(e.target.value))}
            aria-label="Simulated speed"
            className="mt-5 slider h-10 w-full"
          />
          <AudioPerfMeter perf={perf} active={active} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={captureSideB}
              className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground"
            >
              Store B
            </button>
            <button
              type="button"
              onClick={() => void startStudioAb()}
              className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground"
            >
              A / B
            </button>
            {ab ? (
              <button
                type="button"
                onClick={() => getSession().flipAb()}
                className="h-9 rounded-full border border-foreground px-4 text-[10px] tracking-[0.16em] uppercase"
              >
                Flip {ab.active === "a" ? "B" : "A"}
              </button>
            ) : null}
          </div>
        </section>

        <Accordion type="single" collapsible defaultValue="shape" className="mt-6 border-t border-border">
          {/* 1 · Shape */}
          <AccordionItem value="shape" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <WorkspaceLabel step="01" title="Shape" hint="Character and dials" />
            </AccordionTrigger>
            <AccordionContent className="pb-10">
              <label className="block text-sm" htmlFor="studio-base">
                Starting character
              </label>
              <select
                id="studio-base"
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                className="mt-3 h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-foreground"
              >
                {PROFILE_CATEGORIES.filter((c) => c !== "Garage").map((category) => {
                  const items = SOUND_PROFILES.filter((p) => p.category === category);
                  if (!items.length) return null;
                  return (
                    <optgroup key={category} label={category}>
                      {items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <p className="mt-3 text-sm text-muted-foreground">{base.description}</p>

              <div className="mt-10 flex items-baseline justify-between gap-4">
                <h3 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                  Dials
                </h3>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={undo}
                    className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                  >
                    Redo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTweaks(DEFAULT_TWEAKS)}
                    className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-8 sm:grid-cols-2">
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

              <label className="mt-8 flex items-center gap-4 text-sm">
                <input
                  type="checkbox"
                  checked={tweaks.signals}
                  onChange={(e) => set({ signals: e.target.checked })}
                  className="h-4 w-4 accent-foreground"
                />
                Signature moments (horns, whinnies, laughter)
              </label>

              <div className="mt-12 border-t border-border pt-8">
                <h3 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                  Or start from a feel
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  Describe a mood. The recipe fills the dials above so you can keep shaping.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  aria-label="Sound prompt"
                  className="mt-5 min-h-20 w-full border border-border bg-transparent p-4 text-sm outline-none focus:border-foreground"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void applyPrompt()}
                    className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                  >
                    Make recipe
                  </button>
                  <button
                    type="button"
                    onClick={startVoice}
                    className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => setName(nameFromTweaks(tweaks, base.name))}
                    className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.16em] uppercase"
                  >
                    Suggest name
                  </button>
                </div>
                {promptNote ? (
                  <p className="mt-4 text-sm text-muted-foreground">{promptNote}</p>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2 · Mix */}
          <AccordionItem value="mix" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <WorkspaceLabel step="02" title="Mix" hint="Space and layers" />
            </AccordionTrigger>
            <AccordionContent className="pb-10">
              <EnvironmentPicker value={environmentId} onChange={setEnvironmentId} />
              <LayerMixer
                className="mt-12 border-t border-border pt-8"
                mix={mix}
                onChange={(next) => {
                  pushHistory();
                  setMix(next);
                }}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 3 · Capture */}
          <AccordionItem value="capture" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <WorkspaceLabel step="03" title="Capture" hint="Snippets and triggers" />
            </AccordionTrigger>
            <AccordionContent className="pb-10">
              <SnippetStudio
                snippets={settings.snippets}
                onChange={(snippets) => update({ snippets })}
              />
              <div className="mt-12 border-t border-border pt-8">
                <ProfileRulesEditor
                  rules={rules}
                  snippets={settings.snippets}
                  onChange={setRules}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4 · Keep */}
          <AccordionItem value="keep" className="border-border">
            <AccordionTrigger className="py-6 hover:no-underline">
              <WorkspaceLabel step="04" title="Keep" hint="Name, save, share" />
            </AccordionTrigger>
            <AccordionContent className="pb-10">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                aria-label="Sound name"
                placeholder="Sound name"
                className="h-12 w-full border-b border-border bg-transparent text-xl font-light outline-none focus:border-foreground"
              />
              <input
                value={takeLabel}
                onChange={(e) => setTakeLabel(e.target.value)}
                maxLength={24}
                placeholder="Take label, e.g. Wet or Night"
                aria-label="Take label"
                className="mt-6 h-11 w-full border-b border-border bg-transparent text-sm text-muted-foreground outline-none focus:border-foreground"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={160}
                placeholder="A short description"
                aria-label="Description"
                className="mt-6 h-11 w-full border-b border-border bg-transparent text-sm text-muted-foreground outline-none focus:border-foreground"
              />

              <div className="mt-10 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveAndDrive}
                  className="h-12 rounded-full bg-primary px-8 text-[11px] tracking-[0.22em] text-primary-foreground uppercase"
                >
                  Save and drive
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="h-12 rounded-full border border-border px-8 text-[11px] tracking-[0.22em] uppercase hover:bg-secondary"
                >
                  Save to Garage
                </button>
                <button
                  type="button"
                  onClick={saveAsTake}
                  className="h-12 rounded-full border border-border px-6 text-[11px] tracking-[0.22em] uppercase text-muted-foreground hover:text-foreground"
                >
                  Save as take
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const sound: CustomSound = {
                      ...draft,
                      id: `share-${Date.now().toString(36)}`,
                      name: name.trim() || "Untitled sound",
                    };
                    await copyShareLink(sound);
                    trackEvent("share_create", { via: "studio" });
                    setShareNote(
                      typeof navigator.share === "function"
                        ? "Share sheet opened. Anyone with the link can Listen in the browser."
                        : "Link copied. Anyone with it can Listen in the browser.",
                    );
                  }}
                  className="h-12 rounded-full border border-border px-6 text-[11px] tracking-[0.22em] uppercase text-muted-foreground hover:text-foreground"
                >
                  Share link
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
              {shareNote ? <p className="mt-4 text-sm text-muted-foreground">{shareNote}</p> : null}

              <div className="mt-12 border-t border-border pt-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                    Studio presets
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const preset: StudioPreset = {
                        id: `preset-${Date.now()}`,
                        name: name.trim() || "Studio preset",
                        createdAt: Date.now(),
                        tweaks,
                        mix,
                        environmentId,
                      };
                      update({
                        studioPresets: [...settings.studioPresets, preset].slice(-50),
                      });
                      trackEvent("studio_preset_save");
                    }}
                    className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                  >
                    Save current
                  </button>
                </div>
                {settings.studioPresets.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {settings.studioPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          pushHistory();
                          setTweaks(preset.tweaks);
                          setMix(preset.mix);
                          setEnvironmentId(preset.environmentId);
                          setName(preset.name);
                        }}
                        className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.16em] uppercase"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No presets yet. Save the current dials and mix to reuse later.
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </main>
  );
}

function WorkspaceLabel({
  step,
  title,
  hint,
}: {
  step: string;
  title: string;
  hint: string;
}) {
  return (
    <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-baseline sm:gap-5">
      <span className="text-[10px] tracking-[0.28em] text-muted-foreground tabular-nums">
        {step}
      </span>
      <span className="text-base font-light tracking-normal normal-case">{title}</span>
      <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">
        {hint}
      </span>
    </span>
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
        <span className="text-xs text-muted-foreground tabular-nums">{value.toFixed(2)}x</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 slider h-11 w-full"
      />
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
