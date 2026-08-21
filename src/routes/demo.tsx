import { createFileRoute, Link } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { DemoCockpit } from "@/components/DemoCockpit";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { useDemoDrive } from "@/lib/drive/useDemoDrive";
import { useHaptics } from "@/lib/drive/useHaptics";
import { getProfileGain, getTuning } from "@/lib/drive/settings";
import { getProfile } from "@/lib/sound/profiles";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { DemoSoundPicker } from "@/components/DemoSoundPicker";

export const Route = createFileRoute("/demo")({
  component: DemoDrive,
  head: () => ({
    meta: [
      { title: "Demo Drive · ELCAMOSO" },
      {
        name: "description",
        content:
          "Preview how your sound profile behaves with simulated throttle, acceleration and regeneration, with no motion sensors required.",
      },
      { property: "og:title", content: "Demo Drive · ELCAMOSO" },
      {
        property: "og:description",
        content: "Simulated throttle, acceleration and regen to preview sound behaviour.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/demo" },
    ],
    links: [{ rel: "canonical", href: "/demo" }],
  }),
});

function DemoDrive() {
  const { settings, update } = useSettings();
  const reducedMotion = useReducedMotion();
  const profile = getProfile(settings.profileId);
  const { active, state, controls, setControls, reset, start, stop } = useDemoDrive({
    profileId: settings.profileId,
    volume: settings.volume,
    profileGain: getProfileGain(settings, settings.profileId),
    tuning: getTuning(settings, settings.profileId),
    environmentId: settings.environmentId,
    mix: settings.layerMix,
    snippets: settings.snippets,
  });

  useHaptics({
    enabled: settings.haptics,
    active,
    throttle: state.throttle,
    regen: state.regen,
  });

  const continuous = profile.drivetrainMode === "continuous";
  const modeLabel =
    controls.selector === "D" && !continuous && state.gear > 0
      ? `D${state.gear}`
      : controls.selector;

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Demo Drive</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Hear {profile.name} with pedals and P R N D. No motion sensors needed.
        </p>

        <DemoSoundPicker
          className="mt-10"
          settings={settings}
          onSelect={(id) => update({ profileId: id })}
        />

        <EnvironmentPicker
          className="mt-10 border-t border-border pt-6"
          value={settings.environmentId}
          onChange={(environmentId) => update({ environmentId })}
        />

        <section className="mt-10 overflow-hidden rounded-2xl border border-border bg-[#0A0A0A]/40">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <ElcamosoMark
                intensity={active ? state.load : 0.34}
                throttle={active ? state.throttle : 0}
                regen={active ? state.regen : 0}
                waveResponse={profile.voice.waveResponse}
                reducedMotion={reducedMotion}
                className="h-8 w-auto shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-light">{profile.name}</p>
                <p className="mt-0.5 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Simulated motion
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => (active ? stop() : void start())}
                aria-pressed={active}
                className={`h-10 rounded-full px-6 text-[11px] tracking-[0.22em] uppercase transition-colors ${
                  active
                    ? "border border-foreground bg-foreground text-background"
                    : "border border-border hover:bg-secondary"
                }`}
              >
                {active ? "Stop" : "Start"}
              </button>
              <button
                onClick={reset}
                className="h-10 rounded-full px-3 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-4 gap-2 border-b border-border/70 px-3 py-4 text-center sm:px-6">
            <Readout label="km/h" value={Math.round(state.speed * 3.6)} />
            <Readout
              label={continuous ? "Load" : "RPM"}
              value={continuous ? Math.round(state.load * 100) : Math.round(state.rpm)}
            />
            <Readout label="Mode" value={modeLabel} accent />
            <Readout label="Regen" value={`${Math.round(state.regen * 100)}`} />
          </dl>

          <div className="px-5 py-6 sm:px-6">
            <DemoCockpit
              controls={controls}
              setControls={setControls}
              reducedMotion={reducedMotion}
              live={active}
            />
          </div>

          <details className="group border-t border-border/70">
            <summary className="cursor-pointer list-none px-5 py-3.5 text-[10px] tracking-[0.24em] text-muted-foreground uppercase transition-colors hover:text-foreground sm:px-6 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                Fine controls
                <span className="text-foreground/40 transition-transform group-open:rotate-90">
                  ›
                </span>
              </span>
            </summary>
            <div className="grid gap-8 px-5 pb-6 sm:grid-cols-3 sm:px-6">
              <Pedal
                id="demo-throttle"
                label="Throttle"
                hint="Demand"
                value={controls.throttle}
                onChange={(v) => {
                  if (controls.selector === "P" && v > 0.02) {
                    setControls({ throttle: v, regen: 0, selector: "N" });
                    return;
                  }
                  setControls({
                    throttle: v,
                    ...(v > 0.02 ? { regen: 0 } : {}),
                  });
                }}
              />
              <Pedal
                id="demo-accel"
                label="Acceleration"
                hint="How hard demand builds speed"
                value={controls.accel}
                onChange={(v) => setControls({ accel: v })}
              />
              <Pedal
                id="demo-regen"
                label="Regen"
                hint="Lifting off and slowing down"
                value={controls.regen}
                onChange={(v) =>
                  setControls({
                    regen: v,
                    ...(v > 0.02 ? { throttle: 0 } : {}),
                  })
                }
              />
            </div>
          </details>
        </section>

        <section className="mt-10 border-t border-border pt-6">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-sm">Haptic feedback</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Subtle vibration follows throttle and regen.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.haptics}
              aria-label="Haptic feedback"
              onClick={() => update({ haptics: !settings.haptics })}
              className={`h-7 w-12 shrink-0 rounded-full border border-border transition-colors ${
                settings.haptics ? "bg-foreground" : "bg-transparent"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full transition-transform ${
                  settings.haptics
                    ? "translate-x-6 bg-background"
                    : "translate-x-1 bg-muted-foreground"
                }`}
              />
            </button>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-8">
          <Link
            to="/sounds"
            className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Change sound
          </Link>
          <Link
            to="/calibrate"
            className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Calibrate motion
          </Link>
        </div>
      </div>
    </main>
  );
}

function Readout({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div>
      <dd
        className={`text-xl font-extralight tabular-nums sm:text-2xl ${
          accent ? "text-[#f0b429]" : ""
        }`}
      >
        {value}
      </dd>
      <dt className="mt-1 text-[9px] tracking-[0.24em] text-muted-foreground uppercase">
        {label}
      </dt>
    </div>
  );
}

function Pedal({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(value * 100)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-3 slider h-10 w-full"
      />
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
