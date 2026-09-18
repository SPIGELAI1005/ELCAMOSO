import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
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
import { getSession, type DemoControls } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { chromeStickyTopClass, isLiveSessionStatus } from "@/lib/ui/chrome";
import {
  BASIC_FEEL_SLIDERS,
  applyBasicFeel,
  basicFeelFromTuning,
  type StudioBasicKey,
} from "@/lib/drive/studio-basic";
import { StudioSymphonyPanel } from "@/components/studio/StudioSymphonyPanel";
import { StudioFusionPanel } from "@/components/studio/StudioFusionPanel";
import { DrivingInteractionGate } from "@/components/DrivingInteractionGate";
import {
  DEFAULT_FUSION_PARAMS,
  DEFAULT_SYMPHONY_PARAMS,
  effectiveFusionMix,
  decodeExperiencePresetShare,
  setRuntimeFusionParams,
  setRuntimeSymphonyParams,
  studioPromptToParams,
  type ExperiencePreset,
  type FusionStudioParams,
  type StudioMode,
  type SymphonyStudioParams,
} from "@/lib/studio";
import { setRuntimeFusionPresets } from "@/lib/fusion";

export const Route = createFileRoute("/studio")({
  component: Studio,
  head: () => createSeoHeadFromPath("/studio"),
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["experience"] === "string" && search["experience"].length <= 16_000
      ? { experience: search["experience"] }
      : {}),
  }),
});

const PREVIEW_ID = "studio-preview";

type PreviewPresetId = "idle" | "accelerate" | "cruise" | "decelerate";

const PREVIEW_PRESETS: {
  id: PreviewPresetId;
  label: string;
  kmh: number;
  demo: Partial<DemoControls>;
}[] = [
  { id: "idle", label: "Idle", kmh: 0, demo: { selector: "D", throttle: 0, accel: 0, regen: 0 } },
  {
    id: "accelerate",
    label: "Accelerate",
    kmh: 110,
    demo: { selector: "D", throttle: 0.9, accel: 0.85, regen: 0 },
  },
  {
    id: "cruise",
    label: "Cruise",
    kmh: 90,
    demo: { selector: "D", throttle: 0.28, accel: 0.2, regen: 0 },
  },
  {
    id: "decelerate",
    label: "Decelerate",
    kmh: 25,
    demo: { selector: "D", throttle: 0.05, accel: 0.1, regen: 0.75 },
  },
];

