import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getSession } from "@/lib/drive/session";
import { listSymphonyPacks } from "@/lib/symphony";
import {
  DEFAULT_SYMPHONY_PARAMS,
  INSTRUMENT_FOCUS_LABELS,
  STUDIO_DEMO_TRACES,
  SYMPHONY_SLIDERS,
  ensureViableInstruments,
  setRuntimeSymphonyParams,
  studioDemoStateAt,
  type DemoDriveId,
  type InstrumentFocusId,
  type SymphonyStudioParams,
} from "@/lib/studio";

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

export function StudioSymphonyPanel({
  name,
  onNameChange,
  packId,
  onPackChange,
  params,
  onParamsChange,
  onSave,
  savedNote,
}: {
  name: string;
  onNameChange: (v: string) => void;
  packId: string;
  onPackChange: (id: string) => void;
  params: SymphonyStudioParams;
  onParamsChange: (next: SymphonyStudioParams) => void;
  onSave: () => void;
  savedNote: string | null;
}) {
  const packs = listSymphonyPacks();
  const [demoId, setDemoId] = useState<DemoDriveId>("city");
  const [listening, setListening] = useState(false);
  const [sideB, setSideB] = useState<SymphonyStudioParams | null>(null);
  const [abSide, setAbSide] = useState<"a" | "b">("a");
  const timer = useRef<number | null>(null);
  const startRef = useRef(0);
  const seedRef = useRef(STUDIO_DEMO_TRACES.find((t) => t.id === demoId)?.seed ?? 22);

  useEffect(() => {
    setRuntimeSymphonyParams(packId, params);
    return () => setRuntimeSymphonyParams(packId, null);
  }, [packId, params]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      getSession().setAuditionDriveOverride(null);
    };
  }, []);

  const activeParams = abSide === "b" && sideB ? sideB : params;

  useEffect(() => {
    setRuntimeSymphonyParams(packId, activeParams);
  }, [packId, activeParams]);

  const stopDemo = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setListening(false);
    getSession().setAuditionDriveOverride(null);
    void getSession().stop();
  };

  const startDemo = async () => {
    stopDemo();
    const trace = STUDIO_DEMO_TRACES.find((t) => t.id === demoId)!;
    seedRef.current = trace.seed;
    setRuntimeSymphonyParams(packId, activeParams);
    getSession().primeAudioFromUserGesture();
    await getSession().listenProfile(packId, 40);
    setListening(true);
    startRef.current = performance.now();
    timer.current = window.setInterval(() => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      getSession().setAuditionDriveOverride(studioDemoStateAt(demoId, elapsed));
    }, 100);
  };

  const setParam = <K extends keyof SymphonyStudioParams>(
    key: K,
    value: SymphonyStudioParams[K],
  ) => {
    onParamsChange({ ...params, [key]: value });
  };

  const toggleInstrument = (id: InstrumentFocusId) => {
    const instruments = ensureViableInstruments({
      ...params.instruments,
      [id]: !params.instruments[id],
    });
    onParamsChange({ ...params, instruments });
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
          Base pack
        </label>
        <select
          value={packId}
          onChange={(e) => onPackChange(e.target.value)}
          className="mt-3 w-full border-b border-border bg-transparent py-3 text-lg font-light outline-none"
        >
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void (listening ? stopDemo() : startDemo())}
            className="h-11 rounded-full bg-primary px-6 text-[10px] tracking-[0.2em] text-primary-foreground uppercase"
          >
            {listening ? "Stop" : "Listen"}
          </button>
          <button
            type="button"
            onClick={() => setSideB({ ...params })}
            className="h-11 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase"
          >
            Store B
          </button>
          {sideB ? (
            <button
              type="button"
              onClick={() => setAbSide((s) => (s === "a" ? "b" : "a"))}
              className="h-11 rounded-full border border-foreground px-5 text-[10px] tracking-[0.2em] uppercase"
            >
              A/B · {abSide.toUpperCase()}
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Same demo trace and seed while you edit - A/B keeps the motion identical.
        </p>
      </section>

      <section>
        <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
          Arrangement
        </h2>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          {SYMPHONY_SLIDERS.map((s) => (
            <FeelSlider
              key={s.key}
              id={`sym-${s.key}`}
              label={s.label}
              left={s.left}
              right={s.right}
              value={params[s.key]}
              onChange={(v) => setParam(s.key, v)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
          Instrument focus
        </h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {INSTRUMENT_FOCUS_LABELS.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => toggleInstrument(inst.id)}
              className={`rounded-full border px-4 py-2 text-[10px] tracking-[0.18em] uppercase ${
                params.instruments[inst.id]
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {inst.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Invalid silence is blocked - atmosphere always holds a base.
        </p>
      </section>

      <Accordion type="single" collapsible className="border-t border-border">
        <AccordionItem value="advanced" className="border-border">
          <AccordionTrigger className="py-6 hover:no-underline">
            <span className="text-base font-light tracking-normal normal-case">Advanced</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-8 pb-8">
            <FeelSlider
              id="sym-trans"
              label="Transition frequency"
              left="Sparse"
              right="Frequent"
              value={params.transitionFrequency}
              onChange={(v) => setParam("transitionFrequency", v)}
            />
            <FeelSlider
              id="sym-fill"
              label="Fill frequency"
              left="Rare"
              right="Often"
              value={params.fillFrequency}
              onChange={(v) => setParam("fillFrequency", v)}
            />
            <FeelSlider
              id="sym-climax"
              label="Climax sensitivity"
              left="Reserved"
              right="Eager"
              value={params.climaxSensitivity}
              onChange={(v) => setParam("climaxSensitivity", v)}
            />
            <div>
              <label className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Minimum section duration ({params.minSectionDuration.toFixed(1)}s)
              </label>
              <input
                type="range"
                min={10}
                max={80}
                value={Math.round(params.minSectionDuration * 10)}
                onChange={(e) => setParam("minSectionDuration", Number(e.target.value) / 10)}
                className="mt-3 w-full accent-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => onParamsChange({ ...DEFAULT_SYMPHONY_PARAMS })}
              className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
            >
              Reset arrangement
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
