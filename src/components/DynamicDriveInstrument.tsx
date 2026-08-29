import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { DriveState } from "@/lib/drive/model";
import {
  connectionNeedsAttention,
  connectionQualityFromStatus,
  driveSignalQualityLabel,
  formatDriveGear,
} from "@/lib/drive/drive-connection";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import type { DriveProductStatus } from "@/lib/drive/session";
import type { SoundProfile } from "@/lib/sound/profiles";

interface DynamicDriveInstrumentProps {
  profile: SoundProfile;
  state: DriveState;
  productStatus: DriveProductStatus;
  reducedMotion?: boolean;
  /** Cockpit / safety mode: larger type for in-car viewing distance. */
  driverDistance?: boolean;
  className?: string;
}

const ARC_START = 135;
const ARC_SWEEP = 270;

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

function TachArc({
  progress,
  size,
  stroke,
  shifting,
}: {
  progress: number;
  size: number;
  stroke: number;
  shifting: boolean;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.min(1, Math.max(0, progress));
  const end = ARC_START + ARC_SWEEP * clamped;
  const track = arcPath(cx, cy, r, ARC_START, ARC_START + ARC_SWEEP);
  const fill = arcPath(cx, cy, r, ARC_START, end);
  const trackStroke = shifting ? "oklch(1 0 0 / 22%)" : "oklch(1 0 0 / 11%)";
  const fillStroke = shifting ? "oklch(0.99 0.004 250)" : "oklch(0.97 0.002 250)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`block transition-[filter] duration-200 ${shifting ? "dd-arc-shift" : ""}`}
      aria-hidden="true"
    >
      <path d={track} fill="none" stroke={trackStroke} strokeWidth={stroke} strokeLinecap="round" />
      <path d={fill} fill="none" stroke={fillStroke} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

function ConnectionRow({
  productStatus,
  compact,
}: {
  productStatus: DriveProductStatus;
  compact?: boolean;
}) {
  const label = driveSignalQualityLabel(productStatus);
  if (!label) return null;

  const attention = connectionNeedsAttention(productStatus);
  const quality = connectionQualityFromStatus(productStatus);
  const vehicleLinked = productStatus === "vehicle-connected";

  return (
    <div
      className={`flex items-center justify-center gap-2 ${compact ? "gap-1.5" : ""}`}
      aria-label={vehicleLinked ? "Vehicle connected" : `Connection ${label}`}
    >
      <span
        className={`rounded-full bg-foreground ${
          compact ? "h-1.5 w-1.5" : "h-2 w-2"
        } ${vehicleLinked || attention ? "opacity-95" : "opacity-45"} ${quality === "weak" ? "animate-pulse" : ""}`}
        aria-hidden="true"
      />
      <span
        className={`tracking-[0.28em] uppercase ${
          compact ? "text-[9px]" : "text-[10px]"
        } ${vehicleLinked || attention ? "text-foreground/90" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Motion-matched cockpit cluster: gear hero, rev arc, profile, link quality.
 * No raw sensor values — product copy only.
 */
export const DynamicDriveInstrument = memo(function DynamicDriveInstrument({
  profile,
  state,
  productStatus,
  reducedMotion = false,
  driverDistance = false,
  className = "",
}: DynamicDriveInstrumentProps) {
  const drivetrain = useMemo(() => resolveDrivetrain(profile), [profile]);
  const pt = state.powertrain;
  const rpm = pt?.rpm ?? state.rpm;
  const gear = pt?.gear ?? state.gear;
  const shifting = pt?.shifting ?? state.isShifting;
  const redline = drivetrain.personality.engine.redlineRpm;
  const idle = drivetrain.personality.engine.idleRpm;
  const rpmProgress = redline > idle ? (rpm - idle) / (redline - idle) : 0;

  const gearText = formatDriveGear(gear);
  const prevGear = useRef(gear);
  const [shiftFlash, setShiftFlash] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      prevGear.current = gear;
      return;
    }
    let timer: number | undefined;
    if (shifting || prevGear.current !== gear) {
      setShiftFlash(true);
      timer = window.setTimeout(() => setShiftFlash(false), 380);
    }
    prevGear.current = gear;
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [gear, shifting, reducedMotion]);

  const isShiftHero = shiftFlash || shifting;
  const arcSize = driverDistance ? 156 : 132;
  const stroke = driverDistance ? 2.75 : 2.25;

  const gearClass = driverDistance
    ? isShiftHero
      ? "text-[5.75rem] sm:text-[6.5rem] animate-gear-shift"
      : "text-[4.85rem] sm:text-[5.75rem]"
    : isShiftHero
      ? "text-[4.25rem] sm:text-[4.85rem] animate-gear-shift"
      : "text-[3.5rem] sm:text-[4.25rem]";

  const rpmClass = driverDistance
    ? "text-[2rem] leading-none sm:text-[2.35rem]"
    : "text-xl leading-none sm:text-2xl";

  return (
    <section
      className={`dd-instrument mx-auto w-full max-w-md ${driverDistance ? "dd-instrument--cockpit" : ""} ${className}`}
      aria-label="Motion instrument"
    >
      <header className="dd-instrument__header mb-5 sm:mb-6">
        <p className="truncate text-center font-light tracking-[0.04em] text-foreground">
          {profile.name}
        </p>
      </header>

      <div className="dd-instrument__cluster grid items-center gap-5 sm:gap-6">
        <div className="relative mx-auto grid place-items-center">
          <TachArc progress={rpmProgress} size={arcSize} stroke={stroke} shifting={isShiftHero} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p
              className={`font-extralight tabular-nums transition-[transform,opacity,filter] duration-200 ${gearClass} ${
                isShiftHero ? "dd-gear-hero" : ""
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {gearText}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <p className={`font-extralight tabular-nums text-foreground ${rpmClass}`}>
            {Math.round(rpm)}
          </p>
          <p className="mt-1.5 text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
            Rev
          </p>
        </div>
      </div>

      <footer className="dd-instrument__footer mt-5 sm:mt-6">
        <ConnectionRow productStatus={productStatus} compact={!driverDistance} />
      </footer>
    </section>
  );
}, instrumentPropsEqual);

function instrumentPropsEqual(
  prev: DynamicDriveInstrumentProps,
  next: DynamicDriveInstrumentProps,
): boolean {
  if (prev.profile.id !== next.profile.id) return false;
  if (prev.productStatus !== next.productStatus) return false;
  if (prev.reducedMotion !== next.reducedMotion) return false;
  if (prev.driverDistance !== next.driverDistance) return false;
  if (prev.className !== next.className) return false;

  const prevPt = prev.state.powertrain;
  const nextPt = next.state.powertrain;
  const prevRpm = Math.round((prevPt?.rpm ?? prev.state.rpm) / 20);
  const nextRpm = Math.round((nextPt?.rpm ?? next.state.rpm) / 20);
  const prevGear = prevPt?.gear ?? prev.state.gear;
  const nextGear = nextPt?.gear ?? next.state.gear;
  const prevShift = (prevPt?.shifting ?? prev.state.isShifting) ? 1 : 0;
  const nextShift = (nextPt?.shifting ?? next.state.isShifting) ? 1 : 0;
  return prevRpm === nextRpm && prevGear === nextGear && prevShift === nextShift;
}
