import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { useSettings } from "@/lib/drive/useSettings";
import {
  exportSettingsFile,
  getProfileGain,
  importSettingsFile,
} from "@/lib/drive/settings";
import { hapticsSupported } from "@/lib/drive/useHaptics";
import { getProfile } from "@/lib/sound/profiles";

export const Route = createFileRoute("/settings")({
  component: Settings,
  head: () => ({
    meta: [
      { title: "Settings - ELCAMOSO" },
      {
        name: "description",
        content: "Sound volume, driving sensors and privacy for your ELCAMOSO drives.",
      },
      { property: "og:title", content: "Settings - ELCAMOSO" },
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [transferNote, setTransferNote] = useState<string | null>(null);
  const profileGain = getProfileGain(settings, settings.profileId);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importSettingsFile(file);
      setTransferNote("Settings imported.");
    } catch {
      setTransferNote("That file could not be read as an ELCAMOSO backup.");
    }
  };

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
          <p className="mt-4 text-sm text-muted-foreground">
            Master level for every profile. A limiter keeps sudden peaks in check without
            flattening the dynamics.
          </p>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-baseline justify-between">
            <label htmlFor="settings-profile-gain" className="text-base">
              Profile balance
            </label>
            <p className="text-sm text-muted-foreground tabular-nums">
              {profileGain.toFixed(2)}x
            </p>
          </div>
          <input
            id="settings-profile-gain"
            type="range"
            min={0.4}
            max={1.6}
            step={0.05}
            value={profileGain}
            onChange={(e) =>
              update({
                profileGain: {
                  ...settings.profileGain,
                  [settings.profileId]: Number(e.target.value),
                },
              })
            }
            className="mt-6 h-px w-full appearance-none bg-border accent-foreground"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Applies to {getProfile(settings.profileId).name} only, so profiles sit at the
            same perceived level.
          </p>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Motion calibration</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {settings.calibratedAt
                  ? `Sensitivity ${settings.motionSensitivity.toFixed(2)}x, calibrated ${new Date(settings.calibratedAt).toLocaleDateString()}.`
                  : "Not calibrated yet. A quick check tunes how strongly O ))) reacts on this device."}
              </p>
            </div>
            <Link
              to="/calibrate"
              className="shrink-0 self-center rounded-full border border-border px-6 py-3 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Calibrate
            </Link>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Haptic feedback</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Optional vibration that follows throttle and regen intensity as secondary
                confirmation. The speed and RPM display stays unchanged.
                {hapticsSupported() ? "" : " This device does not support vibration."}
              </p>
            </div>
            <Toggle
              checked={settings.haptics}
              onChange={(v) => update({ haptics: v })}
              label="Haptic feedback"
            />
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Demo Drive</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Preview sound behaviour with simulated throttle, acceleration and regen
                when no motion sensors are available.
              </p>
            </div>
            <Link
              to="/demo"
              className="shrink-0 self-center rounded-full border border-border px-6 py-3 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Open
            </Link>
          </div>
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
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-base">Reduced Motion</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Calmer O ))) feedback and onboarding - the mark responds with light
                instead of movement.
              </p>
            </div>
            <Toggle
              checked={settings.reducedMotion}
              onChange={(v) => update({ reducedMotion: v })}
              label="Reduced Motion"
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
          <p className="mt-4 text-sm text-muted-foreground">
            Audition any profile with simulated motion and fine-tune its response in{" "}
            <Link to="/sounds" className="text-foreground underline underline-offset-4">
              Sounds
            </Link>
            .
          </p>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <p className="text-base">Transfer</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Export your profiles, tuning and drive settings as a file, then import it on
            another device.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={() => exportSettingsFile()}
              className="h-12 rounded-full border border-border px-8 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
            >
              Export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="h-12 rounded-full border border-border px-8 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import settings file"
              onChange={(e) => {
                void handleImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {transferNote ? (
            <p className="mt-4 text-sm text-muted-foreground">{transferNote}</p>
          ) : null}
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
