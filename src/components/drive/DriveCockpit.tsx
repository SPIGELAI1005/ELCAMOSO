import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ElcamosoLogo } from "@/components/ElcamosoLogo";
import { PremiumBadge } from "@/components/premium/PremiumBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DriveState } from "@/lib/drive/model";
import { getSession, type DriveProductStatus } from "@/lib/drive/session";
import {
  cockpitFavouriteSlots,
  cockpitSecondaryView,
  cockpitSpeedAvailability,
  cockpitTelemetryLabel,
  formatCockpitSpeed,
  stepMasterVolume,
  volumePercentLabel,
} from "@/lib/drive/cockpit-model";
import {
  applyCockpitProfileSwitch,
  createProfileSwitchController,
  favouriteSlotAccess,
} from "@/lib/drive/cockpit-profile-switch";
import { useSettings } from "@/lib/drive/useSettings";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import { DriveProfileBackdrop } from "@/components/drive/DriveProfileBackdrop";
import {
  getProfile,
  PROFILE_CATEGORIES,
  SOUND_PROFILES,
  type SoundProfile,
} from "@/lib/sound/profiles";
import { SHIFT_MAP_PRESET_IDS, type ShiftMapPresetId } from "@/lib/powertrain/shift-presets";
import {
  moodLabel,
  motionStageIndex,
  nextMoodId,
  resolveActiveMoodId,
  resolveDriveShiftPersona,
} from "@/lib/drive/drive-shift-persona";
import { cn } from "@/lib/utils";
import { ModeTachometer } from "@/components/drive/ModeTachometer";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { resolveTachThemeId, type TachThemeId } from "@/lib/drive/tach-theme";

const COCKPIT_SELECT_TRIGGER =
  "h-12 min-h-12 w-full min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-light shadow-none focus:ring-1 focus:ring-foreground/40 data-[state=open]:border-foreground/60";

const COCKPIT_SELECT_CONTENT =
  "max-h-[min(50vh,22rem)] overflow-y-auto rounded-2xl border border-border bg-background p-1.5 text-foreground shadow-none";

const COCKPIT_SELECT_ITEM =
  "cursor-pointer rounded-full py-2.5 pl-3.5 pr-9 text-sm font-light focus:bg-foreground focus:text-background data-[state=checked]:bg-foreground/12 data-[state=checked]:text-foreground data-[disabled]:opacity-40";

const COCKPIT_FOOTER_BTN =
  "flex h-14 min-h-14 items-center justify-center rounded-full border border-border text-[11px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:border-foreground/60 hover:text-foreground";

/** Last portion of the tach treated as the redline zone. */
const REDLINE_ZONE_START = 0.82;
const REDLINE_COLOR = "#e53935";
const CATALOG_IDS = new Set(SOUND_PROFILES.map((p) => p.id));

function shiftPresetLabel(id: ShiftMapPresetId) {
  if (id === "legacy") return "Classic";
  if (id === "city") return "City";
  if (id === "touring") return "Touring";
  if (id === "race") return "Race";
  return "Sport";
}

function nextShiftPreset(id: ShiftMapPresetId): ShiftMapPresetId {
  const index = SHIFT_MAP_PRESET_IDS.indexOf(id);
  const next = SHIFT_MAP_PRESET_IDS[(index + 1) % SHIFT_MAP_PRESET_IDS.length];
  return next ?? "legacy";
}

export interface DriveCockpitProps {
  profile: SoundProfile;
  driveState: DriveState;
  productStatus: DriveProductStatus;
  sessionKind: string;
  /** Display speed already converted for units (km/h or mph). */
  displaySpeed: number | string;
  speedUnit: string;
  speedMps: number;
  reducedMotion?: boolean | undefined;
  onStop: () => void;
  className?: string | undefined;
  /** Dev/preview only: force a tachometer design. */
  tachThemeOverride?: TachThemeId | undefined;
}

