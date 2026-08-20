import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfile } from "@/lib/sound/profiles";

export const Route = createFileRoute("/settings")({
  component: Settings,
  head: () => ({
    meta: [
      { title: "Settings — ELCAMOSO" },
      {
        name: "description",
        content: "Sound volume, driving sensors and privacy for your ELCAMOSO drives.",
      },
      { property: "og:title", content: "Settings — ELCAMOSO" },
      {
        property: "og:description",
        content: "Sound volume, driving sensors and privacy for your ELCAMOSO drives.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/settings" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
});

function Settings() {
  const { settings, update } = useSettings();

  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-2xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Settings</h1>

        <section className="mt-14 border-t border-border pt-8">
          <div className="flex items-baseline justify-between">
            <p className="text-base">Sound Volume</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {Math.round(settings.volume * 100)}
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            className="mt-6 h-px w-full appearance-none bg-border accent-foreground"
            aria-label="Sound Volume"
          />
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Driving Sensors</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Location supplies the speed that shapes your sound.
              </p>
            </div>
            <Toggle
              checked={!settings.demoMotion}
              onChange={(v) => update({ demoMotion: !v })}
              label="Driving Sensors"
            />
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Demo Motion</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Simulate movement to hear a profile while standing still.
              </p>
            </div>
            <Toggle
              checked={settings.demoMotion}
              onChange={(v) => update({ demoMotion: v })}
              label="Demo Motion"
            />
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <p className="text-base">Sound Profile</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {getProfile(settings.profileId).name} ·{" "}
            <Link to="/sounds" className="text-foreground underline underline-offset-4">
              Change
            </Link>
          </p>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <p className="text-base">Your drive stays yours.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Speed and motion data are processed directly on this device. ELCAMOSO does not
            upload your driving route in this MVP.
          </p>
          <Link
            to="/about"
            className="mt-6 inline-block text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            About ELCAMOSO
          </Link>
        </section>
      </div>
    </main>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-7 w-12 shrink-0 rounded-full border border-border transition-colors ${
        checked ? "bg-foreground" : "bg-transparent"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full transition-transform ${
          checked ? "translate-x-6 bg-background" : "translate-x-1 bg-muted-foreground"
        }`}
      />
    </button>
  );
}
