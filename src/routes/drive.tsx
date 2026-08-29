import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { BrandLoader } from "@/components/BrandLoader";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getProfileGain } from "@/lib/drive/settings";
import { useHaptics } from "@/lib/drive/useHaptics";
import { useDriveSession } from "@/lib/drive/useDriveSession";
import { getSession, type DriveProductStatus } from "@/lib/drive/session";
import type { DriveState } from "@/lib/drive/model";
import { needsIntenseConfirm } from "@/lib/drive/safety";
import { driveSecondaryReadout } from "@/lib/drive/drive-display";
import { supportsDynamicDrive } from "@/lib/drive/drivetrain-resolve";
import { DynamicDriveInstrument } from "@/components/DynamicDriveInstrument";
import { DriveSessionPanel } from "@/components/DriveSessionPanel";
import { useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import {
  DynamicDriveTrialComplete,
  DynamicDriveTrialDuringDrive,
} from "@/components/dynamic-drive-trial";
import { DynamicDriveSessionConflictNotice } from "@/components/DynamicDriveSessionConflictNotice";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { DrivePipelineMetrics } from "@/components/DrivePipelineMetrics";
import { DriveDiagnosticsPanel } from "@/components/DriveDiagnosticsPanel";
import { isDriveDebugModeActive } from "@/lib/diagnostics/debug-mode";
import type { MotionPipelineMetrics } from "@/lib/motion/pipeline-metrics";
import { IDLE_MOTION } from "@/lib/drive/motion-energy";
import { formatSpeed, t } from "@/lib/i18n";
import { driveCoachFn } from "@/lib/cloud/server-fns";
import { getProfile, type SoundProfile } from "@/lib/sound/profiles";

const TeslaDrivePlusUpgrade = lazy(() =>
  import("@/components/TeslaDrivePlusUpgrade").then((m) => ({
    default: m.TeslaDrivePlusUpgrade,
  })),
);

export const Route = createFileRoute("/drive")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    cockpit?: boolean;
    debug?: boolean;
    activateTrial?: boolean;
    upgrade?: string;
    start?: boolean;
  } => {
    const raw = search["cockpit"];
    const debugRaw = search["debug"];
    const activateRaw = search["activateTrial"];
    const startRaw = search["start"];
    const upgrade = typeof search["upgrade"] === "string" ? search["upgrade"] : undefined;
    const out: {
      cockpit?: boolean;
      debug?: boolean;
      activateTrial?: boolean;
      upgrade?: string;
      start?: boolean;
    } = {};
    if (raw === true || raw === "1" || raw === 1) out.cockpit = true;
    if (debugRaw === true || debugRaw === "1" || debugRaw === 1) out.debug = true;
    if (activateRaw === true || activateRaw === "1" || activateRaw === 1) out.activateTrial = true;
    if (startRaw === true || startRaw === "1" || startRaw === 1) out.start = true;
    if (upgrade) out.upgrade = upgrade;
    return out;
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
  const { cockpit, debug, activateTrial, upgrade, start: autostart } = Route.useSearch();
  const navigate = useNavigate();
  const autostartHandled = useRef(false);
  const { plan } = useEntitlements();
  const [relaySessionId, setRelaySessionId] = useState<string | null>(null);
  const [showTeslaUpgrade, setShowTeslaUpgrade] = useState(false);
  const { settings, update, loaded, loadReport } = useSettings();
  const profile = getProfile(settings.profileId);
  const reducedMotion = useReducedMotion();
  const { status, error, state, sessionSnap, start, stop } = useDriveSession({
    demoMotion: settings.demoMotion,
  });

  useHaptics({
    enabled: settings.haptics,
    active: status === "driving",
    throttle: state.throttle,
    regen: state.regen,
  });
  const [showSafety, setShowSafety] = useState(false);
  const [showIntense, setShowIntense] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);
  const monetizationEnabled = useMonetizationEnabled();

  useEffect(() => {
    if (monetizationEnabled && upgrade === "drive-plus" && plan !== "DRIVE_PLUS") {
      setShowTeslaUpgrade(true);
    }
  }, [monetizationEnabled, plan, upgrade]);

  useEffect(() => {
    if (!activateTrial) return;
    if (!settings.dynamicDrive) {
      update({ dynamicDrive: true });
    }
  }, [activateTrial, settings.dynamicDrive, update]);

  useEffect(() => {
    getSession().setCockpit(Boolean(cockpit));
  }, [cockpit]);

  const debugDriveActive = isDriveDebugModeActive(settings, Boolean(debug));

  useEffect(() => {
    getSession().setDebugDriveDiagnostics(debugDriveActive);
  }, [debugDriveActive]);

  const needsSetup = loaded && !settings.onboarded && !settings.safetyAcknowledged;
  const storageWarning =
    loaded && (loadReport.outcome === "corrupt" || loadReport.outcome === "unavailable")
      ? "Saved settings could not be read on this device, so defaults are in use. Drive works as normal."
      : null;

  const handleStart = () => {
    if (!settings.safetyAcknowledged) {
      setShowSafety(true);
      return;
    }
    if (
      needsIntenseConfirm(profile, settings.volume, getProfileGain(settings, settings.profileId))
    ) {
      setShowIntense(true);
      return;
    }
    beginDrive();
  };

  const beginDrive = () => {
    update({ lastDriveAt: Date.now(), driveCount: settings.driveCount + 1 });
    void start();
  };

  const handleStartRef = useRef(handleStart);
  handleStartRef.current = handleStart;

  useEffect(() => {
    if (!autostart || autostartHandled.current || !loaded) return;
    autostartHandled.current = true;
    void navigate({
      to: "/drive",
      search: {
        ...(cockpit ? { cockpit: true } : {}),
        ...(debug ? { debug: true } : {}),
        ...(activateTrial ? { activateTrial: true } : {}),
        ...(upgrade ? { upgrade } : {}),
      },
      replace: true,
    });
    if (status === "idle") handleStartRef.current();
  }, [activateTrial, autostart, cockpit, debug, loaded, navigate, status, upgrade]);

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
  const liveProfile = getProfile(sessionSnap.profileId);
  const motion = sessionSnap.motion ?? IDLE_MOTION;
  const safetyMode = sessionSnap.safetyMode || Boolean(cockpit);
  const secondary = driveSecondaryReadout(liveProfile, state, motion);

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
          motionEnergy={motion.motionEnergy}
          throttle={state.throttle}
          regen={state.regen}
          waveResponse={liveProfile.voice.waveResponse}
          reducedMotion={reducedMotion}
          secondary={secondary}
          profile={liveProfile}
          dynamicDriveActive={settings.dynamicDrive}
          traits={liveProfile.traits}
          safetyMode={safetyMode}
          productStatus={sessionSnap.productStatus}
          rulesHeld={sessionSnap.rulesHeld}
          suggestedProfileId={sessionSnap.suggestedProfileId}
          autoRulesMode={settings.autoRulesMode}
          driveState={state}
          onHold={() => getSession().setRulesHeld(!sessionSnap.rulesHeld)}
          onAcceptSuggestion={() => getSession().acceptSuggestion()}
          onDismissSuggestion={() => getSession().dismissSuggestion()}
          onStop={handleStop}
          showPairing={Boolean(cockpit)}
          showDebugDiagnostics={debugDriveActive}
          devMode={debugDriveActive}
          pipelineMetrics={sessionSnap.pipeline}
          showTeslaUpgrade={Boolean(cockpit) && showTeslaUpgrade}
          onCloseTeslaUpgrade={() => setShowTeslaUpgrade(false)}
          relaySessionId={relaySessionId}
          onRelaySessionChange={setRelaySessionId}
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
          {coach ? <p className="max-w-sm text-sm text-muted-foreground">{coach}</p> : null}
          {!safetyMode ? (
            <Link
              to="/replay"
              className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase"
            >
              Drive recordings
            </Link>
          ) : null}
          {cockpit ? <DriveSessionPanel className="max-w-lg" devMode={debugDriveActive} onRelaySessionChange={setRelaySessionId} /> : null}
          {cockpit && showTeslaUpgrade ? (
            <Suspense fallback={null}>
              <TeslaDrivePlusUpgrade
                open
                relaySessionId={relaySessionId}
                onClose={() => setShowTeslaUpgrade(false)}
                className="mt-6 w-full max-w-lg"
              />
            </Suspense>
          ) : null}
          <DynamicDriveTrialComplete className="mt-6 w-full max-w-lg" />
        </div>
      )}
    </main>
  );
}

