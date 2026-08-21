import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { BrandLoader } from "@/components/BrandLoader";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getProfileGain, getTuning } from "@/lib/drive/settings";
import { useHaptics } from "@/lib/drive/useHaptics";
import { useDriveSession } from "@/lib/drive/useDriveSession";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { needsIntenseConfirm } from "@/lib/drive/safety";
import { formatSpeed, t } from "@/lib/i18n";
import { driveCoachFn } from "@/lib/cloud/server-fns";
import { getProfile } from "@/lib/sound/profiles";

export const Route = createFileRoute("/drive")({
  validateSearch: (search: Record<string, unknown>): { cockpit?: boolean } => {
    const raw = search["cockpit"];
    if (raw === true || raw === "1" || raw === 1) return { cockpit: true };
    return {};
  },
  component: DriveScreen,
  head: () => ({
    meta: [
      { title: "Drive - ELCAMOSO" },
      {
        name: "description",
        content: "Start a drive and let your sound profile follow the movement of your EV.",
      },
      { property: "og:title", content: "Drive - ELCAMOSO" },
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
  const { cockpit } = Route.useSearch();
  const navigate = useNavigate();
  const { settings, update, loaded, loadReport } = useSettings();
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
  const sessionSnap = useSessionStore();

  useHaptics({
    enabled: settings.haptics,
    active: status === "driving",
    throttle: state.throttle,
    regen: state.regen,
  });
  const [showSafety, setShowSafety] = useState(false);
  const [showIntense, setShowIntense] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);

  useEffect(() => {
    getSession().setCockpit(Boolean(cockpit));
  }, [cockpit]);

  /**
   * Safety fallback: Drive is always reachable once settings have loaded. A
   * first-time visitor is offered setup inline instead of being redirected, so
   * inconsistent onboarding flags can never bounce you back and forth.
   */
  const needsSetup = loaded && !settings.onboarded && !settings.safetyAcknowledged;
  /** storage problems never block Drive: defaults are used and it is said plainly */
  const storageWarning =
    loaded && (loadReport.outcome === "corrupt" || loadReport.outcome === "unavailable")
      ? "Saved settings could not be read on this device, so defaults are in use. Drive works as normal."
      : null;

  const handleStart = () => {
    if (!settings.safetyAcknowledged) {
      setShowSafety(true);
      return;
    }
    if (needsIntenseConfirm(profile, settings.volume, getProfileGain(settings, settings.profileId))) {
      setShowIntense(true);
      return;
    }
    beginDrive();
  };

  const beginDrive = () => {
    update({ lastDriveAt: Date.now(), driveCount: settings.driveCount + 1 });
    void start();
  };

  const handleStop = () => {
    stop();
    const aggregates = getSession().snapshot().lastAggregates;
    if (aggregates) {
      void driveCoachFn({ data: { aggregates } }).then((result) => {
        setCoach(`${result.summary} ${result.suggestion}`);
      });
    }
  };

  const acknowledge = () => {
    update({
      safetyAcknowledged: true,
      onboarded: true,
      onboardingStep: 2,
      lastDriveAt: Date.now(),
      driveCount: settings.driveCount + 1,
    });
    setShowSafety(false);
    void start();
  };

  const speed = formatSpeed(state.speed, settings.units, settings.language);

  return (
    <main className="flex min-h-screen flex-col px-6 pt-6 pb-10 sm:px-10">

      {showSafety ? (
        <Safety onAccept={acknowledge} onCancel={() => setShowSafety(false)} />
      ) : showIntense ? (
        <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="text-xl font-light">{t(settings.language, "intense.confirm")}</p>
          <button
            type="button"
            onClick={() => {
              setShowIntense(false);
              beginDrive();
            }}
            className="h-14 rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase"
          >
            Continue
          </button>
          <button type="button" onClick={() => setShowIntense(false)} className="text-xs uppercase">
            Cancel
          </button>
        </div>
      ) : status === "error" ? (
        <ErrorState message={error} onRetry={() => void start()} />
      ) : status === "starting" ? (
        <div className="flex flex-1 items-center justify-center">
          <BrandLoader label="Preparing your drive" />
        </div>
      ) : status === "driving" ? (
        <Driving
          kmh={speed.value}
          unit={speed.unit}
          load={state.load}
          throttle={state.throttle}
          regen={state.regen}
          waveResponse={profile.voice.waveResponse}
          reducedMotion={reducedMotion}
          rpm={state.rpm}
          gear={state.gear}
          continuous={profile.drivetrainMode === "continuous"}
          profileName={getProfile(sessionSnap.profileId).name}
          traits={getProfile(sessionSnap.profileId).traits}
          cockpit={Boolean(cockpit)}
          context={sessionSnap.context}
          rulesHeld={sessionSnap.rulesHeld}
          suggestedProfileId={sessionSnap.suggestedProfileId}
          autoRulesMode={settings.autoRulesMode}
          onHold={() => getSession().setRulesHeld(!sessionSnap.rulesHeld)}
          onAcceptSuggestion={() => getSession().acceptSuggestion()}
          onDismissSuggestion={() => getSession().dismissSuggestion()}
          onStop={handleStop}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
          {storageWarning ? (
            <p className="max-w-sm text-xs text-muted-foreground">{storageWarning}</p>
          ) : null}
          {needsSetup ? (
            <Link
              to="/onboarding"
              className="rounded-full border border-border px-6 py-3 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              New here? Run the 3-step setup
            </Link>
          ) : null}
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
            className="h-16 min-h-11 rounded-full bg-primary px-12 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            {t(settings.language, "drive.start")}
          </button>
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/drive",
                search: cockpit ? {} : { cockpit: true },
              })
            }
            className="h-11 text-[11px] tracking-[0.24em] text-muted-foreground uppercase"
          >
            {t(settings.language, "drive.cockpit")} {cockpit ? "on" : "off"}
          </button>
          {coach ? <p className="max-w-sm text-sm text-muted-foreground">{coach}</p> : null}
          <Link to="/replay" className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
            Drive recordings
          </Link>
        </div>
      )}
    </main>
  );
}

