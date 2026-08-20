import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";

export const Route = createFileRoute("/calibrate")({
  component: Calibrate,
  head: () => ({
    meta: [
      { title: "Calibrate motion · ELCAMOSO" },
      {
        name: "description",
        content:
          "A quick calibration that tunes motion sensitivity so the O ))) mark and your sound react correctly on your device.",
      },
      { property: "og:title", content: "Calibrate motion · ELCAMOSO" },
      {
        property: "og:description",
        content: "Tune motion sensitivity in a few seconds so your sound reacts correctly.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/calibrate" },
    ],
    links: [{ rel: "canonical", href: "/calibrate" }],
  }),
});

type Phase = "intro" | "measuring" | "done" | "unsupported";

const SAMPLE_MS = 6000;

function Calibrate() {
  const { settings, update } = useSettings();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("intro");
  const [progress, setProgress] = useState(0);
  const [peak, setPeak] = useState(0);
  const [noise, setNoise] = useState(0);
  const samples = useRef<number[]>([]);

  // Proposed values live here until the live test is accepted, so nothing is
  // saved before it has been seen reacting.
  const [pending, setPending] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const pendingSensitivity = pending ?? settings.motionSensitivity;

  const finish = useCallback(() => {
    const values = samples.current;
    if (!values.length) {
      setPhase("unsupported");
      return;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.6)] ?? 0;
    const high = sorted[sorted.length - 1] ?? 0;
    // a noisy device needs a lower multiplier, a quiet one a higher one
    const sensitivity = Math.min(2, Math.max(0.4, 1.15 / (1 + floor * 1.6)));
    setNoise(floor);
    setPeak(high);
    setPending(Number(sensitivity.toFixed(2)));
    setSaved(false);
    setPhase("done");
  }, []);

  const startMeasuring = useCallback(async () => {
    samples.current = [];
    setProgress(0);

    const DM = (
      typeof window !== "undefined"
        ? (window.DeviceMotionEvent as typeof DeviceMotionEvent & {
            requestPermission?: () => Promise<PermissionState>;
          })
        : undefined
    );
    if (!DM) {
      setPhase("unsupported");
      return;
    }
    if (typeof DM.requestPermission === "function") {
      try {
        const result = await DM.requestPermission();
        if (result !== "granted") {
          setPhase("unsupported");
          return;
        }
      } catch {
        setPhase("unsupported");
        return;
      }
    }
    setPhase("measuring");
  }, []);

  useEffect(() => {
    if (phase !== "measuring") return;
    const startedAt = performance.now();

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.acceleration ?? event.accelerationIncludingGravity;
      if (!a) return;
      const magnitude = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (Number.isFinite(magnitude)) samples.current.push(magnitude);
    };

    window.addEventListener("devicemotion", onMotion);
    const interval = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setProgress(Math.min(1, elapsed / SAMPLE_MS));
      if (elapsed >= SAMPLE_MS) {
        clearInterval(interval);
        window.removeEventListener("devicemotion", onMotion);
        finish();
      }
    }, 100);

    return () => {
      clearInterval(interval);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [phase, finish]);

  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Calibrate motion</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A few seconds of stillness lets ELCAMOSO learn how your device reads movement,
          so O ))) and your sound react correctly.
        </p>

        <div className="mt-14 flex flex-col items-center gap-10 border-y border-border py-16">
          <ElcamosoMark
            animate={phase === "measuring" && !reducedMotion}
            intensity={phase === "measuring" ? 0.35 + progress * 0.6 : 0.5}
            reducedMotion={reducedMotion}
            className="h-14 w-auto"
          />

          {phase === "intro" ? (
            <>
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                Place the phone where it will sit while you drive, keep the car still, then
                start. It takes about six seconds.
              </p>
              <button
                onClick={() => void startMeasuring()}
                className="h-14 rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase"
              >
                Start calibration
              </button>
            </>
          ) : phase === "measuring" ? (
            <>
              <p className="text-sm text-muted-foreground">Hold still</p>
              <div className="h-px w-56 bg-border">
                <div
                  className="h-px bg-foreground transition-[width] duration-100"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </>
          ) : phase === "done" ? (
            <>
              <p className="text-center text-xl font-light">
                {saved ? "Saved" : "Suggested setting"}
              </p>
              <dl className="grid grid-cols-3 gap-8 text-center">
                <Stat label="Sensitivity" value={`${pendingSensitivity.toFixed(2)}x`} />
                <Stat label="Noise" value={noise.toFixed(2)} />
                <Stat label="Peak" value={peak.toFixed(2)} />
              </dl>
              {saved ? (
                <Link
                  to="/drive"
                  className="inline-flex h-14 items-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase"
                >
                  Start Drive
                </Link>
              ) : (
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  Move your device and watch the live test below. Save it once the reaction
                  feels right.
                </p>
              )}
            </>
          ) : (
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              This device does not expose motion readings. You can still set sensitivity by
              hand below and preview the result in Demo Drive.
            </p>
          )}
        </div>


        <LiveTest
          sensitivity={pendingSensitivity}
          noiseFloor={noise || settings.motionNoiseFloor}
          reducedMotion={reducedMotion}
        />

        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <label htmlFor="sensitivity" className="text-base">
              Motion sensitivity
            </label>
            <span className="text-sm text-muted-foreground tabular-nums">
              {pendingSensitivity.toFixed(2)}x
            </span>
          </div>
          <input
            id="sensitivity"
            type="range"
            min={0.4}
            max={2}
            step={0.05}
            value={pendingSensitivity}
            onChange={(e) => {
              setPending(Number(e.target.value));
              setSaved(false);
            }}
            className="mt-6 h-px w-full appearance-none bg-border accent-foreground"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Higher values make the sound react sooner to small changes. Lower values keep
            it calm on devices with noisy sensors.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <button
              onClick={() => {
                update({
                  motionSensitivity: Number(pendingSensitivity.toFixed(2)),
                  motionNoiseFloor: Number((noise || settings.motionNoiseFloor).toFixed(3)),
                  calibratedAt: Date.now(),
                });
                setSaved(true);
              }}
              className="h-12 rounded-full bg-primary px-8 text-[11px] tracking-[0.24em] text-primary-foreground uppercase"
            >
              {saved ? "Saved" : "Save sensitivity"}
            </button>
            <button
              onClick={() => {
                setPending(1);
                setSaved(false);
                update({ motionSensitivity: 1, motionNoiseFloor: 0, calibratedAt: null });
              }}
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Reset
            </button>
            <Link
              to="/demo"
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Try in demo drive
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-xl font-extralight tabular-nums">{value}</dd>
      <dt className="mt-2 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        {label}
      </dt>
    </div>
  );
}

