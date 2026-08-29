import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Get started - ELCAMOSO" },
      {
        name: "description",
        content:
          "Set up ELCAMOSO in three steps: brand, Location and Motion, then start your drive.",
      },
      { property: "og:title", content: "Get started - ELCAMOSO" },
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

const STEP_TITLES = ["Welcome", "Location and Motion", "Before you drive"];

function Onboarding() {
  const navigate = useNavigate();
  const { settings, update, loaded } = useSettings();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [restored, setRestored] = useState(false);
  const [sensorState, setSensorState] = useState<"idle" | "asking" | "ready" | "denied">("idle");

  // Resume where you left off, once, without ever bouncing you elsewhere.
  useEffect(() => {
    if (!loaded || restored) return;
    setRestored(true);
    const saved = Math.min(2, Math.max(0, settings.onboardingStep)) as Step;
    if (saved > 0) setStep(saved);
  }, [loaded, restored, settings.onboardingStep]);

  const goTo = (next: Step) => {
    setStep(next);
    update({ onboardingStep: next });
  };

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
        update({ demoMotion: false });
        goTo(2);
      },
      () => setSensorState("denied"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const continueWithDemo = () => {
    update({ demoMotion: true });
    goTo(2);
  };

  const finish = () => {
    update({ onboarded: true, safetyAcknowledged: true, onboardingStep: 2 });
    void navigate({ to: "/drive" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-10">
        <ElcamosoMark
          animate={step === 0}
          intensity={0.4 + step * 0.3}
          throttle={reducedMotion ? 0 : step === 1 ? 0.5 : 0.15}
          reducedMotion={reducedMotion}
          className="h-14 w-auto"
        />

        <div>
          <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            Step {step + 1} of 3
          </p>
          <p className="mt-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {STEP_TITLES[step]}
          </p>
        </div>

        {step === 0 ? (
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-light">Your EV. Your Sound.</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              More Emotion. Sound that follows how you drive.
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
            <h1 className="text-3xl font-light">Location and Motion</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              ELCAMOSO uses Location (speed) + Motion (instant react). Speed and motion stay on this
              device.
            </p>
            <Link
              to="/settings"
              search={{ workspace: "sensors" }}
              className="text-xs tracking-[0.12em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Optional: Connect Vehicle
            </Link>
            {sensorState === "denied" ? (
              <p className="text-xs text-muted-foreground">
                Location is unavailable. Continue with Demo Motion, or try GPS again later from
                Settings.
              </p>
            ) : sensorState === "ready" ? (
              <p className="text-xs text-muted-foreground">Location ready.</p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-light">Before you drive</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set your sound before driving. Avoid phone interaction while moving.
            </p>
          </div>
        )}

        <div className="flex w-full flex-col gap-4">
          {step === 0 ? (
            <>
              <button
                onClick={() => goTo(1)}
                className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase"
              >
                Continue
              </button>
              <button
                onClick={finish}
                className="min-h-11 text-xs tracking-[0.24em] text-muted-foreground uppercase"
              >
                Skip setup
              </button>
            </>
          ) : step === 1 ? (
            <>
              <button
                onClick={() => void enableSensors()}
                disabled={sensorState === "asking"}
                className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-60"
              >
                {sensorState === "asking"
                  ? "Requesting…"
                  : sensorState === "denied"
                    ? "Try Location again"
                    : "Continue with GPS"}
              </button>
              <button
                onClick={continueWithDemo}
                className="min-h-11 text-xs tracking-[0.24em] text-muted-foreground uppercase"
              >
                Continue with Demo
              </button>
            </>
          ) : (
            <button
              onClick={finish}
              className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase"
            >
              Start
            </button>
          )}
        </div>

        <div className="flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-px w-8 ${i <= step ? "bg-foreground" : "bg-border"}`} />
          ))}
        </div>

        <Link
          to="/drive"
          className="min-h-11 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Go straight to Drive
        </Link>
      </div>
    </main>
  );
}
