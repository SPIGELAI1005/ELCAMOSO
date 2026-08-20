import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark, ElcamosoLogo } from "@/components/ElcamosoLogo";
import { BrandLoader } from "@/components/BrandLoader";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getProfileGain, getTuning } from "@/lib/drive/settings";
import { useHaptics } from "@/lib/drive/useHaptics";
import { useDriveSession } from "@/lib/drive/useDriveSession";
import { getProfile } from "@/lib/sound/profiles";

export const Route = createFileRoute("/drive")({
  component: DriveScreen,
  head: () => ({
    meta: [
      { title: "Drive — ELCAMOSO" },
      {
        name: "description",
        content: "Start a drive and let your sound profile follow the movement of your EV.",
      },
      { property: "og:title", content: "Drive — ELCAMOSO" },
      {
        property: "og:description",
        content: "Start a drive and let your sound profile follow the movement of your EV.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/drive" },
    ],
    links: [{ rel: "canonical", href: "/drive" }],
  }),
});

function DriveScreen() {
  const { settings, update, loaded } = useSettings();
  const profile = getProfile(settings.profileId);
  const reducedMotion = useReducedMotion();
  const { status, error, state, start, stop } = useDriveSession({
    profileId: settings.profileId,
    volume: settings.volume,
    demoMotion: settings.demoMotion,
    tuning: getTuning(settings, settings.profileId),
    profileGain: getProfileGain(settings, settings.profileId),
    motionSensitivity: settings.motionSensitivity,
    motionNoiseFloor: settings.motionNoiseFloor,
  });

  useHaptics({
    enabled: settings.haptics,
    active: status === "driving",
    throttle: state.throttle,
    regen: state.regen,
  });
  const [showSafety, setShowSafety] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined" || !loaded) return;
    if (!settings.onboarded && !settings.safetyAcknowledged) {
      void navigate({ to: "/onboarding" });
    }
  }, [navigate, loaded, settings.onboarded, settings.safetyAcknowledged]);

  const handleStart = () => {
    if (!settings.safetyAcknowledged) {
      setShowSafety(true);
      return;
    }
    update({ lastDriveAt: Date.now() });
    void start();
  };

  const acknowledge = () => {
    update({ safetyAcknowledged: true, onboarded: true, lastDriveAt: Date.now() });
    setShowSafety(false);
    void start();
  };

  const kmh = Math.round(state.speed * 3.6);

  return (
    <main className="flex min-h-screen flex-col px-6 pt-6 pb-10 sm:px-10">
      <div className="flex items-center justify-between">
        <Link to="/" aria-label="ELCAMOSO home">
          <ElcamosoLogo variant="full" />
        </Link>
        <Link
          to="/sounds"
          className="text-xs tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
        >
          Sounds
        </Link>
      </div>

      {showSafety ? (
        <Safety onAccept={acknowledge} onCancel={() => setShowSafety(false)} />
      ) : status === "error" ? (
        <ErrorState message={error} onRetry={() => void start()} />
      ) : status === "starting" ? (
        <div className="flex flex-1 items-center justify-center">
          <BrandLoader label="Preparing your drive" />
        </div>
      ) : status === "driving" ? (
        <Driving
          kmh={kmh}
          load={state.load}
          throttle={state.throttle}
          regen={state.regen}
          waveResponse={profile.voice.waveResponse}
          reducedMotion={reducedMotion}
          rpm={state.rpm}
          gear={state.gear}
          continuous={profile.drivetrainMode === "continuous"}
          profileName={profile.name}
          traits={profile.traits}
          onStop={stop}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
          <ElcamosoMark
            animate
            waveResponse={profile.voice.waveResponse}
            reducedMotion={reducedMotion}
            className="h-14 w-auto"
          />
          <div>
            <p className="text-2xl font-light">{profile.name}</p>
            <p className="mt-3 text-sm text-muted-foreground">{profile.traits.join(" · ")}</p>
          </div>
          <button
            onClick={handleStart}
            className="h-16 rounded-full bg-primary px-12 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Start Drive
          </button>
        </div>
      )}
    </main>
  );
}

function Driving({
  kmh,
  load,
  throttle,
  regen,
  waveResponse,
  reducedMotion,
  rpm,
  gear,
  continuous,
  profileName,
  traits,
  onStop,
}: {
  kmh: number;
  load: number;
  throttle: number;
  regen: number;
  waveResponse: number;
  reducedMotion: boolean;
  rpm: number;
  gear: number;
  continuous: boolean;
  profileName: string;
  traits: string[];
  onStop: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-between py-12 text-center">
      <ElcamosoMark
        intensity={load}
        throttle={throttle}
        regen={regen}
        waveResponse={waveResponse}
        reducedMotion={reducedMotion}
        className="h-10 w-auto"
      />

      <div className="flex flex-col items-center gap-10">
        <div>
          <p className="text-[6rem] leading-none font-extralight tabular-nums sm:text-[8rem]">
            {kmh}
          </p>
          <p className="mt-2 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            km/h
          </p>
        </div>

        <div>
          <p className="text-2xl font-light tabular-nums">
            {continuous ? `${Math.round(load * 100)}` : Math.round(rpm)}
          </p>
          <p className="mt-1 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            {continuous ? "Intensity" : "RPM"}
          </p>
        </div>

        <div className="w-56">
          <div className="h-px w-full bg-border">
            <div
              className="relative h-px bg-foreground transition-[width] duration-150"
              style={{ width: `${Math.min(100, load * 100)}%` }}
            >
              <span className="absolute -top-[3px] -right-[3px] block h-[7px] w-[7px] rounded-full bg-foreground" />
            </div>
          </div>
          <p className="mt-4 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            {continuous ? "Continuous" : `D${gear}`}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div>
          <p className="text-lg font-light">{profileName}</p>
          <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {traits.join(" • ")}
          </p>
        </div>
        <button
          onClick={onStop}
          className="h-12 rounded-full border border-border px-10 text-xs tracking-[0.24em] text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          Stop Drive
        </button>
      </div>
    </div>
  );
}

function Safety({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-8 text-center">
      <ElcamosoMark className="h-10 w-auto" />
      <p className="text-xl font-light">Set your sound before you move.</p>
      <p className="text-sm text-muted-foreground">
        ELCAMOSO responds to the motion of your car. Keep your attention on the road and
        adjust nothing while driving.
      </p>
      <div className="flex w-full flex-col gap-3">
        <button
          onClick={onAccept}
          className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase"
        >
          I understand
        </button>
        <button
          onClick={onCancel}
          className="text-xs tracking-[0.24em] text-muted-foreground uppercase"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-8 text-center">
      <ElcamosoMark intensity={0.34} className="h-10 w-auto" />
      <p className="text-xl font-light">{message ?? "Location unavailable"}</p>
      <p className="text-sm text-muted-foreground">
        ELCAMOSO needs your speed to make the sound respond to your drive.
      </p>
      <button
        onClick={onRetry}
        className="h-14 rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase"
      >
        Try Again
      </button>
      <Link
        to="/settings"
        className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
      >
        Open settings
      </Link>
    </div>
  );
}
