import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { FoundersBanner } from "@/components/FoundersBanner";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { BrandLoader } from "@/components/BrandLoader";
import { StartDriveMarkControl } from "@/components/StartDriveMarkControl";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { getProfileGain } from "@/lib/drive/settings";
import { useHaptics } from "@/lib/drive/useHaptics";
import { useDriveSession } from "@/lib/drive/useDriveSession";
import { getSession, type DriveProductStatus } from "@/lib/drive/session";
import type { DriveState } from "@/lib/drive/model";
import { needsIntenseConfirm } from "@/lib/drive/safety";
import { DriveSessionPanel } from "@/components/DriveSessionPanel";
import { ExperiencePicker } from "@/components/experiences/ExperiencePicker";
import { experienceForProfileId } from "@/lib/experiences";
import { useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import {
  DynamicDriveTrialComplete,
  DynamicDriveTrialDuringDrive,
} from "@/components/dynamic-drive-trial";
import { DynamicDriveSessionConflictNotice } from "@/components/DynamicDriveSessionConflictNotice";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { DrivePipelineMetrics } from "@/components/DrivePipelineMetrics";
import { DriveDiagnosticsPanel } from "@/components/DriveDiagnosticsPanel";
import { TeslaRoadTestHud } from "@/components/TeslaRoadTestHud";
import { isDriveDebugModeActive } from "@/lib/diagnostics/debug-mode";
import type { MotionPipelineMetrics } from "@/lib/motion/pipeline-metrics";
import { formatSpeed, t } from "@/lib/i18n";
import { driveCoachFn } from "@/lib/cloud/server-fns";
import { getProfile, type SoundProfile } from "@/lib/sound/profiles";
import { PostDriveExperience } from "@/components/journey/PostDriveExperience";
import { track } from "@/lib/analytics/track";
import { SmilesModal } from "@/components/smiles/SmilesModal";
import { LockedSoundNotice } from "@/components/premium/LockedSoundNotice";
import { addDriveMessage, deliverPendingDrive } from "@/lib/inbox/inbox";
import type { JourneySummary } from "@/lib/journey/types";
import { DriveModePicker } from "@/components/drive/DriveModePicker";
import { DriveCockpit } from "@/components/drive/DriveCockpit";
import { DriveProfileBackdrop } from "@/components/drive/DriveProfileBackdrop";
import { SilentCaptureHud } from "@/components/drive/SilentCaptureHud";
import { PostSilentCaptureExperience } from "@/components/drive/PostSilentCaptureExperience";
import { IncompleteJourneyRecovery } from "@/components/drive/IncompleteJourneyRecovery";
import { shouldCaptureTrace, shouldPlayLiveAudio } from "@/lib/journey-trace";

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
    roadTest?: boolean;
    activateTrial?: boolean;
    upgrade?: string;
    start?: boolean;
    googleAuth?: string;
    pair?: string;
  } => {
    const raw = search["cockpit"];
    const debugRaw = search["debug"];
    const roadTestRaw = search["roadTest"];
    const activateRaw = search["activateTrial"];
    const startRaw = search["start"];
    const upgrade = typeof search["upgrade"] === "string" ? search["upgrade"] : undefined;
    const googleAuth = typeof search["googleAuth"] === "string" ? search["googleAuth"] : undefined;
    const out: {
      cockpit?: boolean;
      debug?: boolean;
      roadTest?: boolean;
      activateTrial?: boolean;
      upgrade?: string;
      start?: boolean;
      googleAuth?: string;
      pair?: string;
    } = {};
    if (raw === true || raw === "1" || raw === 1) out.cockpit = true;
    if (debugRaw === true || debugRaw === "1" || debugRaw === 1) out.debug = true;
    if (roadTestRaw === true || roadTestRaw === "1" || roadTestRaw === 1) out.roadTest = true;
    if (activateRaw === true || activateRaw === "1" || activateRaw === 1) out.activateTrial = true;
    if (startRaw === true || startRaw === "1" || startRaw === 1) out.start = true;
    if (upgrade) out.upgrade = upgrade;
    if (googleAuth) out.googleAuth = googleAuth;
    if (search["pair"] === "expired" || search["pair"] === "linked") out.pair = search["pair"];
    return out;
  },
  component: DriveScreen,
  head: () => createSeoHeadFromPath("/drive"),
});

function googleAuthMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "cancelled") return "Google sign-in was cancelled.";
  if (code === "missing") return "Google sign-in returned an incomplete response. Try again.";
  if (code === "expired") return "Google sign-in expired. Please try again.";
  if (code === "token") return "Google could not verify this sign-in. Try again in a moment.";
  if (code === "secret")
    return "Google client secret is invalid. Update GOOGLE_CLIENT_SECRET in .env.local and restart the dev server.";
  if (code === "unavailable") return "Google sign-in is not configured on this server.";
  if (code === "failed") return "Google sign-in failed. Please try again.";
  return "Google sign-in did not complete. Please try again.";
}

function DriveScreen() {
  const {
    cockpit,
    debug,
    roadTest,
    activateTrial,
    upgrade,
    start: autostart,
    googleAuth,
    pair,
  } = Route.useSearch();
  const navigate = useNavigate();
  const autostartHandled = useRef(false);
  const googleAuthNotice =
    googleAuthMessage(googleAuth) ??
    (pair === "expired"
      ? "Pairing code timed out. Same sound and mode are ready. Show a new QR on the car to link sensors."
      : pair === "linked"
        ? "Phone linked. Same sound and mode as the car."
        : null);
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
  const [showCapturePermission, setShowCapturePermission] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [postDriveJourneyId, setPostDriveJourneyId] = useState<string | null>(null);
  const [smilesJourney, setSmilesJourney] = useState<JourneySummary | null>(null);
  useEffect(() => {
    void deliverPendingDrive().then((j) => {
      if (j) setSmilesJourney(j);
    });
  }, []);
  const [postCaptureTraceId, setPostCaptureTraceId] = useState<string | null>(null);
  const [captureHadBrowserPause, setCaptureHadBrowserPause] = useState(false);
  const monetizationEnabled = useMonetizationEnabled();
  const selectedExperience = experienceForProfileId(settings.profileId);
  const isSilentCapture =
    status === "driving" && !shouldPlayLiveAudio(sessionSnap.driveOutputMode ?? "live");
  const resumedNativeCapture = status === "idle" && sessionSnap.nativeCapture.active;

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
    if (!googleAuth) return;
    // Clear the one-shot auth status from the URL after it has been read.
    const t = window.setTimeout(() => {
      void navigate({
        to: "/drive",
        search: {
          ...(cockpit ? { cockpit: true } : {}),
          ...(debug ? { debug: true } : {}),
          ...(roadTest ? { roadTest: true } : {}),
          ...(activateTrial ? { activateTrial: true } : {}),
          ...(upgrade ? { upgrade } : {}),
        },
        replace: true,
      });
    }, 8000);
    return () => window.clearTimeout(t);
  }, [activateTrial, cockpit, debug, googleAuth, navigate, roadTest, upgrade]);

  useEffect(() => {
    getSession().setCockpit(Boolean(cockpit));
    void getSession().syncNativeJourneys();
  }, [cockpit]);

  useEffect(() => {
    if (!sessionSnap.nativeCapture.active) return;
    const timer = window.setInterval(() => void getSession().syncNativeJourneys(), 1000);
    return () => window.clearInterval(timer);
  }, [sessionSnap.nativeCapture.active]);

  const debugDriveActive = isDriveDebugModeActive(settings, Boolean(debug));
  const roadTestHudActive = debugDriveActive || (settings.devPanel && Boolean(roadTest));

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
      shouldCaptureTrace(settings.driveOutputMode) &&
      sessionSnap.nativeCapture.backgroundCapable
    ) {
      setShowCapturePermission(true);
      return;
    }
    if (
      shouldPlayLiveAudio(settings.driveOutputMode) &&
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

  const handleStop = async () => {
    const before = getSession().snapshot();
    const hadCapture = shouldCaptureTrace(before.driveOutputMode ?? "live");
    const paused = before.capturePausedByBrowser;
    await stop();
    const snap = getSession().snapshot();
    const aggregates = snap.lastAggregates;
    if (hadCapture && snap.lastJourneyTraceId) {
      setCaptureHadBrowserPause(paused);
      setPostCaptureTraceId(snap.lastJourneyTraceId);
    }
    // Live drives: stay on Drive (ready to go again); the Smiles pop-up links to the drive-sound page.
    const finished = getSession().getLastJourney();
    if (finished && finished.id === snap.lastJourneyId) {
      addDriveMessage(finished);
      track("drive_end", {
        km: Math.round((finished.distanceM ?? 0) / 100) / 10,
        durationMs: finished.durationMs,
        profileId: finished.profileId,
      });
      // Always show the card after STOP; very short drives get a friendly note inside the card.
      window.setTimeout(() => setSmilesJourney(finished), 600);
    }
    if (aggregates && shouldPlayLiveAudio(before.driveOutputMode ?? "live")) {
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
    if (shouldCaptureTrace(settings.driveOutputMode) && sessionSnap.nativeCapture.backgroundCapable)
      setShowCapturePermission(true);
    else void start();
  };

  const liveProfile = getProfile(sessionSnap.profileId);
  const speed = formatSpeed(state.speed, settings.units, settings.language, {
    profileId: liveProfile.id,
    knotsForNautical: settings.knotsForNautical,
  });
  const safetyMode = sessionSnap.safetyMode || Boolean(cockpit);

  return (
    <main className="relative flex min-h-screen flex-col px-6 pt-6 pb-10 sm:px-10">
      {status === "idle" ? (
        <FoundersBanner compact className="fixed inset-x-0 bottom-0 z-30 hidden border-t border-b-0 sm:block" />
      ) : null}
      {status === "idle" && !sessionSnap.nativeCapture.active ? (
        <IncompleteJourneyRecovery />
      ) : null}
      {status === "idle" ? <LockedSoundNotice className="mb-4" /> : null}
      {status === "idle" && sessionSnap.journeyRecovered ? (
        <p className="mx-auto mb-4 w-full max-w-md border border-foreground/20 px-4 py-3 text-center text-sm">
          Journey recovered.
        </p>
      ) : null}
      {postCaptureTraceId ? (
        <PostSilentCaptureExperience
          journeyTraceId={postCaptureTraceId}
          capturePausedByBrowser={captureHadBrowserPause}
          onDismiss={() => setPostCaptureTraceId(null)}
        />
      ) : null}
      <SmilesModal
        journey={smilesJourney}
        onClose={() => setSmilesJourney(null)}
        onOpenDriveSound={(id) => {
          setSmilesJourney(null);
          setPostDriveJourneyId(id);
        }}
      />
      {postDriveJourneyId ? (
        <PostDriveExperience
          journeyId={postDriveJourneyId}
          onDismiss={() => setPostDriveJourneyId(null)}
        />
      ) : null}
      {showSafety ? (
        <Safety onAccept={acknowledge} onCancel={() => setShowSafety(false)} />
      ) : showCapturePermission ? (
        <CapturePermission
          quality={settings.captureQuality}
          onQualityChange={(captureQuality) => update({ captureQuality })}
          onAccept={() => {
            setShowCapturePermission(false);
            beginDrive();
          }}
          onCancel={() => setShowCapturePermission(false)}
        />
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
      ) : resumedNativeCapture ? (
        <SilentCaptureHud
          elapsedMs={sessionSnap.nativeCapture.durationMs}
          distanceM={sessionSnap.nativeCapture.distanceM}
          sensorLabel="Phone sensor"
          sensorConnected
          capturePausedByBrowser={false}
          suggestFinish={false}
          backgroundCapable
          quality={sessionSnap.nativeCapture.quality}
          sampleCount={sessionSnap.nativeCapture.sampleCount}
          onStop={() => void handleStop()}
          onContinue={() => undefined}
          onFinishSuggested={() => void handleStop()}
        />
      ) : status === "error" ? (
        <ErrorState message={error} onRetry={() => void start()} />
      ) : status === "starting" ? (
        <div className="flex flex-1 items-center justify-center">
          <BrandLoader label="Preparing your drive" />
        </div>
      ) : status === "driving" ? (
        isSilentCapture ? (
          <SilentCaptureHud
            elapsedMs={
              sessionSnap.nativeCapture.backgroundCapable && sessionSnap.nativeCapture.active
                ? sessionSnap.nativeCapture.durationMs
                : (sessionSnap.recordingElapsedMs ?? 0)
            }
            distanceM={sessionSnap.recordingDistanceM ?? 0}
            sensorLabel={
              sessionSnap.productStatus === "vehicle-connected" ? "Vehicle" : "Phone sensor"
            }
            sensorConnected={
              sessionSnap.productStatus !== "weak-signal" && sessionSnap.productStatus !== "idle"
            }
            capturePausedByBrowser={Boolean(sessionSnap.capturePausedByBrowser)}
            suggestFinish={Boolean(sessionSnap.suggestFinishJourney)}
            backgroundCapable={sessionSnap.nativeCapture.backgroundCapable}
            quality={sessionSnap.nativeCapture.quality}
            sampleCount={sessionSnap.nativeCapture.sampleCount}
            onStop={() => void handleStop()}
            onContinue={() => getSession().continueCapture()}
            onFinishSuggested={() => void handleStop()}
          />
        ) : (
          <Driving
            kmh={speed.text}
            unit={speed.unit}
            speedMps={state.speed}
            reducedMotion={reducedMotion}
            profile={liveProfile}
            productStatus={sessionSnap.productStatus}
            sessionKind={sessionSnap.kind}
            driveState={state}
            onStop={handleStop}
            showDebugDiagnostics={debugDriveActive}
            showRoadTestHud={roadTestHudActive}
            pipelineMetrics={sessionSnap.pipeline}
            dynamicDriveActive={settings.dynamicDrive}
            safetyMode={safetyMode}
          />
        )
      ) : (
        <>
          <DriveProfileBackdrop profileId={settings.profileId} className="z-0" />
          <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-10 text-center">
            {googleAuthNotice ? (
              <p
                className="max-w-sm rounded-full border border-border px-5 py-3 text-xs text-muted-foreground"
                role="status"
              >
                {googleAuthNotice}
              </p>
            ) : null}
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
            <div>
              <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                Selected experience
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-2 text-2xl font-light hover:opacity-80"
              >
                {selectedExperience.name}
              </button>
              <p className="mt-3 text-sm text-muted-foreground">
                {selectedExperience.tagline || profile.traits.join(" · ")}
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-4 text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
              >
                Change experience
              </button>
            </div>
            <StartDriveMarkControl
              reducedMotion={reducedMotion}
              waveResponse={profile.voice.waveResponse}
              revealFace
              lines={
                settings.driveOutputMode === "capture" ? ["Silent", "Capture"] : ["Start", "Drive"]
              }
              onStart={() => void handleStart()}
            />
            <div className="w-full max-w-md">
              <DriveModePicker
                value={settings.driveOutputMode}
                onChange={(driveOutputMode) => update({ driveOutputMode })}
              />
            </div>
            {coach ? <p className="max-w-sm text-sm text-muted-foreground">{coach}</p> : null}
            {!safetyMode ? (
              <Link
                to="/replay"
                className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase"
              >
                Drive recordings
              </Link>
            ) : null}
            <DriveSessionPanel
              className="max-w-lg"
              compact
              devMode={debugDriveActive}
              onRelaySessionChange={setRelaySessionId}
            />
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
            <ExperiencePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
          </div>
        </>
      )}
    </main>
  );
}

function Driving({
  kmh,
  unit,
  speedMps,
  reducedMotion,
  profile,
  productStatus,
  sessionKind,
  driveState,
  onStop,
  showDebugDiagnostics,
  showRoadTestHud,
  pipelineMetrics,
  dynamicDriveActive,
  safetyMode,
}: {
  kmh: number | string;
  unit: string;
  speedMps: number;
  reducedMotion: boolean;
  profile: ReturnType<typeof getProfile>;
  productStatus: DriveProductStatus;
  sessionKind: string;
  driveState: DriveState;
  onStop: () => void;
  showDebugDiagnostics: boolean;
  showRoadTestHud: boolean;
  pipelineMetrics: MotionPipelineMetrics;
  dynamicDriveActive: boolean;
  safetyMode: boolean;
}) {
  return (
    <div className="relative z-[1] flex flex-1 flex-col">
      <DriveCockpit
        profile={profile}
        driveState={driveState}
        productStatus={productStatus}
        sessionKind={sessionKind}
        displaySpeed={kmh}
        speedUnit={unit}
        speedMps={speedMps}
        reducedMotion={reducedMotion}
        onStop={onStop}
        className={safetyMode ? "drive-tesla-cockpit" : undefined}
      />
      {/* Minimal notices only - purchases, pairing, and rewards stay outside active Drive. */}
      <div className="mx-auto w-full max-w-lg px-4 pb-2">
        <DynamicDriveTrialDuringDrive
          dynamicDriveActive={dynamicDriveActive}
          safetyMode={safetyMode}
        />
        <DynamicDriveSessionConflictNotice className="mt-2 w-full" />
        {showRoadTestHud ? <TeslaRoadTestHud className="mt-2 w-full" /> : null}
        {showDebugDiagnostics ? (
          <>
            <DrivePipelineMetrics metrics={pipelineMetrics} className="mt-2 w-full" />
            <DriveDiagnosticsPanel className="mt-2 w-full" />
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

function CapturePermission({
  quality,
  onQualityChange,
  onAccept,
  onCancel,
}: {
  quality: "balanced" | "high-detail";
  onQualityChange: (quality: "balanced" | "high-detail") => void;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-7 text-center">
      <ElcamosoMark className="h-10 w-auto" />
      <h1 className="text-xl font-light">Allow background drive capture?</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Allow ELCAMOSO to record motion during a drive even when your screen is locked.
        <br />
        <br />
        Your route is not saved.
        <br />
        Motion data stays on your device unless you choose to share something.
      </p>
      <fieldset className="w-full text-left">
        <legend className="mb-3 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Capture quality
        </legend>
        <label className="flex cursor-pointer items-start gap-3 border border-foreground/30 p-4">
          <input
            type="radio"
            name="capture-quality"
            checked={quality === "balanced"}
            onChange={() => onQualityChange("balanced")}
          />
          <span>
            <span className="block text-sm">Balanced · Recommended</span>
            <span className="text-xs text-muted-foreground">
              Reliable motion with lower battery use.
            </span>
          </span>
        </label>
        <label className="mt-2 flex cursor-pointer items-start gap-3 border border-foreground/20 p-4">
          <input
            type="radio"
            name="capture-quality"
            checked={quality === "high-detail"}
            onChange={() => onQualityChange("high-detail")}
          />
          <span>
            <span className="block text-sm">High detail</span>
            <span className="text-xs text-muted-foreground">
              More frequent location updates and higher battery use.
            </span>
          </span>
        </label>
      </fieldset>
      <div className="flex w-full flex-col gap-3">
        <button
          onClick={onAccept}
          className="h-14 rounded-full bg-primary text-sm tracking-[0.22em] text-primary-foreground uppercase"
        >
          Continue
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
