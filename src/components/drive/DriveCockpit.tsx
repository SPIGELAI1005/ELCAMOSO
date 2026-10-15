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
import type { DriveProductStatus } from "@/lib/drive/session";
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
import { cn } from "@/lib/utils";

const COCKPIT_SELECT_TRIGGER =
  "h-12 min-h-12 w-full min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-light shadow-none focus:ring-1 focus:ring-foreground/40 data-[state=open]:border-foreground/60";

const COCKPIT_SELECT_CONTENT =
  "max-h-[min(50vh,22rem)] overflow-y-auto rounded-2xl border border-border bg-background p-1.5 text-foreground shadow-none";

const COCKPIT_SELECT_ITEM =
  "cursor-pointer rounded-full py-2.5 pl-3.5 pr-9 text-sm font-light focus:bg-foreground focus:text-background data-[state=checked]:bg-foreground/12 data-[state=checked]:text-foreground data-[disabled]:opacity-40";

const COCKPIT_FOOTER_BTN =
  "flex h-14 min-h-14 items-center justify-center rounded-full border border-border text-[11px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:border-foreground/60 hover:text-foreground";

const ARC_START = 135;
const ARC_SWEEP = 270;
/** Last portion of the tach treated as the redline zone. */
const REDLINE_ZONE_START = 0.82;
const REDLINE_COLOR = "#e53935";
const TACH_COLOR = "oklch(0.97 0.002 250)";
const CATALOG_IDS = new Set(SOUND_PROFILES.map((p) => p.id));

function shiftPresetLabel(id: ShiftMapPresetId) {
  if (id === "legacy") return "Classic";
  if (id === "city") return "City";
  if (id === "touring") return "Touring";
  return "Sport";
}

/** Blend tach stroke from white into brand red through the redline zone. */
function tachStrokeForProgress(progress: number): string {
  if (progress < REDLINE_ZONE_START) return TACH_COLOR;
  const t = Math.min(1, (progress - REDLINE_ZONE_START) / (1 - REDLINE_ZONE_START));
  // Ease in so the tip goes fully red near the needle tip.
  const eased = t * t;
  const r = Math.round(247 + (229 - 247) * eased);
  const g = Math.round(247 + (57 - 247) * eased);
  const b = Math.round(250 + (53 - 250) * eased);
  return `rgb(${r} ${g} ${b})`;
}

