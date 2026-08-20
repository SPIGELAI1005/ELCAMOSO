import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getProfile } from "@/lib/sound/profiles";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Get started — ELCAMOSO" },
      {
        name: "description",
        content:
          "Set up ELCAMOSO in three steps: how motion becomes sound, driving sensors, and your first drive.",
      },
      { property: "og:title", content: "Get started — ELCAMOSO" },
      {
        property: "og:description",
        content: "Set up ELCAMOSO in three steps and let your sound follow your drive.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/onboarding" },
    ],
    links: [{ rel: "canonical", href: "/onboarding" }],
  }),
});

type Step = 0 | 1 | 2;

function Onboarding() {
  const navigate = useNavigate();
  const { settings, update, loaded } = useSettings();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [sensorState, setSensorState] = useState<"idle" | "asking" | "ready" | "denied">(
    "idle",
  );
  const profile = getProfile(settings.profileId);

  // Already set up? Go straight to the drive screen.
  useEffect(() => {
    if (loaded && settings.onboarded) void navigate({ to: "/drive" });
  }, [loaded, settings.onboarded, navigate]);

  const enableSensors = async () => {
    setSensorState("asking");
    // Unlock audio inside the user gesture so the drive starts instantly later.
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      await ctx.close();
    } catch {
      /* audio will be unlocked again on Start Drive */
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setSensorState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setSensorState("ready");
        setStep(2);
      },
      () => setSensorState("denied"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const finish = () => {
    update({ onboarded: true, safetyAcknowledged: true });
    void navigate({ to: "/drive" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-10">
        <ElcamosoMark
          animate={step === 0}
          intensity={0.4 + step * 0.3}
          throttle={reducedMotion ? 0 : step === 2 ? 0.5 : 0.15}
          reducedMotion={reducedMotion}
          className="h-14 w-auto"
        />

        {step === 0 ? (
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-light">Your EV. Your sound.</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              ELCAMOSO listens to how your car moves — speed, acceleration and
              deceleration — and shapes a sound that follows it in real time. Nothing is
              played back; everything is generated as you drive.
            </p>
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Your drive stays yours
            </p>
            <button
              onClick={() => update({ reducedMotion: !settings.reducedMotion })}
              aria-pressed={settings.reducedMotion}
              className="mx-auto inline-flex min-h-11 items-center rounded-full border border-border px-6 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Reduced motion {settings.reducedMotion ? "on" : "off"}
            </button>
          </div>
        ) : step === 1 ? (
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-light">Driving sensors</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              ELCAMOSO needs your speed to make the sound respond to your drive. Speed and
              motion are processed on this device and never uploaded.
            </p>
            {sensorState === "denied" ? (
              <p className="text-xs text-muted-foreground">
                Sensors are unavailable. You can still continue and use demo motion from
                Settings.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-light">You&apos;re set</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your sound is <span className="text-foreground">{profile.name}</span>. You can
              change it any time in Sounds — your choice and settings are remembered for
              next time.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Set everything before you move, then keep your attention on the road.
            </p>
          </div>
        )}

        <div className="flex w-full flex-col gap-4">
          {step === 0 ? (
            <button
              onClick={() => setStep(1)}
              className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase"
            >
              Continue
            </button>
          ) : step === 1 ? (
            <>
              <button
                onClick={() => void enableSensors()}
                disabled={sensorState === "asking"}
                className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-60"
              >
                {sensorState === "asking" ? "Requesting…" : "Enable sensors"}
              </button>
              <button
                onClick={() => setStep(2)}
                className="text-xs tracking-[0.24em] text-muted-foreground uppercase"
              >
                Skip for now
              </button>
            </>
          ) : (
            <button
              onClick={finish}
              className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase"
            >
              Start Drive
            </button>
          )}
        </div>

        <div className="flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-px w-8 ${i <= step ? "bg-foreground" : "bg-border"}`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