/** Round paddle / stop controls: 36px → 54px (+50%). */
const GEAR_ROW_BTN =
  "flex h-[3.375rem] w-[3.375rem] min-h-[3.375rem] min-w-[3.375rem] shrink-0 items-center justify-center rounded-full border border-border text-[0.8125rem] leading-none tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:border-foreground/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-35";

function CockpitGearLadder({
  gearCount,
  activeGear,
  shifting,
  reducedMotion,
  modeLabel,
  stageNames,
  onStop,
  onGearDown,
  onGearUp,
  onCycleMode,
}: {
  gearCount: number;
  activeGear: number;
  shifting: boolean;
  reducedMotion: boolean;
  modeLabel: string | null;
  stageNames: readonly string[] | null;
  onStop: () => void;
  onGearDown: () => void;
  onGearUp: () => void;
  onCycleMode: (() => void) | null;
}) {
  if (gearCount < 2) return null;
  const inNeutral = activeGear < 1;
  const active = inNeutral ? 0 : Math.min(gearCount, Math.max(1, Math.round(activeGear)));
  // From N, either paddle engages 1st; otherwise adjacent gears only.
  const canDown = !shifting && (inNeutral || active > 1);
  const canUp = !shifting && (inNeutral || active < gearCount);

  return (
    <div
      className="mt-2 grid w-full grid-cols-2 items-center gap-x-2 gap-y-2.5"
      role="group"
      aria-label={
        shifting ? `Shifting to gear ${active || 1}` : inNeutral ? "Neutral" : `Gear ${active}`
      }
    >
      {/* Equal thirds: gears in the middle column stay on the tach center. */}
      <div className="flex min-h-[3.375rem] min-w-0 items-center justify-end gap-2">
        <button
          type="button"
          onClick={onStop}
          className={cn(
            GEAR_ROW_BTN,
            "border-[color-mix(in_oklab,var(--cockpit-redline)_70%,transparent)] font-semibold tracking-[0.14em] text-[var(--cockpit-redline)] hover:border-[var(--cockpit-redline)] hover:text-[var(--cockpit-redline)] bg-[color-mix(in_oklab,var(--cockpit-redline)_8%,transparent)]",
          )}
          aria-label="Stop Drive"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={onGearDown}
          disabled={!canDown}
          className={GEAR_ROW_BTN}
          aria-label="Gear down"
        >
          Down
        </button>
      </div>
      <div
        className="pointer-events-none col-span-2 row-start-1 mx-auto flex w-full max-w-[18rem] min-w-0 items-center justify-center gap-1 overflow-hidden px-0.5 sm:max-w-[22rem] sm:gap-1.5"
        role="status"
      >
        {Array.from({ length: gearCount }, (_, i) => i + 1).map((gear) => {
          const isActive = !inNeutral && gear === active;
          const tick = stageNames?.[gear - 1];
          return (
            <span
              key={gear}
              title={tick ?? String(gear)}
              className={cn(
                "flex h-6 min-w-6 max-w-[2.75rem] shrink items-center sm:h-7 sm:min-w-7 sm:shrink-0 justify-center rounded-full px-1 text-[10px] tracking-wide transition-[transform,background-color,color,box-shadow] duration-200",
                tick ? "truncate" : "tabular-nums text-[11px]",
                isActive ? "bg-foreground text-background" : "text-muted-foreground/55",
                isActive && shifting && !reducedMotion
                  ? "scale-110 shadow-[0_0_0_2px_var(--cockpit-redline)]"
                  : null,
                isActive && !reducedMotion ? "scale-105" : null,
              )}
            >
              {tick ? tick.slice(0, 4) : gear}
            </span>
          );
        })}
        {modeLabel ? (
          <span
            className="ml-1 max-w-[4.75rem] shrink-0 truncate whitespace-nowrap rounded-full bg-foreground px-2 py-1 text-[9px] leading-none tracking-[0.08em] text-background uppercase"
            aria-hidden="true"
          >
            {modeLabel}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-[3.375rem] min-w-0 items-center justify-start gap-2">
        <button
          type="button"
          onClick={onGearUp}
          disabled={!canUp}
          className={GEAR_ROW_BTN}
          aria-label="Gear up"
        >
          Up
        </button>
        {onCycleMode ? (
          <button
            type="button"
            onClick={onCycleMode}
            className={GEAR_ROW_BTN}
            aria-label={`Mode ${modeLabel}. Tap to cycle.`}
          >
            Mode
          </button>
        ) : null}
        {modeLabel ? (
          <span
            className="hidden whitespace-nowrap rounded-full bg-foreground px-2.5 py-1.5 text-[9px] leading-none tracking-[0.08em] text-background uppercase"
            role="status"
            aria-live="polite"
            aria-label={`Mode ${modeLabel}`}
          >
            {modeLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function useFullscreenAvailable() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen));
  }, []);
  return ok;
}

/**
 * Premium Drive Cockpit - motion-locked, uncluttered, design-token UI.
 * Shared settings.profileId / volume with Settings; favourites strip for fast switches.
 */
export function DriveCockpit({
  profile,
  driveState,
  productStatus,
  sessionKind,
  displaySpeed,
  speedUnit,
  speedMps,
  reducedMotion: reducedMotionProp,
  onStop,
  className,
  tachThemeOverride,
}: DriveCockpitProps) {
  const { settings, update } = useSettings();
  const reducedMotionHook = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? reducedMotionHook;
  const { canDriveWithProfile } = useFeatureAccess();
  const switchCtrl = useRef(createProfileSwitchController());
  const [switchStatus, setSwitchStatus] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const volumeBeforeMute = useRef(settings.volume > 0 ? settings.volume : 0.35);
  const fullscreenOk = useFullscreenAvailable();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  /** Thematic stage paddle hold (continuous personas). */
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const stageHoldTimer = useRef(0);

  const freshness = driveState.powertrain?.speedFreshness ?? null;
  const availability = cockpitSpeedAvailability({
    productStatus,
    speedFreshness: freshness,
    sessionKind,
  });
  const speedView = formatCockpitSpeed(speedMps, availability, speedUnit, displaySpeed);
  const drivetrain = useMemo(() => resolveDrivetrain(profile), [profile]);
  const gearRatioCount = drivetrain.personality.transmission.gearRatios.length;
  const shiftPersona = useMemo(
    () => resolveDriveShiftPersona(profile, gearRatioCount),
    [profile, gearRatioCount],
  );
  const secondary = cockpitSecondaryView(profile, driveState, {
    stageOverride,
    gearRatioCount,
  });
  const redline = drivetrain.personality.engine.redlineRpm;
  const idle = drivetrain.personality.engine.idleRpm;
  const rpm = driveState.powertrain?.rpm ?? driveState.rpm;
  const showTachRedline = secondary.showRpm && secondary.kind === "gear";
  const arcProgress =
    showTachRedline && redline > idle
      ? Math.min(1, Math.max(0, (rpm - idle) / (redline - idle)))
      : secondary.arcProgress;
  const isShifting = Boolean(driveState.powertrain?.shifting ?? driveState.isShifting);
  const inRedline = showTachRedline && arcProgress >= REDLINE_ZONE_START;

  const favourites = useMemo(
    () => cockpitFavouriteSlots(settings.favourites, CATALOG_IDS, 3),
    [settings.favourites],
  );

  const soundGroups = useMemo(
    () =>
      PROFILE_CATEGORIES.map((category) => ({
        category,
        profiles: SOUND_PROFILES.filter((p) => p.category === category),
      })).filter((group) => group.profiles.length > 0),
    [],
  );

  const telemetry = cockpitTelemetryLabel(productStatus);
  const showShiftPreset = shiftPersona.modeBinding === "shift-map";
  const activeMoodId = resolveActiveMoodId(
    shiftPersona,
    settings.driveMoodByProfile[profile.id],
    settings.shiftMapPreset,
  );
  const activeMoodLabel = moodLabel(shiftPersona, activeMoodId);
  const tachThemeId =
    tachThemeOverride ??
    resolveTachThemeId({
      profileId: profile.id,
      category: profile.category,
      modeBinding: shiftPersona.modeBinding,
      modeId: activeMoodId,
      speedUnit,
    });
  useEffect(() => {
    getSession().setSmilesHint({ raceMode: tachThemeId === "race", redlineRpm: redline });
  }, [tachThemeId, redline]);
  const usesPowertrainGears = shiftPersona.modeBinding === "shift-map";
  const ladderCount = shiftPersona.ladderCount ?? 0;
  const motionStage = motionStageIndex(driveState, Math.max(2, ladderCount || 2));
  const activeLadderGear = usesPowertrainGears
    ? (driveState.powertrain?.gear ?? driveState.gear)
    : (stageOverride ?? motionStage);

  useEffect(() => {
    setStageOverride(null);
    if (stageHoldTimer.current) window.clearTimeout(stageHoldTimer.current);
  }, [profile.id]);

  useEffect(() => {
    return () => {
      if (stageHoldTimer.current) window.clearTimeout(stageHoldTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!muted && settings.volume > 0) volumeBeforeMute.current = settings.volume;
  }, [settings.volume, muted]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!switchStatus) return;
    const t = window.setTimeout(() => setSwitchStatus(null), 2800);
    return () => window.clearTimeout(t);
  }, [switchStatus]);

  async function selectProfile(profileId: string) {
    const gen = switchCtrl.current.request(profileId);
    const outcome = await applyCockpitProfileSwitch({
      profileId,
      activeProfileId: settings.profileId,
      generation: gen,
      isCurrent: (g) => switchCtrl.current.isCurrent(g),
      canDriveWithProfile,
      apply: (id) => {
        update({ profileId: id });
      },
    });
    if (outcome === "locked") {
      setSwitchStatus("Locked - Drive+ required");
      return;
    }
    if (outcome === "failed") {
      setSwitchStatus("Sound switch failed - keeping current");
      return;
    }
    if (outcome === "stale" || outcome === "same") return;
    setSwitchStatus(null);
  }

  async function pickSound(profileId: string) {
    setSoundsOpen(false);
    await selectProfile(profileId);
  }

  function nudgeVolume(dir: 1 | -1) {
    if (muted) {
      setMuted(false);
      const restored = stepMasterVolume(volumeBeforeMute.current, dir);
      update({ volume: restored });
      return;
    }
    update({ volume: stepMasterVolume(settings.volume, dir) });
  }

  function toggleMute() {
    if (muted) {
      setMuted(false);
      update({ volume: volumeBeforeMute.current > 0 ? volumeBeforeMute.current : 0.35 });
      return;
    }
    if (settings.volume > 0) volumeBeforeMute.current = settings.volume;
    setMuted(true);
    update({ volume: 0 });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      /* browser / device restriction - optional enhancement */
    }
  }

  const effectiveVolume = muted ? 0 : settings.volume;

  return (
    <div
      className={cn(
        "drive-cockpit relative z-[1] flex flex-1 flex-col text-foreground",
        "px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-8",
        className,
      )}
      style={{ ["--cockpit-redline" as string]: REDLINE_COLOR }}
      data-testid="drive-cockpit"
    >
      <DriveProfileBackdrop profileId={profile.id} className="z-0" />

      <header className="drive-cockpit__header relative z-[1] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <ElcamosoLogo
          variant="full"
          intensity={Math.min(1, Math.max(driveState.load, driveState.throttle))}
          reducedMotion={reducedMotion}
          className="justify-self-start"
          wordmarkClassName="tracking-[0.28em] max-sm:!hidden"
        />
        <div className="min-w-0 max-w-[min(56vw,28rem)] justify-self-center text-center">
          <p className="truncate text-sm font-light tracking-[0.04em] sm:text-base">
            {profile.name}
          </p>
          {switchStatus ? (
            <p
              className="mt-0.5 truncate text-[11px] tracking-[0.12em] text-muted-foreground uppercase"
              role="status"
            >
              {switchStatus}
            </p>
          ) : null}
        </div>
        <p
          className="justify-self-end text-[10px] tracking-[0.28em] text-muted-foreground uppercase"
          aria-label={telemetry ? `Motion ${telemetry}` : "Motion"}
        >
          {telemetry || "\u00a0"}
        </p>
      </header>

      <section
        className="drive-cockpit__centre relative z-[1] mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center py-2 sm:py-4"
        aria-label="Speed and drivetrain"
      >
        <div className="relative mx-auto aspect-square w-[min(58vw,220px)] max-w-full place-items-center sm:w-[280px]">
          <ModeTachometer
            themeId={tachThemeId}
            introKey={`${profile.id}:${activeMoodId}`}
            progress={arcProgress}
            size={300}
            reducedMotion={reducedMotion}
            redlineRpm={showTachRedline ? redline : null}
            showZone={showTachRedline || tachThemeId === "rocket" || tachThemeId === "warp"}
            raceReadout={
              tachThemeId === "race"
                ? {
                    gear: String(secondary.value),
                    speed: String(speedView.value),
                    unit: speedUnit,
                    rpmText: secondary.showRpm ? secondary.rpmText : null,
                  }
                : null
            }
          />
          <div
            className={cn(
              "absolute inset-0 z-[1] flex flex-col items-center justify-center px-5 text-center",
              tachThemeId === "race" && "sr-only",
            )}
          >
            <p
              className={cn(
                "drive-cockpit__speed font-extralight tabular-nums leading-none tracking-tight transition-colors duration-200",
                inRedline ? "text-[var(--cockpit-redline)]" : null,
                speedUnit === "c" ? "!text-[clamp(1.6rem,7vw,3rem)]" : null,
              )}
              aria-live="off"
            >
              {speedView.value}
            </p>
            {speedView.showUnit ? (
              <p
                className={cn(
                  "mt-1.5 text-[11px] tracking-[0.34em] text-muted-foreground uppercase",
                  speedUnit === "c" ? "tracking-[0.22em]" : null,
                )}
              >
                {speedUnit === "c" ? "of light speed" : speedUnit}
              </p>
            ) : null}
            {speedView.showUnit && speedUnit === "c" ? (
              <p className="mt-1 text-[10px] tracking-[0.18em] text-muted-foreground/70 tabular-nums">
                ≈ {Math.round(Math.max(0, speedMps) * 3.6)} km/h
              </p>
            ) : null}
            {speedView.caption ? (
              <p className="mt-1.5 max-w-[16rem] text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                {speedView.caption}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex w-full flex-col items-center gap-0.5 sm:mt-3 sm:gap-1">
          <div className="flex items-baseline gap-3">
            <p
              className={cn(
                "text-3xl font-extralight tabular-nums transition-colors duration-200 sm:text-4xl",
                isShifting ? "text-[var(--cockpit-redline)]" : null,
              )}
              aria-live="off"
            >
              {secondary.value}
            </p>
            {secondary.showRpm ? (
              <p
                className={cn(
                  "text-lg font-light tabular-nums sm:text-xl",
                  inRedline ? "text-[var(--cockpit-redline)]" : "text-muted-foreground",
                )}
                aria-live="off"
              >
                {secondary.rpmText}
              </p>
            ) : null}
          </div>
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            {secondary.label}
            {secondary.showRpm ? " · Rev" : ""}
          </p>
          {secondary.kind === "gear" && ladderCount >= 2 ? (
            <CockpitGearLadder
              gearCount={ladderCount}
              activeGear={activeLadderGear}
              shifting={usesPowertrainGears && isShifting}
              reducedMotion={reducedMotion}
              modeLabel={activeMoodLabel}
              stageNames={usesPowertrainGears ? null : shiftPersona.stageNames}
              onStop={onStop}
              onGearDown={() => {
                if (usesPowertrainGears) {
                  getSession().requestManualShift("down");
                  return;
                }
                const current = stageOverride ?? motionStage;
                const next = current < 1 ? 1 : Math.max(1, current - 1);
                setStageOverride(next);
                if (stageHoldTimer.current) window.clearTimeout(stageHoldTimer.current);
                stageHoldTimer.current = window.setTimeout(() => setStageOverride(null), 2200);
              }}
              onGearUp={() => {
                if (usesPowertrainGears) {
                  getSession().requestManualShift("up");
                  return;
                }
                const current = stageOverride ?? motionStage;
                const next = current < 1 ? 1 : Math.min(ladderCount, current + 1);
                setStageOverride(next);
                if (stageHoldTimer.current) window.clearTimeout(stageHoldTimer.current);
                stageHoldTimer.current = window.setTimeout(() => setStageOverride(null), 2200);
              }}
              onCycleMode={() => {
                if (shiftPersona.modeBinding === "shift-map") {
                  update({ shiftMapPreset: nextShiftPreset(settings.shiftMapPreset) });
                  return;
                }
                const next = nextMoodId(shiftPersona, activeMoodId);
                update({
                  driveMoodByProfile: {
                    ...settings.driveMoodByProfile,
                    [profile.id]: next,
                  },
                });
              }}
            />
          ) : null}
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground/80 uppercase">
            {secondary.simulatedCaption}
          </p>
        </div>
      </section>

      <footer className="drive-cockpit__footer relative z-[1] mx-auto flex w-full max-w-lg flex-col gap-3 pt-1 sm:gap-4 sm:pt-2">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Favourite sounds">
          {([0, 1, 2] as const).map((slot) => {
            const id = favourites[slot];
            if (!id) {
              return (
                <div
                  key={`empty-${slot}`}
                  className="flex h-14 items-center justify-center rounded-full border border-border/50 text-[10px] tracking-[0.16em] text-muted-foreground/50 uppercase"
                  aria-hidden="true"
                >
                  —
                </div>
              );
            }
            const favProfile = getProfile(id);
            const access = favouriteSlotAccess(id, canDriveWithProfile);
            const active = id === profile.id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void selectProfile(id)}
                aria-pressed={active}
                aria-label={`${favProfile.name}${access === "locked" ? ", locked" : ""}`}
                className={cn(
                  "flex h-14 min-h-14 items-center justify-center truncate rounded-full border px-2 text-[11px] tracking-[0.12em] uppercase transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground hover:border-foreground/60",
                  access === "locked" ? "opacity-55" : "",
                )}
              >
                <span className="truncate">{favProfile.name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSoundsOpen(true)}
            className={COCKPIT_FOOTER_BTN}
            aria-haspopup="dialog"
            aria-expanded={soundsOpen}
          >
            All sounds
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={COCKPIT_FOOTER_BTN}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            More
          </button>
        </div>

        <div
          className="flex items-center justify-between gap-2"
          role="group"
          aria-label="Master volume"
        >
          <button
            type="button"
            onClick={() => nudgeVolume(-1)}
            className="flex h-14 w-14 min-h-14 min-w-14 items-center justify-center rounded-full border border-border text-lg"
            aria-label="Volume down"
          >
            −
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className={cn(
              "flex h-14 min-h-14 flex-1 items-center justify-center rounded-full border px-4 text-[11px] tracking-[0.2em] uppercase",
              muted || effectiveVolume <= 0
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground",
            )}
            aria-pressed={muted || effectiveVolume <= 0}
            aria-label={muted || effectiveVolume <= 0 ? "Unmute" : "Mute"}
          >
            {volumePercentLabel(effectiveVolume, muted)}
          </button>
          <button
            type="button"
            onClick={() => nudgeVolume(1)}
            className="flex h-14 w-14 min-h-14 min-w-14 items-center justify-center rounded-full border border-border text-lg"
            aria-label="Volume up"
          >
            +
          </button>
        </div>
      </footer>

      <Sheet open={soundsOpen} onOpenChange={setSoundsOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[min(78vh,36rem)] flex-col gap-0 rounded-t-3xl border-border px-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 text-left">
            <SheetTitle className="font-light tracking-[0.18em] uppercase">Sounds</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Tap a sound to switch. Favourites stay one tap on the cluster.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {soundGroups.map(({ category, profiles }) => (
              <div key={category} className="mb-3">
                <p className="px-3 py-1.5 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  {category}
                </p>
                <div className="flex flex-col gap-1">
                  {profiles.map((item) => {
                    const locked = !canDriveWithProfile(item.id);
                    const active = item.id === profile.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={locked && !active}
                        onClick={() => void pickSound(item.id)}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                          active
                            ? "bg-foreground text-background"
                            : locked
                              ? "cursor-not-allowed text-muted-foreground/50"
                              : "hover:bg-secondary",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-light">{item.name}</span>
                          <span
                            className={cn(
                              "mt-0.5 block line-clamp-1 text-[11px]",
                              active ? "text-background/70" : "text-muted-foreground",
                            )}
                          >
                            {item.traits.join(" · ")}
                          </span>
                        </span>
                        {locked ? <PremiumBadge className="mt-0.5 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="flex flex-col gap-4 rounded-t-3xl border-border px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
        >
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="font-light tracking-[0.18em] uppercase">More</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Secondary drive controls. Keep your eyes on the road.
            </SheetDescription>
          </SheetHeader>

          {showShiftPreset ? (
            <div className="flex min-h-12 items-center gap-3">
              <span className="shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Shift
              </span>
              <Select
                value={settings.shiftMapPreset}
                onValueChange={(id) => update({ shiftMapPreset: id as ShiftMapPresetId })}
              >
                <SelectTrigger className={COCKPIT_SELECT_TRIGGER} aria-label="Shift preset">
                  <SelectValue>{shiftPresetLabel(settings.shiftMapPreset)}</SelectValue>
                </SelectTrigger>
                <SelectContent position="item-aligned" className={COCKPIT_SELECT_CONTENT}>
                  {SHIFT_MAP_PRESET_IDS.map((id) => (
                    <SelectItem key={id} value={id} className={COCKPIT_SELECT_ITEM}>
                      {shiftPresetLabel(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {fullscreenOk ? (
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className={COCKPIT_FOOTER_BTN}
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? "Exit full" : "Fullscreen"}
              </button>
            ) : (
              <span />
            )}
            <Link to="/settings" onClick={() => setMoreOpen(false)} className={COCKPIT_FOOTER_BTN}>
              Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <button
        type="button"
        data-testid="open-feedback"
        aria-label="Send feedback"
        title="Feedback"
        onClick={() => setFeedbackOpen(true)}
        className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+var(--fab-bottom,13rem))] lg:[--fab-bottom:1.5rem] z-40 flex h-12 w-[4.75rem] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-foreground/80 shadow-[0_0_18px_rgba(229,57,53,0.18)] backdrop-blur-md transition-colors hover:border-[#e53935]/60 hover:text-foreground"
      >
        <svg
          viewBox="-2 0 94 72"
          fill="none"
          aria-hidden="true"
          className="h-7 w-auto overflow-visible"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* "O" of the ELCAMOSO mark as a chat bubble (gap + tail bottom-left). */}
          <path d="M9.6 49.4 A17 17 0 1 1 15.5 52.4" strokeWidth="3.4" />
          <path d="M15.5 52.4 L4 57 L9.6 49.4" strokeWidth="3.4" />
          <circle cx="13.5" cy="36" r="1.9" fill="currentColor" stroke="none" />
          <circle cx="20" cy="36" r="1.9" fill="currentColor" stroke="none" />
          <circle cx="26.5" cy="36" r="1.9" fill="currentColor" stroke="none" />
          <path d="M40 14 C 52 24, 52 48, 40 58" strokeWidth="3.2" />
          <path d="M54 9 C 69 22, 69 50, 54 63" strokeWidth="3.0" opacity="0.85" />
          <path d="M68 4 C 86 20, 86 52, 68 68" strokeWidth="2.8" opacity="0.7" />
        </svg>
      </button>

      <FeedbackSheet
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        soundProfileId={profile.id}
        soundProfileName={profile.name}
        screen="drive"
      />
    </div>
  );
}
