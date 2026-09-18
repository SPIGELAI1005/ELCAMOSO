import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { isFusionEnabled, listFusionExperiences, listSymphonyExperiences } from "@/lib/experiences";
import {
  getFusionPreset,
  listFusionPresets,
  setRuntimeFusionPresets,
  type FusionPreset,
  type SavedFusionPreset,
} from "@/lib/fusion";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { allProfiles } from "@/lib/sound/profiles";
import { familyForProfile } from "@/lib/sound/realism/families";
import { demoStateAt, demoTotalDurationSec } from "@/lib/symphony";

export const Route = createFileRoute("/fusion")({
  component: FusionPage,
  head: () => createSeoHeadFromPath("/fusion"),
});

function FusionPage() {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const enabled = isFusionEnabled();
  const engines = allProfiles().filter((p) => familyForProfile(p) === "physical");
  const symphonies = listSymphonyExperiences().filter((s) => s.capabilities.profileId);
  const presets = listFusionExperiences();

  const [presetId, setPresetId] = useState(presets[0]?.id ?? "fusion-road-anthem");
  const preset = getFusionPreset(presetId);
  const [engineId, setEngineId] = useState(preset?.machineProfileId ?? "gt-v8");
  const [symphonyId, setSymphonyId] = useState(
    preset?.symphonyProfileId ?? "symphony-cinematic-rock",
  );
  const [mix, setMix] = useState(Math.round((preset?.defaultMix ?? 0.6) * 100));
  const [resonance, setResonance] = useState(Math.round((preset?.harmonicResonance ?? 0.25) * 100));
  const [previewing, setPreviewing] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  useEffect(() => {
    const runtime = settings.savedFusionPresets.map((s): FusionPreset => ({
      id: s.id,
      name: s.name,
      tagline: "Saved Fusion",
      description: "Custom Machine + Music blend from Garage.",
      machineProfileId: s.machineProfileId,
      symphonyProfileId: s.symphonyProfileId,
      defaultMix: s.mix,
      harmonicResonance: s.harmonicResonance,
      softPump: false,
    }));
    setRuntimeFusionPresets(runtime);
  }, [settings.savedFusionPresets]);

  useEffect(() => {
    return () => {
      getSession().setAuditionDriveOverride(null);
    };
  }, []);

  const ensureActiveFusionId = () => {
    const match = listFusionPresets().find(
      (p) => p.machineProfileId === engineId && p.symphonyProfileId === symphonyId,
    );
    if (match) return match.id;
    const id = `fusion-saved-${Date.now().toString(36)}`;
    const entry: SavedFusionPreset = {
      id,
      name: `${engines.find((e) => e.id === engineId)?.name ?? "Machine"} Blend`,
      machineProfileId: engineId,
      symphonyProfileId: symphonyId,
      mix: mix / 100,
      harmonicResonance: resonance / 100,
      createdAt: Date.now(),
    };
    const nextSaved = [...settings.savedFusionPresets, entry].slice(-40);
    update({ savedFusionPresets: nextSaved, profileId: id });
    setRuntimeFusionPresets(
      nextSaved.map((s) => ({
        id: s.id,
        name: s.name,
        tagline: "Saved Fusion",
        description: "Custom Machine + Music blend from Garage.",
        machineProfileId: s.machineProfileId,
        symphonyProfileId: s.symphonyProfileId,
        defaultMix: s.mix,
        harmonicResonance: s.harmonicResonance,
        softPump: false,
      })),
    );
    setPresetId(id);
    return id;
  };

  const applyPreset = (id: string) => {
    const p = getFusionPreset(id);
    if (!p) return;
    setPresetId(id);
    setEngineId(p.machineProfileId);
    setSymphonyId(p.symphonyProfileId);
    setMix(Math.round(p.defaultMix * 100));
    setResonance(Math.round(p.harmonicResonance * 100));
  };

  const startPreview = async () => {
    if (!enabled) return;
    const id = ensureActiveFusionId();
    update({ profileId: id });
    getSession().primeAudioFromUserGesture();
    await getSession().listenProfile(id, 50);
    getSession().setFusionMix(mix / 100);
    getSession().setFusionHarmonicResonance(resonance / 100);
    setPreviewing(true);
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > Math.min(28, demoTotalDurationSec())) {
        stopPreview();
        return;
      }
      getSession().setAuditionDriveOverride(demoStateAt(elapsed));
      getSession().setFusionMix(mix / 100);
      window.setTimeout(tick, 100);
    };
    tick();
  };

  const stopPreview = () => {
    setPreviewing(false);
    getSession().setAuditionDriveOverride(null);
    void getSession().stop();
  };

  const startFusionDrive = () => {
    const id = ensureActiveFusionId();
    update({ profileId: id });
    void navigate({ to: "/drive" });
  };

  const saveToGarage = () => {
    const id = `fusion-saved-${Date.now().toString(36)}`;
    const entry: SavedFusionPreset = {
      id,
      name: `${engines.find((e) => e.id === engineId)?.name ?? "Machine"} + Music`,
      machineProfileId: engineId,
      symphonyProfileId: symphonyId,
      mix: mix / 100,
      harmonicResonance: resonance / 100,
      createdAt: Date.now(),
    };
    const favourites = Array.from(new Set([...settings.experienceFavourites, id, presetId]));
    update({
      savedFusionPresets: [...settings.savedFusionPresets, entry].slice(-40),
      experienceFavourites: favourites,
    });
    setRuntimeFusionPresets([
      ...settings.savedFusionPresets.map((s) => ({
        id: s.id,
        name: s.name,
        tagline: "Saved Fusion",
        description: "Custom Machine + Music blend from Garage.",
        machineProfileId: s.machineProfileId,
        symphonyProfileId: s.symphonyProfileId,
        defaultMix: s.mix,
        harmonicResonance: s.harmonicResonance,
        softPump: false,
      })),
      {
        id: entry.id,
        name: entry.name,
        tagline: "Saved Fusion",
        description: "Custom Machine + Music blend from Garage.",
        machineProfileId: entry.machineProfileId,
        symphonyProfileId: entry.symphonyProfileId,
        defaultMix: entry.mix,
        harmonicResonance: entry.harmonicResonance,
        softPump: false,
      },
    ]);
    setSaveNote("Saved to Garage · Experiences");
    setPresetId(id);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
      <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">Fusion</p>
      <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
        Motion has more than one voice.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Engine and Symphony on one AudioContext - the machine sits inside the arrangement.
      </p>

      {!enabled ? (
        <p className="mt-8 inline-block border border-border px-4 py-2 text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
          Feature preview · Set FUSION_ENABLED=1
        </p>
      ) : null}

      <section className="mt-10">
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Presets</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!enabled}
              onClick={() => applyPreset(p.id)}
              className={`rounded-full border px-4 py-2 text-[10px] tracking-[0.18em] uppercase ${
                presetId === p.id
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-10 border border-border/70 bg-surface-1/20 px-6 py-10">
        <div>
          <label className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Machine
          </label>
          <select
            value={engineId}
            onChange={(e) => setEngineId(e.target.value)}
            disabled={!enabled}
            className="mt-3 w-full border-b border-border bg-transparent py-3 text-lg font-light outline-none disabled:opacity-60"
          >
            {engines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-center text-2xl font-light text-muted-foreground">+</p>

        <div>
          <label className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Music
          </label>
          <select
            value={symphonyId}
            onChange={(e) => setSymphonyId(e.target.value)}
            disabled={!enabled}
            className="mt-3 w-full border-b border-border bg-transparent py-3 text-lg font-light outline-none disabled:opacity-60"
          >
            {symphonies.map((s) => (
              <option key={s.id} value={s.capabilities.profileId!}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            <span>Machine</span>
            <span>Music</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={mix}
            disabled={!enabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMix(v);
              getSession().setFusionMix(v / 100);
            }}
            className="mt-4 w-full accent-foreground disabled:opacity-50"
            aria-label="Machine to music mix"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Default ~40 / 60 with perceptual gain curves.
          </p>
        </div>

        <div>
          <div className="flex justify-between text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            <span>Harmonic resonance</span>
            <span>{resonance}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={resonance}
            disabled={!enabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              setResonance(v);
              getSession().setFusionHarmonicResonance(v / 100);
            }}
            className="mt-4 w-full accent-foreground disabled:opacity-50"
            aria-label="Harmonic resonance depth"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Subtle shared world - not pitch-correcting the engine.
          </p>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        {!previewing ? (
          <button
            type="button"
            disabled={!enabled}
            onClick={() => void startPreview()}
            className="h-12 rounded-full border border-border px-6 text-[10px] tracking-[0.22em] uppercase disabled:opacity-50"
          >
            Preview scenario
          </button>
        ) : (
          <button
            type="button"
            onClick={stopPreview}
            className="h-12 rounded-full border border-foreground px-6 text-[10px] tracking-[0.22em] uppercase"
          >
            Stop preview
          </button>
        )}
        <button
          type="button"
          disabled={!enabled}
          onClick={startFusionDrive}
          className="h-12 rounded-full bg-primary px-6 text-[10px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-50"
        >
          Start Fusion Drive
        </button>
        <button
          type="button"
          disabled={!enabled}
          onClick={saveToGarage}
          className="h-12 rounded-full border border-border px-6 text-[10px] tracking-[0.22em] uppercase disabled:opacity-50"
        >
          Save Fusion to Garage
        </button>
      </div>
      {saveNote ? <p className="mt-4 text-sm text-muted-foreground">{saveNote}</p> : null}

      <p className="mt-12 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        <Link to="/explore" className="hover:text-foreground">
          Back to Explore
        </Link>
      </p>
    </main>
  );
}