/**
 * Live response test: shows what the current sensitivity does to real device
 * movement right now, before it is saved. Falls back to a gentle simulated
 * sweep when the device exposes no motion readings.
 */
function LiveTest({
  sensitivity,
  noiseFloor,
  reducedMotion,
}: {
  sensitivity: number;
  noiseFloor: number;
  reducedMotion: boolean;
}) {
  const [magnitude, setMagnitude] = useState(0);
  const [response, setResponse] = useState(0);
  const [hasSensor, setHasSensor] = useState(false);
  const raw = useRef(0);
  const smoothed = useRef(0);

  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.acceleration ?? event.accelerationIncludingGravity;
      if (!a) return;
      const m = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (!Number.isFinite(m)) return;
      raw.current = m;
      if (m > 0.02) setHasSensor(true);
    };
    window.addEventListener("devicemotion", onMotion);

    let frame = 0;
    const startedAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const input = raw.current || (1 + Math.sin(elapsed * 1.1)) * 0.9;
      const above = Math.max(0, input - noiseFloor);
      const target = Math.min(1, (above * sensitivity) / 6);
      smoothed.current += (target - smoothed.current) * 0.18;
      setMagnitude(input);
      setResponse(smoothed.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("devicemotion", onMotion);
      cancelAnimationFrame(frame);
    };
  }, [sensitivity, noiseFloor]);

  return (
    <section className="mt-12 border border-border p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-light">Live test</h2>
          <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {hasSensor ? "Reading your device" : "Simulated movement"}
          </p>
        </div>
        <ElcamosoMark
          animate={!reducedMotion}
          intensity={0.25 + response * 0.75}
          throttle={response}
          reducedMotion={reducedMotion}
          className="h-8 w-auto"
        />
      </div>

      <div className="mt-8 h-1.5 w-full overflow-hidden bg-secondary">
        <div
          className="h-full bg-foreground"
          style={{ width: `${Math.max(2, response * 100)}%` }}
        />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-6 text-center">
        <Stat label="Movement" value={magnitude.toFixed(2)} />
        <Stat label="Response" value={`${Math.round(response * 100)}%`} />
        <Stat label="Applied" value={`${sensitivity.toFixed(2)}x`} />
      </dl>

      <p className="mt-6 text-sm text-muted-foreground">
        {hasSensor
          ? "Move or shake the device: the bar and O ))) should rise quickly and settle back without twitching while still."
          : "No motion readings on this device, so a gentle sweep is shown instead. Sensitivity still applies during a real drive."}
      </p>
    </section>
  );
}