function Driving({
  kmh,
  unit,
  motionEnergy,
  throttle,
  regen,
  waveResponse,
  reducedMotion,
  secondary,
  profile,
  dynamicDriveActive,
  traits,
  safetyMode,
  productStatus,
  rulesHeld,
  suggestedProfileId,
  autoRulesMode,
  driveState,
  onHold,
  onAcceptSuggestion,
  onDismissSuggestion,
  onStop,
  showPairing,
  showDebugDiagnostics,
  devMode,
  pipelineMetrics,
  showTeslaUpgrade,
  onCloseTeslaUpgrade,
  relaySessionId,
  onRelaySessionChange,
}: {
  kmh: number;
  unit: string;
  motionEnergy: number;
  throttle: number;
  regen: number;
  waveResponse: number;
  reducedMotion: boolean;
  secondary: { value: string; label: string; gearLabel: string | null };
  profile: ReturnType<typeof getProfile>;
  dynamicDriveActive: boolean;
  traits: string[];
  safetyMode: boolean;
  productStatus: DriveProductStatus;
  rulesHeld: boolean;
  suggestedProfileId: string | null;
  autoRulesMode: string;
  driveState: DriveState;
  onHold: () => void;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  onStop: () => void;
  showPairing: boolean;
  showDebugDiagnostics: boolean;
  devMode: boolean;
  pipelineMetrics: MotionPipelineMetrics;
  showTeslaUpgrade: boolean;
  onCloseTeslaUpgrade: () => void;
  relaySessionId: string | null;
  onRelaySessionChange: (sessionId: string | null) => void;
}) {
  const suggestion = suggestedProfileId ? getProfile(suggestedProfileId) : null;
  const showExtras = !safetyMode;
  const showDynamicInstrument =
    dynamicDriveActive &&
    supportsDynamicDrive(profile) &&
    profile.drivetrainMode === "virtual-transmission";

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-between py-10 text-center sm:py-12 ${
        safetyMode ? "drive-tesla-cockpit px-4 sm:px-6" : ""
      }`}
    >
      <ElcamosoMark
        intensity={motionEnergy}
        throttle={throttle}
        regen={regen}
        direction={regen > throttle + 0.08 ? "inward" : "outward"}
        waveResponse={waveResponse}
        reducedMotion={reducedMotion}
        className={safetyMode ? "h-16 w-auto" : "h-12 w-auto"}
      />

      <div className="flex flex-col items-center gap-8">
        <div className="drive-speed-readout">
          <p
            className={`leading-none font-extralight tabular-nums ${
              safetyMode ? "text-[7.5rem] sm:text-[9rem]" : "text-[6rem] sm:text-[8rem]"
            }`}
          >
            {kmh}
          </p>
          <p className="mt-2 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
            {unit}
          </p>
        </div>

        {showDynamicInstrument ? (
          <DynamicDriveInstrument
            profile={profile}
            state={driveState}
            productStatus={productStatus}
            reducedMotion={reducedMotion}
            driverDistance={safetyMode}
            className="w-full px-1"
          />
        ) : (
          <>
            <div>
              <p className="text-2xl font-light tabular-nums tracking-tight">{secondary.value}</p>
              <p className="mt-1 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
                {secondary.label}
              </p>
            </div>

            <div className="w-56">
              <div className="h-px w-full bg-border">
                <div
                  className="relative h-px bg-foreground transition-[width] duration-150"
                  style={{ width: `${Math.min(100, motionEnergy * 100)}%` }}
                >
                  <span className="absolute -top-[3px] -right-[3px] block h-[7px] w-[7px] rounded-full bg-foreground" />
                </div>
              </div>
              {secondary.gearLabel ? (
                <p className="mt-4 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
                  {secondary.gearLabel}
                </p>
              ) : null}
            </div>
          </>
        )}
        <DynamicDriveTrialDuringDrive
          dynamicDriveActive={dynamicDriveActive}
          safetyMode={safetyMode}
        />
        <DynamicDriveSessionConflictNotice className="mt-4 w-full max-w-lg" />
      </div>

      <div className="flex flex-col items-center gap-5">
        {!showDynamicInstrument ? (
          <div>
            <p className="text-lg font-light">{profile.name}</p>
            {showExtras ? (
              <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                {traits.join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {showExtras && suggestion && autoRulesMode === "suggest" && !rulesHeld ? (
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

        {showExtras && autoRulesMode !== "off" ? (
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

        {showPairing ? (
          <DriveSessionPanel
            className="mt-2 w-full max-w-lg"
            devMode={devMode}
            onRelaySessionChange={onRelaySessionChange}
          />
        ) : null}
        {showTeslaUpgrade ? (
          <Suspense fallback={null}>
            <TeslaDrivePlusUpgrade
              open
              relaySessionId={relaySessionId}
              onClose={onCloseTeslaUpgrade}
              className="mt-4 w-full max-w-lg"
            />
          </Suspense>
        ) : null}
        <DynamicDriveTrialComplete className="mt-4" />
        {showDebugDiagnostics ? (
          <>
            <DrivePipelineMetrics metrics={pipelineMetrics} className="mt-2 w-full max-w-lg" />
            <DriveDiagnosticsPanel className="mt-2 w-full max-w-lg" />
          </>
        ) : null}
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
        ELCAMOSO responds to the motion of your car. Keep your attention on the road and adjust
        nothing while driving.
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
      <p className="text-xl font-light">
        {message === "Location unavailable" || !message ? "No motion yet." : message}
      </p>
      <p className="text-sm text-muted-foreground">
        Start moving and ELCAMOSO will bring the sound to life. You can also continue with GPS only
        or try Demo Drive.
      </p>
      <button
        onClick={onRetry}
        className="h-14 rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase"
      >
        Continue with GPS
      </button>
      <Link
        to="/demo"
        className="text-xs tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
      >
        Open Demo Drive
      </Link>
    </div>
  );
}
