import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { useDemoDrive } from "@/lib/drive/useDemoDrive";
import { useHaptics } from "@/lib/drive/useHaptics";
import { getProfileGain, getTuning } from "@/lib/drive/settings";
import { getProfile } from "@/lib/sound/profiles";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { QuickJump } from "@/components/QuickJump";

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

  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Demo Drive</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Drive {profile.name} by hand. Throttle, acceleration and regeneration are
          simulated, so you can hear how the profile behaves without any sensors.
        </p>

        <QuickJump
          className="mt-12"
          settings={settings}
          onSelect={(id) => update({ profileId: id })}
        />

        <EnvironmentPicker
          className="mt-12 border-t border-border pt-8"
          value={settings.environmentId}
          onChange={(environmentId) => update({ environmentId })}
        />

        <section className="mt-12 border border-border p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <ElcamosoMark
                intensity={active ? state.load : 0.34}
                throttle={active ? state.throttle : 0}
                regen={active ? state.regen : 0}
                waveResponse={profile.voice.waveResponse}
                reducedMotion={reducedMotion}
                className="h-9 w-auto"
              />
              <div>
                <p className="text-lg font-light">{profile.name}</p>
                <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Simulated motion
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => (active ? stop() : void start())}
                aria-pressed={active}
                className="h-12 rounded-full border border-border px-8 text-xs tracking-[0.24em] uppercase hover:bg-secondary"
              >
                {active ? "Stop demo" : "Start demo"}
              </button>
              <button
                onClick={reset}
                className="h-12 rounded-full px-4 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </div>

          <dl className="mt-10 grid grid-cols-4 gap-4 text-center">
            <Readout label="km/h" value={Math.round(state.speed * 3.6)} />
            <Readout
              label={continuous ? "Intensity" : "RPM"}
              value={continuous ? Math.round(state.load * 100) : Math.round(state.rpm)}
            />
            <Readout
              label={continuous ? "Mode" : "Gear"}
              value={continuous ? "Cont" : state.gear ? `D${state.gear}` : "N"}
            />
            <Readout label="Regen" value={`${Math.round(state.regen * 100)}`} />
          </dl>

          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            <Pedal
              id="demo-throttle"
              label="Throttle"
              hint="How much demand you ask for"
              value={controls.throttle}
              onChange={(v) => setControls({ throttle: v })}
            />
            <Pedal
              id="demo-accel"
              label="Acceleration"
              hint="How hard the demand builds speed"
              value={controls.accel}
              onChange={(v) => setControls({ accel: v })}
            />
            <Pedal
              id="demo-regen"
              label="Regen"
              hint="Lifting off and slowing down"
              value={controls.regen}
              onChange={(v) => setControls({ regen: v })}
            />
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Haptic feedback</p>
              <p className="mt-2 text-sm text-muted-foreground">
                A subtle vibration follows throttle and regen intensity. Nothing on the
                speed or RPM display changes.
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
                  settings.haptics ? "translate-x-6 bg-background" : "translate-x-1 bg-muted-foreground"
                }`}
              />
            </button>
          </div>
        </section>

        <div className="mt-16 flex flex-wrap gap-8">
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

function Readout({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="text-2xl font-extralight tabular-nums">{value}</dd>
      <dt className="mt-2 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
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
        className="mt-4 h-px w-full appearance-none bg-border accent-foreground"
      />
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
