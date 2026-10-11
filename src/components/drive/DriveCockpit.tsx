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
import { getProfile, SOUND_PROFILES, type SoundProfile } from "@/lib/sound/profiles";
import { SHIFT_MAP_PRESET_IDS, type ShiftMapPresetId } from "@/lib/powertrain/shift-presets";
import { cn } from "@/lib/utils";

const COCKPIT_SELECT_TRIGGER =
  "h-12 min-h-12 w-full min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-light shadow-none focus:ring-1 focus:ring-foreground/40 data-[state=open]:border-foreground/60";

const COCKPIT_SELECT_CONTENT =
  "max-h-[min(50vh,22rem)] overflow-y-auto rounded-2xl border border-border bg-background p-1.5 text-foreground shadow-none";

const COCKPIT_SELECT_ITEM =
  "cursor-pointer rounded-full py-2.5 pl-3.5 pr-9 text-sm font-light focus:bg-foreground focus:text-background data-[state=checked]:bg-foreground/12 data-[state=checked]:text-foreground data-[disabled]:opacity-40";

const ARC_START = 135;
const ARC_SWEEP = 270;
const CATALOG_IDS = new Set(SOUND_PROFILES.map((p) => p.id));

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
}: {
  progress: number;
  size?: number;
  reducedMotion: boolean;
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
  const fill = arcPath(cx, cy, r, ARC_START, end);

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
      <path
        d={fill}
        fill="none"
        stroke="oklch(0.97 0.002 250)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
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
  const arcProgress =
    secondary.showRpm && redline > idle
      ? Math.min(1, Math.max(0, (rpm - idle) / (redline - idle)))
      : secondary.arcProgress;

  const favourites = useMemo(
    () => cockpitFavouriteSlots(settings.favourites, CATALOG_IDS, 3),
    [settings.favourites],
  );

  const pickerIds = useMemo(() => {
    const ids = new Set<string>([profile.id, ...favourites, ...settings.favourites.slice(0, 12)]);
    return [...ids].filter((id) => CATALOG_IDS.has(id));
  }, [profile.id, favourites, settings.favourites]);

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
        "drive-cockpit flex flex-1 flex-col text-foreground",
        "px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-8",
        className,
      )}
      data-testid="drive-cockpit"
    >
      <header className="drive-cockpit__header grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
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
        className="drive-cockpit__centre relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center py-2 sm:py-4"
        aria-label="Speed and drivetrain"
      >
        <div className="relative mx-auto aspect-square w-[min(58vw,220px)] max-w-full place-items-center sm:w-[280px]">
          <CockpitTachArc progress={arcProgress} size={300} reducedMotion={reducedMotion} />
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center px-5 text-center">
            <p
              className="drive-cockpit__speed font-extralight tabular-nums leading-none tracking-tight"
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
            <p className="text-3xl font-extralight tabular-nums sm:text-4xl" aria-live="off">
              {secondary.value}
            </p>
            {secondary.showRpm ? (
              <p className="text-lg font-light tabular-nums text-muted-foreground sm:text-xl" aria-live="off">
                {secondary.rpmText}
              </p>
            ) : null}
          </div>
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            {secondary.label}
            {secondary.showRpm ? " · Rev" : ""}
          </p>
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground/80 uppercase">
            {secondary.simulatedCaption}
          </p>
        </div>
      </section>

      <footer className="drive-cockpit__footer mx-auto flex w-full max-w-lg flex-col gap-2.5 pt-1 sm:gap-4 sm:pt-2">
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Favourite sounds"
        >
          {([0, 1, 2] as const).map((slot) => {
            const id = favourites[slot];
            if (!id) {
              return (
                <div
                  key={`empty-${slot}`}
                  className="flex h-12 items-center justify-center rounded-full border border-border/50 text-[10px] tracking-[0.16em] text-muted-foreground/50 uppercase"
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
                  "flex h-12 min-h-12 items-center justify-center truncate rounded-full border px-2 text-[11px] tracking-[0.12em] uppercase transition-colors",
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

        <div className="flex min-h-12 items-center gap-3">
          <span className="shrink-0 text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            Sound
          </span>
          <Select
            value={profile.id}
            onValueChange={(id) => void selectProfile(id)}
          >
            <SelectTrigger className={COCKPIT_SELECT_TRIGGER} aria-label="Active sound">
              <SelectValue>{profile.name}</SelectValue>
            </SelectTrigger>
            <SelectContent position="item-aligned" className={COCKPIT_SELECT_CONTENT}>
              {pickerIds.map((id) => {
                const p = getProfile(id);
                const locked = !canDriveWithProfile(id);
                const isActive = id === profile.id;
                return (
                  <SelectItem
                    key={id}
                    value={id}
                    textValue={p.name}
                    disabled={locked && !isActive}
                    className={cn(COCKPIT_SELECT_ITEM, locked && !isActive && "text-muted-foreground")}
                  >
                    <span className="flex w-full min-w-0 items-center justify-between gap-3 pr-1">
                      <span className="truncate">{p.name}</span>
                      {locked ? <PremiumBadge className="shrink-0" /> : null}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div
          className="flex items-center justify-between gap-2"
          role="group"
          aria-label="Master volume"
        >
          <button
            type="button"
            onClick={() => nudgeVolume(-1)}
            className="flex h-12 w-12 min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-lg"
            aria-label="Volume down"
          >
            −
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className={cn(
              "flex h-12 min-h-12 flex-1 items-center justify-center rounded-full border px-4 text-[11px] tracking-[0.2em] uppercase",
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
            className="flex h-12 w-12 min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-lg"
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          {showShiftPreset ? (
            <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Shift
              </span>
              <Select
                value={settings.shiftMapPreset}
                onValueChange={(id) => update({ shiftMapPreset: id as ShiftMapPresetId })}
              >
                <SelectTrigger className={COCKPIT_SELECT_TRIGGER} aria-label="Shift preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="item-aligned" className={COCKPIT_SELECT_CONTENT}>
                  {SHIFT_MAP_PRESET_IDS.map((id) => (
                    <SelectItem key={id} value={id} className={COCKPIT_SELECT_ITEM}>
                      {id === "legacy"
                        ? "Classic"
                        : id === "city"
                          ? "City"
                          : id === "touring"
                            ? "Touring"
                            : "Sport"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span className="flex-1" />
          )}
          <div className="flex items-center gap-2">
            {fullscreenOk ? (
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="flex h-12 min-h-12 items-center justify-center rounded-full border border-border px-4 text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? "Exit" : "Full"}
              </button>
            ) : null}
            <Link
              to="/settings"
              className="flex h-12 min-h-12 items-center justify-center rounded-full border border-border px-5 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
            >
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
