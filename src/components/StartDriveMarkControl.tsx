import { useEffect, useRef, useState } from "react";
import { ElcamosoMark, type HeroWavePhase } from "@/components/ElcamosoLogo";
import { getSession } from "@/lib/drive/session";
import { cn } from "@/lib/utils";

/** One ignition pulse at 1.4s (matches CSS), then navigate. */
const DEFAULT_IGNITE_MS = 1400;
const DEFAULT_IGNITE_REDUCED_MS = 280;

const MARK_CLASS = "h-[8.57rem] w-auto sm:h-[10.1rem] lg:h-[12.85rem] xl:h-[14.35rem]";

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
        "group relative z-10 block aspect-[92/72] shrink-0 overflow-visible",
        "cursor-pointer border-0 bg-transparent p-0 outline-none",
        "focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-foreground/45 focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        igniting || !faceReady ? "pointer-events-none" : "hover:opacity-95",
        MARK_CLASS,
        className,
      )}
    >
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