function Driving({
  kmh,
  unit,
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
  cockpit,
  context,
  rulesHeld,
  suggestedProfileId,
  autoRulesMode,
  onHold,
  onAcceptSuggestion,
  onDismissSuggestion,
  onStop,
}: {
  kmh: number;
  unit: string;
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
  cockpit: boolean;
  context: string;
  rulesHeld: boolean;
  suggestedProfileId: string | null;
  autoRulesMode: string;
  onHold: () => void;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  onStop: () => void;
}) {
  const suggestion = suggestedProfileId ? getProfile(suggestedProfileId) : null;

  return (
    <div className={`flex flex-1 flex-col items-center text-center ${cockpit ? "justify-center py-6" : "justify-between py-12"}`}>
      <ElcamosoMark
        intensity={load}
        throttle={throttle}
        regen={regen}
        waveResponse={waveResponse}
        reducedMotion={reducedMotion}
        className={cockpit ? "h-16 w-auto" : "h-10 w-auto"}
      />

      <div className="flex flex-col items-center gap-10">
        <div>
          <p className={`leading-none font-extralight tabular-nums ${cockpit ? "text-[8rem] sm:text-[10rem]" : "text-[6rem] sm:text-[8rem]"}`}>
            {kmh}
          </p>
          <p className="mt-2 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            {unit}
          </p>
        </div>

        {cockpit ? null : (
          <>
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
                {continuous ? "Continuous" : `D${gear}`} · {context}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-6">
        {cockpit ? null : (
          <div>
            <p className="text-lg font-light">{profileName}</p>
            <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
              {traits.join(" · ")}
            </p>
          </div>
        )}

        {suggestion && autoRulesMode === "suggest" && !rulesHeld ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onAcceptSuggestion}
              className="h-11 rounded-full border border-foreground px-6 text-[11px] tracking-[0.16em] uppercase"
            >
              Try {suggestion.name}
            </button>
            <button
              type="button"
              onClick={onDismissSuggestion}
              className="h-11 px-3 text-[11px] tracking-[0.16em] text-muted-foreground uppercase"
            >
              Not now
            </button>
          </div>
        ) : null}

        {autoRulesMode !== "off" ? (
          <button
            type="button"
            onClick={onHold}
            aria-pressed={rulesHeld}
            className={`h-12 min-w-[11rem] rounded-full border px-8 text-xs tracking-[0.24em] uppercase ${
              rulesHeld
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {rulesHeld ? "Hold on" : "Hold"}
          </button>
        ) : null}

        <button
          onClick={onStop}
          className="h-14 min-w-[11rem] rounded-full border border-border px-10 text-xs tracking-[0.24em] text-muted-foreground uppercase transition-colors hover:text-foreground"
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