function Studio() {
  const navigate = useNavigate();
  const { experience: sharedExperience } = Route.useSearch();
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
  const [previewPreset, setPreviewPreset] = useState<PreviewPresetId>("cruise");
  const [studioMode, setStudioMode] = useState<StudioMode>("sound");
  const [symphonyPackId, setSymphonyPackId] = useState("symphony-cinematic-rock");
  const [symphonyParams, setSymphonyParams] =
    useState<SymphonyStudioParams>(DEFAULT_SYMPHONY_PARAMS);
  const [fusionParams, setFusionParams] = useState<FusionStudioParams>(DEFAULT_FUSION_PARAMS);
  const [expSaved, setExpSaved] = useState<string | null>(null);
  const [sideB, setSideB] = useState<{
    tweaks: StudioTweaks;
    mix: LayerMix;
    environmentId: string;
  } | null>(null);
  const past = useRef<{ tweaks: StudioTweaks; mix: LayerMix; environmentId: string }[]>([]);
  const future = useRef<{ tweaks: StudioTweaks; mix: LayerMix; environmentId: string }[]>([]);
  const importedShareRef = useRef<string | null>(null);
  const sessionSnap = useSessionStore();
  const ab = sessionSnap.ab;
  const basicFeel = useMemo(() => basicFeelFromTuning(tweaks, mix), [tweaks, mix]);

  useEffect(() => {
    if (!sharedExperience || importedShareRef.current === sharedExperience) return;
    importedShareRef.current = sharedExperience;
    const preset = decodeExperiencePresetShare(sharedExperience);
    if (!preset) {
      setPromptNote("This shared Experience Preset is invalid or from an unsupported version.");
      return;
    }
    setStudioMode(preset.kind);
    setName(preset.name);
    setNote(preset.note ?? "");
    if (preset.kind === "symphony" && preset.symphonyPackId && preset.symphonyParams) {
      setSymphonyPackId(preset.symphonyPackId);
      setSymphonyParams(preset.symphonyParams);
    } else if (preset.kind === "fusion" && preset.fusionParams) {
      setFusionParams(preset.fusionParams);
    } else if (preset.kind === "sound") {
      setBaseId(preset.baseProfileId ?? preset.soundId ?? SOUND_PROFILES[0]!.id);
    }
    setPromptNote(`Shared ${preset.name} loaded. Review it, then save your own copy.`);
  }, [sharedExperience]);

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

  const setBasic = (key: StudioBasicKey, value: number) => {
    pushHistory();
    const next = applyBasicFeel(key, value, tweaks, mix);
    setTweaks(next.tweaks);
    setMix(next.mix);
  };

  const runPreviewPreset = (id: PreviewPresetId) => {
    const preset = PREVIEW_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPreviewPreset(id);
    const session = getSession();
    session.setAuditionKmh(preset.kmh);
    session.setDemo(preset.demo);
    setTarget(preset.kmh);
    if (!active) {
      trackEvent("studio_listen", { baseId, via: "preview_preset" });
      void start();
    }
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
    // Local deterministic parse first - never sends drive telemetry.
    const local = studioPromptToParams(prompt);
    if (local.mode === "symphony" && local.symphonyParams) {
      setStudioMode("symphony");
      setName(local.name);
      setNote(local.description);
      if (local.symphonyPackId) setSymphonyPackId(local.symphonyPackId);
      setSymphonyParams(local.symphonyParams);
      setPromptNote("Arrangement parameters from your description - not generative music.");
      return;
    }
    if (local.mode === "fusion" && local.fusionParams) {
      setStudioMode("fusion");
      setName(local.name);
      setNote(local.description);
      setFusionParams(local.fusionParams);
      setPromptNote("Fusion balance from your description - parameter config only.");
      return;
    }
    // Sound mode: try server recipe when configured, else local recipe.
    try {
      const recipe = await promptToSoundFn({ data: { prompt } });
      pushHistory();
      setStudioMode("sound");
      setName(recipe.name);
      setNote(recipe.description);
      setBaseId(recipe.baseId);
      setTweaks(recipe.tweaks);
      setEnvironmentId(recipe.environmentId);
      setMix(recipe.mix);
      setPromptNote("Sound recipe applied. Preview it, then keep shaping.");
    } catch {
      if (local.sound) {
        pushHistory();
        setStudioMode("sound");
        setName(local.sound.name);
        setNote(local.sound.description);
        setBaseId(local.sound.baseId);
        setTweaks(local.sound.tweaks);
        setEnvironmentId(local.sound.environmentId);
        setMix(local.sound.mix);
        setPromptNote("Local keyword recipe (AI provider unavailable).");
      }
    }
  };

  const saveSymphonyPreset = () => {
    const id = `exp-symphony-${Date.now().toString(36)}`;
    const preset: ExperiencePreset = {
      id,
      kind: "symphony",
      name: name.trim() || "Symphony preset",
      createdAt: Date.now(),
      symphonyPackId,
      symphonyParams,
      baseProfileId: symphonyPackId,
    };
    if (note) preset.note = note;
    update({
      experiencePresets: [...(settings.experiencePresets ?? []), preset].slice(-60),
      experienceFavourites: Array.from(
        new Set([...(settings.experienceFavourites ?? []), id]),
      ).slice(0, 80),
      profileId: symphonyPackId,
    });
    setRuntimeSymphonyParams(symphonyPackId, symphonyParams);
    setExpSaved(preset.name);
  };

  const saveFusionPreset = () => {
    const id = `fusion-studio-${Date.now().toString(36)}`;
    const preset: ExperiencePreset = {
      id,
      kind: "fusion",
      name: name.trim() || "Fusion preset",
      createdAt: Date.now(),
      fusionParams,
      baseProfileId: id,
    };
    if (note) preset.note = note;
    const saved = {
      id,
      name: preset.name,
      machineProfileId: fusionParams.machineProfileId,
      symphonyProfileId: fusionParams.symphonyProfileId,
      mix: effectiveFusionMix(fusionParams),
      harmonicResonance: fusionParams.harmonicResonance,
      createdAt: Date.now(),
    };
    setRuntimeFusionPresets([
      ...(settings.savedFusionPresets ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        tagline: "Saved Fusion",
        description: "Garage Fusion",
        machineProfileId: s.machineProfileId,
        symphonyProfileId: s.symphonyProfileId,
        defaultMix: s.mix,
        harmonicResonance: s.harmonicResonance,
        softPump: false,
      })),
      {
        id,
        name: preset.name,
        tagline: "Studio Fusion",
        description: note || "Studio Fusion preset",
        machineProfileId: fusionParams.machineProfileId,
        symphonyProfileId: fusionParams.symphonyProfileId,
        defaultMix: effectiveFusionMix(fusionParams),
        harmonicResonance: fusionParams.harmonicResonance,
        softPump: false,
      },
    ]);
    update({
      experiencePresets: [...(settings.experiencePresets ?? []), preset].slice(-60),
      savedFusionPresets: [...(settings.savedFusionPresets ?? []), saved].slice(-40),
      experienceFavourites: Array.from(
        new Set([...(settings.experienceFavourites ?? []), id]),
      ).slice(0, 80),
      profileId: id,
    });
    setRuntimeFusionParams(id, fusionParams);
    setExpSaved(preset.name);
  };

  const startVoice = () => {
    const w = window as Window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult:
          | ((ev: { results: { [n: number]: { [n: number]: { transcript: string } } } }) => void)
          | null;
        start: () => void;
      };
      SpeechRecognition?: new () => {
        lang: string;
        onresult:
          | ((ev: { results: { [n: number]: { [n: number]: { transcript: string } } } }) => void)
          | null;
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
  const modes: { id: StudioMode; label: string }[] = [
    { id: "sound", label: "Sound" },
    { id: "symphony", label: "Symphony" },
    { id: "fusion", label: "Fusion" },
  ];

  return (
    <DrivingInteractionGate surface="studio">
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-28 sm:px-10 sm:pt-16">
          <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">Studio</p>
          <h1 className="mt-4 text-3xl font-light">Make it yours.</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Sound, Symphony, or Fusion - simple, premium, immediate. Not a DAW.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setStudioMode(m.id)}
                className={`rounded-full border px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase ${
                  studioMode === m.id
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <section className="mt-8 border border-border/60 px-5 py-5">
            <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Describe
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Parameter configuration from words - not real-time generative music. Telemetry is
              never sent.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder='e.g. "cinematic rock that stays calm during cruising but explodes under strong acceleration"'
              className="mt-4 w-full resize-none border-b border-border bg-transparent py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void applyPrompt()}
              className="mt-4 h-10 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase"
            >
              Apply description
            </button>
            {promptNote ? <p className="mt-3 text-xs text-muted-foreground">{promptNote}</p> : null}
          </section>

          {studioMode === "symphony" ? (
            <StudioSymphonyPanel
              name={name}
              onNameChange={setName}
              packId={symphonyPackId}
              onPackChange={setSymphonyPackId}
              params={symphonyParams}
              onParamsChange={setSymphonyParams}
              onSave={saveSymphonyPreset}
              savedNote={expSaved}
            />
          ) : null}

          {studioMode === "fusion" ? (
            <StudioFusionPanel
              name={name}
              onNameChange={setName}
              params={fusionParams}
              onParamsChange={setFusionParams}
              onSave={saveFusionPreset}
              savedNote={expSaved}
            />
          ) : null}

          {studioMode === "sound" ? (
            <>
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
                      <p className="truncate text-sm font-light">
                        {name.trim() || "Untitled sound"}
                      </p>
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
                <div className="mt-5 flex flex-wrap gap-2">
                  {PREVIEW_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => runPreviewPreset(preset.id)}
                      aria-pressed={previewPreset === preset.id}
                      className={`h-9 rounded-full border px-4 text-[10px] tracking-[0.16em] uppercase ${
                        previewPreset === preset.id
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={targetKmh}
                  onChange={(e) => {
                    setPreviewPreset("cruise");
                    setTarget(Number(e.target.value));
                  }}
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

              <section className="mt-12" aria-label="Basic feel">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                    Basic
                  </h2>
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
                      onClick={() => {
                        pushHistory();
                        setTweaks(DEFAULT_TWEAKS);
                        setMix(DEFAULT_LAYER_MIX);
                      }}
                      className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="mt-8 grid gap-10 sm:grid-cols-2">
                  {BASIC_FEEL_SLIDERS.map((slider) => (
                    <FeelSlider
                      key={slider.key}
                      id={`basic-${slider.key}`}
                      label={slider.label}
                      left={slider.left}
                      right={slider.right}
                      value={basicFeel[slider.key]}
                      onChange={(v) => setBasic(slider.key, v)}
                    />
                  ))}
                </div>
              </section>

              <Accordion type="single" collapsible className="mt-14 border-t border-border">
                <AccordionItem value="advanced" className="border-border">
                  <AccordionTrigger className="py-6 hover:no-underline">
                    <span className="text-base font-light tracking-normal normal-case">
                      Advanced
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <Accordion
                      type="single"
                      collapsible
                      defaultValue="shape"
                      className="border-t border-border"
                    >
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
                              Describe a mood. The recipe fills the dials above so you can keep
                              shaping.
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
                              <Link
                                to="/garage"
                                className="text-foreground underline underline-offset-4"
                              >
                                Garage
                              </Link>
                              .
                            </p>
                          ) : null}
                          {shareNote ? (
                            <p className="mt-4 text-sm text-muted-foreground">{shareNote}</p>
                          ) : null}

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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : null}
        </div>
      </main>
    </DrivingInteractionGate>
  );
}

function WorkspaceLabel({ step, title, hint }: { step: string; title: string; hint: string }) {
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

function FeelSlider({
  id,
  label,
  left,
  right,
  value,
  onChange,
}: {
  id: string;
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <div className="mt-3 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 slider h-11 w-full"
      />
    </div>
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
