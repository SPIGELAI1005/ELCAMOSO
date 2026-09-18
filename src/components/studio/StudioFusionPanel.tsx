import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getSession } from "@/lib/drive/session";
import { allProfiles } from "@/lib/sound/profiles";
import { familyForProfile } from "@/lib/sound/realism/families";
import { listSymphonyPacks } from "@/lib/symphony";
import {
  DEFAULT_FUSION_PARAMS,
  STUDIO_DEMO_TRACES,
  effectiveFusionMix,
  normalizeFusionParams,
  setRuntimeFusionParams,
  setRuntimeSymphonyParams,
  studioDemoStateAt,
  type DemoDriveId,
  type FusionStudioParams,
} from "@/lib/studio";
import { setFusionStudioPreview } from "@/lib/fusion";
import { getCustomProfiles, registerCustomProfiles, type SoundProfile } from "@/lib/sound/profiles";

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
      <div className="flex justify-between text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        <label htmlFor={id}>{label}</label>
        <span>
          {left} · {right}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mt-3 w-full accent-foreground"
      />
    </div>
  );
}

const PREVIEW_FUSION_ID = "fusion-studio-preview";

function previewSoundProfile(name: string): SoundProfile {
  return {
    id: PREVIEW_FUSION_ID,
    name: name || "Studio Fusion",
    category: "Musical",
    traits: ["Fusion", "Machine", "Music"],
    description: "Temporary Studio Fusion preview.",
    drivetrainMode: "continuous",
    motionModel: "ambient",
    sourceMode: "hybrid",
    access: "free",
    voice: {
      baseFrequency: 100,
      harmonics: [1],
      waveResponse: 0.5,
      filterBase: 400,
      filterRange: 800,
      noise: 0,
      wave: "sine",
      detune: 0,
      coreLevel: 0.5,
    },
  };
}

export function StudioFusionPanel({
  name,
  onNameChange,
  params,
  onParamsChange,
  onSave,
  savedNote,
}: {
  name: string;
  onNameChange: (v: string) => void;
  params: FusionStudioParams;
  onParamsChange: (next: FusionStudioParams) => void;
  onSave: () => void;
  savedNote: string | null;
}) {
  const engines = allProfiles().filter((p) => familyForProfile(p) === "physical");
  const symphonies = listSymphonyPacks();
  const [demoId, setDemoId] = useState<DemoDriveId>("highway");
  const [listening, setListening] = useState(false);
  const timer = useRef<number | null>(null);
  const startRef = useRef(0);

  const registerPreview = (p: FusionStudioParams) => {
    const others = getCustomProfiles().filter((x) => x.id !== PREVIEW_FUSION_ID);
    registerCustomProfiles([...others, previewSoundProfile(name)]);
    setFusionStudioPreview({
      id: PREVIEW_FUSION_ID,
      name: name || "Studio Fusion",
      tagline: "Studio preview",
      description: "Temporary Studio Fusion preview.",
      machineProfileId: p.machineProfileId,
      symphonyProfileId: p.symphonyProfileId,
      defaultMix: effectiveFusionMix(p),
      harmonicResonance: p.harmonicResonance,
      softPump: false,
    });
    setRuntimeFusionParams(PREVIEW_FUSION_ID, p);
    setRuntimeSymphonyParams(p.symphonyProfileId, null);
  };

  useEffect(() => {
    registerPreview(params);
    return () => {
      setRuntimeFusionParams(PREVIEW_FUSION_ID, null);
      setFusionStudioPreview(null);
      registerCustomProfiles(getCustomProfiles().filter((x) => x.id !== PREVIEW_FUSION_ID));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, name]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      getSession().setAuditionDriveOverride(null);
    };
  }, []);

  const stopDemo = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setListening(false);
    getSession().setAuditionDriveOverride(null);
    void getSession().stop();
  };

  const startDemo = async () => {
    stopDemo();
    registerPreview(params);
    getSession().primeAudioFromUserGesture();
    await getSession().listenProfile(PREVIEW_FUSION_ID, 50);
    getSession().setFusionMix(effectiveFusionMix(params));
    getSession().setFusionHarmonicResonance(params.harmonicResonance);
    setListening(true);
    startRef.current = performance.now();
    timer.current = window.setInterval(() => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      getSession().setAuditionDriveOverride(studioDemoStateAt(demoId, elapsed));
      getSession().setFusionMix(effectiveFusionMix(params));
    }, 100);
  };

  const set = (partial: Partial<FusionStudioParams>) => {
    onParamsChange(normalizeFusionParams({ ...params, ...partial }));
  };

  return (
    <div className="mt-10 space-y-12">
      <div>
        <label className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-3 w-full border-b border-border bg-transparent py-3 text-xl font-light outline-none"
        />
      </div>

      <div>
        <label className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Machine
        </label>
        <select
          value={params.machineProfileId}
          onChange={(e) => set({ machineProfileId: e.target.value })}
          className="mt-3 w-full border-b border-border bg-transparent py-3 text-lg font-light outline-none"
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
          Symphony
        </label>
        <select
          value={params.symphonyProfileId}
          onChange={(e) => set({ symphonyProfileId: e.target.value })}
          className="mt-3 w-full border-b border-border bg-transparent py-3 text-lg font-light outline-none"
        >
          {symphonies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
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
          value={Math.round(params.mix * 100)}
          onChange={(e) => set({ mix: Number(e.target.value) / 100 })}
          className="mt-4 w-full accent-foreground"
        />
      </div>

      <section className="border border-border/70 bg-surface-1/20 px-5 py-6">
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Demo drive</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STUDIO_DEMO_TRACES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDemoId(t.id)}
              className={`rounded-full border px-4 py-2 text-[10px] tracking-[0.18em] uppercase ${
                demoId === t.id
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void (listening ? stopDemo() : startDemo())}
          className="mt-5 h-11 rounded-full bg-primary px-6 text-[10px] tracking-[0.2em] text-primary-foreground uppercase"
        >
          {listening ? "Stop" : "Listen"}
        </button>
      </section>

      <Accordion type="single" collapsible className="border-t border-border">
        <AccordionItem value="advanced" className="border-border">
          <AccordionTrigger className="py-6 hover:no-underline">
            <span className="text-base font-light tracking-normal normal-case">Advanced</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-8 pb-8">
            <FeelSlider
              id="fus-presence"
              label="Machine presence"
              left="Recessed"
              right="Forward"
              value={params.machinePresence}
              onChange={(v) => set({ machinePresence: v })}
            />
            <FeelSlider
              id="fus-music"
              label="Music energy"
              left="Soft"
              right="Bold"
              value={params.musicEnergy}
              onChange={(v) => set({ musicEnergy: v })}
            />
            <FeelSlider
              id="fus-shift"
              label="Shift emphasis"
              left="Subtle"
              right="Marked"
              value={params.shiftEmphasis}
              onChange={(v) => set({ shiftEmphasis: v })}
            />
            <FeelSlider
              id="fus-res"
              label="Harmonic resonance"
              left="Off"
              right="Present"
              value={params.harmonicResonance}
              onChange={(v) => set({ harmonicResonance: v })}
            />
            <button
              type="button"
              onClick={() => onParamsChange({ ...DEFAULT_FUSION_PARAMS })}
              className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
            >
              Reset Fusion
            </button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <button
        type="button"
        onClick={onSave}
        className="h-14 w-full rounded-full bg-primary text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
      >
        Save Experience Preset
      </button>
      {savedNote ? <p className="text-sm text-muted-foreground">{savedNote}</p> : null}
    </div>
  );
}
