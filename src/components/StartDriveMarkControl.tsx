import { useEffect, useRef, useState } from "react";
import { ElcamosoMark, type HeroWavePhase } from "@/components/ElcamosoLogo";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Short ignition (rays ~560 ms keep playing), then start. */
const DEFAULT_IGNITE_MS = 450;
const DEFAULT_IGNITE_REDUCED_MS = 280;

/** Phones are ~15% larger than before (8.57rem -> 9.86rem); sm and up unchanged. */
const MARK_CLASS = "h-[9.86rem] w-auto sm:h-[10.1rem] lg:h-[12.85rem] xl:h-[14.35rem]";

/** Thin outline pointing finger (stroke 1.5, like the Drive+ lock), rotated to point at the button. */
function TapGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path d="M22 14a8 8 0 0 1-8 8" />
      <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
      <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
      <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

export interface StartDriveMarkControlProps {
  onStart: () => void;
  reducedMotion?: boolean;
  /** Optional hero wave phase for the landing mark animation. */
  heroPhase?: HeroWavePhase;
  waveResponse?: number;
  /** Hold ignition glow before calling onStart. */
  igniteMs?: number;
  igniteReducedMs?: number;
  /** Two-line label inside the O. Default: Start / Drive. */
  lines?: readonly [string, string];
  /**
   * When false, only the O ))) mark is shown (logo intro). The Start Drive face
   * fades in once true. Default true.
   */
  revealFace?: boolean;
  className?: string;
  markClassName?: string;
}

/**
 * O ))) Start Drive control: dark face with restrained red label;
 * press-down + brighter text on ignite (no red flood).
 */
export function StartDriveMarkControl({
  onStart,
  reducedMotion = false,
  heroPhase,
  waveResponse,
  igniteMs = DEFAULT_IGNITE_MS,
  igniteReducedMs = DEFAULT_IGNITE_REDUCED_MS,
  lines = ["Start", "Drive"],
  revealFace = true,
  className,
  markClassName,
}: StartDriveMarkControlProps) {
  const { settings } = useSettings();
  const [igniting, setIgniting] = useState(false);
  const timer = useRef(0);
  const faceReady = revealFace || reducedMotion;

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function handleClick() {
    if (igniting || !faceReady) return;
    getSession().primeAudioFromUserGesture();
    setIgniting(true);
    const delay = reducedMotion ? igniteReducedMs : igniteMs;
    timer.current = window.setTimeout(() => {
      onStart();
    }, delay);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={igniting || !faceReady}
      aria-label="Start Drive"
      aria-busy={igniting || undefined}
      className={cn(
        "start-drive-press group relative z-10 block aspect-[92/72] shrink-0 overflow-visible",
        "cursor-pointer border-0 bg-transparent p-0 outline-none",
        "focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-foreground/45 focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        igniting || !faceReady ? "pointer-events-none" : "hover:opacity-95",
        MARK_CLASS,
        className,
      )}
    >
      {/* Phone-only tap hint, left of the O. Part of the button, so tapping it also starts. */}
      <span
        aria-hidden="true"
        className={cn(
          "start-drive-hint absolute right-full top-1/2 z-20 -translate-y-1/2 sm:hidden",
          "mr-0.5 flex w-[4.4rem] flex-col items-center gap-1 text-center transition-opacity duration-500",
          faceReady && !igniting ? "opacity-100" : "opacity-0",
          !reducedMotion && faceReady && !igniting && "start-drive-hint--pulse",
        )}
      >
        <span className="start-drive-hint__icon relative flex size-7 items-center justify-center rounded-full text-foreground/75">
          <TapGlyph className="start-drive-hint__finger" />
        </span>
        <span className="start-drive-hint__text text-[9px] leading-[1.15] font-normal tracking-[0.16em] text-foreground/65 uppercase">
          {t(settings.language, "drive.tapHint")}
        </span>
      </span>
      <ElcamosoMark
        {...(heroPhase ? { heroPhase } : { animate: true })}
        intensity={1}
        {...(waveResponse !== undefined ? { waveResponse } : {})}
        reducedMotion={reducedMotion}
        className={cn("absolute inset-0 h-full w-full max-w-none", markClassName)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute z-20 aspect-square -translate-x-1/2 -translate-y-1/2 transition-[opacity,transform] duration-700 ease-out",
          faceReady ? "scale-100 opacity-100" : "scale-90 opacity-0",
        )}
        style={{
          left: `${(20 / 92) * 100}%`,
          top: `${(36 / 72) * 100}%`,
          height: `${(30.6 / 72) * 100}%`,
        }}
      >
        <span
          aria-hidden="true"
          className={cn("start-drive-rays", igniting && !reducedMotion && "start-drive-rays--on")}
        />
        <span
          className={cn(
            "engine-start-button flex size-full flex-col items-center justify-center rounded-full",
            !reducedMotion && !igniting && faceReady && "engine-start-button--pulse",
            igniting && "engine-start-button--igniting",
          )}
        >
          <span
            className={cn(
              "engine-start-button__label",
              !reducedMotion && !igniting && faceReady && "engine-start-button__label--pulse",
            )}
          >
            <span>{lines[0]}</span>
            <span>{lines[1]}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