export interface DriveCockpitProps {
  profile: SoundProfile;
  driveState: DriveState;
  productStatus: DriveProductStatus;
  sessionKind: string;
  /** Display speed already converted for units (km/h or mph). */
  displaySpeed: number;
  speedUnit: string;
  speedMps: number;
  reducedMotion?: boolean | undefined;
  onStop: () => void;
  className?: string | undefined;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function CockpitTachArc({
  progress,
  size = 220,
  reducedMotion,
  showRedlineZone = false,
}: {
  progress: number;
  size?: number;
  reducedMotion: boolean;
  /** Draw a red zone on the track and tint the fill near redline. */
  showRedlineZone?: boolean;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const [visual, setVisual] = useState(progress);
  const raf = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setVisual(progress);
      return;
    }
    const target = Math.min(1, Math.max(0, progress));
    const tick = () => {
      setVisual((prev) => {
        const next = prev + (target - prev) * 0.18;
        if (Math.abs(next - target) < 0.002) return target;
        raf.current = requestAnimationFrame(tick);
        return next;
      });
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [progress, reducedMotion]);

  const clamped = Math.min(1, Math.max(0, visual));
  const end = ARC_START + ARC_SWEEP * clamped;
  const track = arcPath(cx, cy, r, ARC_START, ARC_START + ARC_SWEEP);
  const zoneStartDeg = ARC_START + ARC_SWEEP * REDLINE_ZONE_START;
  const zoneTrack = arcPath(cx, cy, r, zoneStartDeg, ARC_START + ARC_SWEEP);
  const whiteEnd = Math.min(end, zoneStartDeg);
  const whiteFill =
    whiteEnd > ARC_START + 0.2 ? arcPath(cx, cy, r, ARC_START, whiteEnd) : null;
  const redFill =
    showRedlineZone && clamped > REDLINE_ZONE_START
      ? arcPath(cx, cy, r, zoneStartDeg, end)
      : null;
  const solidFill =
    !showRedlineZone || clamped <= REDLINE_ZONE_START
      ? arcPath(cx, cy, r, ARC_START, end)
      : null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="drive-cockpit__arc pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={track}
        fill="none"
        stroke="oklch(1 0 0 / 12%)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {showRedlineZone ? (
        <path
          d={zoneTrack}
          fill="none"
          stroke="oklch(0.62 0.2 25 / 28%)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : null}
      {solidFill ? (
        <path
          d={solidFill}
          fill="none"
          stroke={showRedlineZone ? tachStrokeForProgress(clamped) : TACH_COLOR}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : null}
      {whiteFill && redFill ? (
        <path
          d={whiteFill}
          fill="none"
          stroke={TACH_COLOR}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : null}
      {redFill ? (
        <path
          d={redFill}
          fill="none"
          stroke={tachStrokeForProgress(clamped)}
          strokeWidth={stroke + 0.5}
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function CockpitGearLadder({
  gearCount,
  activeGear,
  shifting,
  reducedMotion,
}: {
  gearCount: number;
  activeGear: number;
  shifting: boolean;
  reducedMotion: boolean;
}) {
  if (gearCount < 2) return null;
  const active = Math.min(gearCount, Math.max(1, Math.round(activeGear)));

  return (
    <div
      className="mt-2 flex items-center justify-center gap-1.5"
      role="status"
      aria-label={shifting ? `Shifting to gear ${active}` : `Gear ${active}`}
    >
      {Array.from({ length: gearCount }, (_, i) => i + 1).map((gear) => {
        const isActive = gear === active;
        return (
          <span
            key={gear}
            className={cn(
              "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums tracking-wide transition-[transform,background-color,color,box-shadow] duration-200",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground/55",
                isActive && shifting && !reducedMotion
                ? "scale-110 shadow-[0_0_0_2px_var(--cockpit-redline)]"
                : null,
              isActive && !reducedMotion ? "scale-105" : null,
            )}
          >
            {gear}
          </span>
        );
      })}
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

  const freshness = driveState.powertrain?.speedFreshness ?? null;
  const availability = cockpitSpeedAvailability({
    productStatus,
    speedFreshness: freshness,
    sessionKind,
  });
  const speedView = formatCockpitSpeed(speedMps, availability, speedUnit, displaySpeed);
  const secondary = cockpitSecondaryView(profile, driveState);
  const drivetrain = useMemo(() => resolveDrivetrain(profile), [profile]);
  const redline = drivetrain.personality.engine.redlineRpm;
  const idle = drivetrain.personality.engine.idleRpm;
  const rpm = driveState.powertrain?.rpm ?? driveState.rpm;
  const showTachRedline = secondary.showRpm && secondary.kind === "gear";
  const arcProgress =
    showTachRedline && redline > idle
      ? Math.min(1, Math.max(0, (rpm - idle) / (redline - idle)))
      : secondary.arcProgress;
  const gearCount = drivetrain.personality.transmission.gearRatios.length;
  const activeGear = driveState.powertrain?.gear ?? driveState.gear;
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
  const showShiftPreset = profile.drivetrainMode === "virtual-transmission";

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

      <header className="drive-cockpit__header relative z-[1] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <ElcamosoLogo
          variant="full"
          intensity={Math.min(1, Math.max(driveState.load, driveState.throttle))}
          reducedMotion={reducedMotion}
          className="justify-self-start"
          wordmarkClassName="hidden tracking-[0.28em] min-[420px]:inline"
        />
        <div className="min-w-0 justify-self-stretch text-right sm:text-center">
          <p className="truncate text-sm font-light tracking-[0.04em] sm:text-base">
            {profile.name}
          </p>
          {switchStatus ? (
            <p className="mt-0.5 truncate text-[11px] tracking-[0.12em] text-muted-foreground uppercase" role="status">
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
          <CockpitTachArc
            progress={arcProgress}
            size={300}
            reducedMotion={reducedMotion}
            showRedlineZone={showTachRedline}
          />
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center px-5 text-center">
            <p
              className={cn(
                "drive-cockpit__speed font-extralight tabular-nums leading-none tracking-tight transition-colors duration-200",
                inRedline ? "text-[var(--cockpit-redline)]" : null,
              )}
              aria-live="off"
            >
              {speedView.value}
            </p>
            {speedView.showUnit ? (
              <p className="mt-1.5 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
                {speedUnit}
              </p>
            ) : null}
            {speedView.caption ? (
              <p className="mt-1.5 max-w-[16rem] text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                {speedView.caption}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center gap-0.5 sm:mt-3 sm:gap-1">
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
          {secondary.kind === "gear" ? (
            <CockpitGearLadder
              gearCount={gearCount}
              activeGear={activeGear}
              shifting={isShifting}
              reducedMotion={reducedMotion}
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

        <button
          type="button"
          onClick={onStop}
          className="flex h-14 min-h-14 w-full items-center justify-center rounded-full border border-border text-xs tracking-[0.24em] text-muted-foreground uppercase transition-colors hover:border-foreground hover:text-foreground"
        >
          Stop Drive
        </button>
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
            <Link
              to="/settings"
              onClick={() => setMoreOpen(false)}
              className={COCKPIT_FOOTER_BTN}
            >
              Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
