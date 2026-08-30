import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { cn } from "@/lib/utils";

type Variant = "full" | "mark" | "wordmark";

interface MarkProps {
  /** 0..1 - how many waves are lit / how far sound radiates */
  intensity?: number | undefined;
  /** 0..1 virtual throttle demand - drives outward radiation */
  throttle?: number | undefined;
  /** 0..1 regeneration - pulls the waves inward and dims them */
  regen?: number | undefined;
  /** Prefer outward (accel) or inward (regen) wave bias */
  direction?: "outward" | "inward" | undefined;
  /** profile character: higher = tighter, faster wave motion */
  waveResponse?: number | undefined;
  /** animate waves in on mount (staged O → O ))) ) */
  animate?: boolean | undefined;
  /** landing hero: intro → hold → gentle radiate (overrides animate when set) */
  heroPhase?: HeroWavePhase | undefined;
  /** calmer feedback: opacity only, no looping radiation */
  reducedMotion?: boolean | undefined;
  className?: string | undefined;
}

const WAVES = [
  { d: "M40 14 C 52 24, 52 48, 40 58", w: 3.2 },
  { d: "M54 9 C 69 22, 69 50, 54 63", w: 3.0 },
  { d: "M68 4 C 86 20, 86 52, 68 68", w: 2.8 },
] as const;

const WAVE_IN_MS = 400;
const WAVE_IN_STAGGER_MS = 220;
const WAVE_IN_LEAD_MS = 250;

/** Time until staged O → O ))) intro finishes (ms). */
export const MARK_WAVE_IN_DURATION_MS =
  WAVE_IN_LEAD_MS + (WAVES.length - 1) * WAVE_IN_STAGGER_MS + WAVE_IN_MS;

/** Brief settle after intro before the idle hold window. */
export const HERO_WAVE_HANDOFF_MS = 220;

/** Static hold on hero before idle radiate loop starts. */
export const HERO_MARK_RADIATE_DELAY_MS = 2000;

const WAVE_RADIATE_STAGGER_MS = 130;
/** Hero idle pulse uses the same stagger as the intro wave-in for visual continuity. */
const HERO_RADIATE_STAGGER_MS = WAVE_IN_STAGGER_MS;
const MOSO_START_INDEX = 4;

export type HeroWavePhase = "intro" | "hold" | "radiate";

function markRadiateCycleMs(
  intensity: number,
  waveResponse: number,
  drive: number,
): number {
  const cycleRaw =
    2400 / (0.55 + waveResponse * (0.5 + Math.max(drive, intensity * 0.6)));
  return Math.max(1200, Math.round(cycleRaw / 40) * 40);
}

/** Idle mark pulse at full intensity — matches header logo. */
export const MARK_IDLE_RADIATE_CYCLE_MS = markRadiateCycleMs(1, 1, 0);

function markRadiateAnimation(index: number, cycleMs: number) {
  return `wave-radiate ${cycleMs}ms ease-out ${index * WAVE_RADIATE_STAGGER_MS}ms infinite`;
}

function markHeroRadiateAnimation(index: number, cycleMs: number) {
  return `wave-radiate-hero ${cycleMs}ms ease-in-out ${index * HERO_RADIATE_STAGGER_MS}ms infinite`;
}

export function useHeroWavePhase(): { phase: HeroWavePhase; reducedMotion: boolean } {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<HeroWavePhase>(() =>
    reducedMotion ? "radiate" : "intro",
  );

  useEffect(() => {
    if (reducedMotion) {
      setPhase("radiate");
      return;
    }

    const holdAt = MARK_WAVE_IN_DURATION_MS + HERO_WAVE_HANDOFF_MS;
    const radiateAt = holdAt + HERO_MARK_RADIATE_DELAY_MS;

    const holdTimer = window.setTimeout(() => setPhase("hold"), holdAt);
    const radiateTimer = window.setTimeout(() => setPhase("radiate"), radiateAt);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(radiateTimer);
    };
  }, [reducedMotion]);

  return { phase: reducedMotion ? "radiate" : phase, reducedMotion };
}

function quantizeMotion(value: number, steps: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * steps) / steps;
}

function markPropsEqual(prev: MarkProps, next: MarkProps): boolean {
  const pi = quantizeMotion(prev.intensity ?? 1, 12);
  const ni = quantizeMotion(next.intensity ?? 1, 12);
  const pt = quantizeMotion(prev.throttle ?? 0, 8);
  const nt = quantizeMotion(next.throttle ?? 0, 8);
  const pr = quantizeMotion(prev.regen ?? 0, 8);
  const nr = quantizeMotion(next.regen ?? 0, 8);
  return (
    pi === ni &&
    pt === nt &&
    pr === nr &&
    prev.direction === next.direction &&
    prev.waveResponse === next.waveResponse &&
    prev.animate === next.animate &&
    prev.heroPhase === next.heroPhase &&
    prev.reducedMotion === next.reducedMotion &&
    prev.className === next.className
  );
}

export const ElcamosoMark = memo(function ElcamosoMark({
  intensity: intensityIn = 1,
  throttle: throttleIn = 0,
  regen: regenIn = 0,
  direction,
  waveResponse = 1,
  animate = false,
  heroPhase,
  reducedMotion = false,
  className,
}: MarkProps) {
  const intensity = quantizeMotion(intensityIn, 12);
  const throttle = quantizeMotion(throttleIn, 8);
  const regen = quantizeMotion(regenIn, 8);
  const drive = Math.min(1, Math.max(0, throttle));
  const brake = Math.min(1, Math.max(0, regen));
  const dirIn = direction === "inward" || (direction !== "outward" && brake > drive);
  const live =
    !heroPhase &&
    !reducedMotion &&
    (drive > 0.02 || brake > 0.02 || intensity > 0.08);
  const animateIn =
    !reducedMotion && (heroPhase === "intro" || (animate && !heroPhase));
  const heroHold = heroPhase === "hold";
  const heroRadiate = heroPhase === "radiate" && !reducedMotion;
  const cycleMs = markRadiateCycleMs(intensity, waveResponse, drive);
  const cycleRef = useRef(cycleMs);
  if (Math.abs(cycleMs - cycleRef.current) >= 40) cycleRef.current = cycleMs;
  const cycle = cycleRef.current;

  return (
    <svg
      viewBox="0 0 92 72"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-auto overflow-visible", className)}
    >
      <circle
        cx="20"
        cy="36"
        r="17"
        stroke="currentColor"
        strokeWidth="3.4"
        style={
          animateIn
            ? { animation: `wave-in ${WAVE_IN_MS}ms ease-out both` }
            : heroHold || heroRadiate
              ? { opacity: 1, transform: "translateX(0)" }
              : undefined
        }
      />
      {WAVES.map((wave, i) => {
        const lit = Math.min(1, Math.max(0, intensity * 3 - i));
        const out = dirIn ? 0 : drive * (1.4 + i * 1.1) + intensity * (0.4 + i * 0.35);
        const inn = dirIn
          ? (brake * 0.7 + (1 - intensity) * 0.35) * (1.2 + i * 0.9)
          : brake * (1.2 + i * 0.9);
        const shift = reducedMotion ? 0 : out - inn;
        const waveOpacity = heroHold ? 1 : (0.08 + lit * 0.92) * (1 - brake * 0.45);
        const waveTransform = heroHold
          ? `translateX(0px) scale(${1 + intensity * 0.04 * (i + 1)})`
          : `translateX(${shift}px) scale(${1 + intensity * 0.04 * (i + 1)})`;
        return (
          <path
            key={wave.d}
            d={wave.d}
            stroke="currentColor"
            strokeWidth={wave.w}
            strokeLinecap="round"
            style={{
              opacity: waveOpacity,
              transform: waveTransform,
              transformOrigin: "20px 36px",
              transition: reducedMotion
                ? "opacity 400ms ease-out"
                : "opacity 260ms ease-out, transform 220ms ease-out",
              ...(animateIn
                ? {
                    animation: `wave-in ${WAVE_IN_MS}ms ease-out ${WAVE_IN_LEAD_MS + i * WAVE_IN_STAGGER_MS}ms both`,
                  }
                : heroHold
                  ? {}
                  : heroRadiate
                    ? {
                        animation: markHeroRadiateAnimation(i, MARK_IDLE_RADIATE_CYCLE_MS),
                      }
                    : live
                      ? {
                          animation: markRadiateAnimation(i, cycle),
                        }
                      : {}),
            }}
          />
        );
      })}
    </svg>
  );
}, markPropsEqual);

const WORDMARK_LETTERS = ["E", "L", "C", "A", "M", "O", "S", "O"] as const;

function mosoLetterStyle(
  heroPhase: HeroWavePhase | "off" | undefined,
  mosoIndex: number,
  reducedMotion: boolean,
): CSSProperties | undefined {
  if (!heroPhase || heroPhase === "off" || reducedMotion) return undefined;

  const display = { display: "inline-block" as const };

  if (heroPhase === "intro") {
    return {
      ...display,
      animation: `wave-in ${WAVE_IN_MS}ms ease-out ${WAVE_IN_LEAD_MS + mosoIndex * WAVE_IN_STAGGER_MS}ms both`,
    };
  }

  if (heroPhase === "hold") {
    return { ...display, opacity: 1 };
  }

  return {
    ...display,
    animation: markHeroRadiateAnimation(mosoIndex, MARK_IDLE_RADIATE_CYCLE_MS),
  };
}

export function ElcamosoWordmark({
  className,
  ariaHidden,
  heroPhase = "off",
  reducedMotion = false,
}: {
  className?: string;
  ariaHidden?: boolean;
  heroPhase?: HeroWavePhase | "off";
  reducedMotion?: boolean;
}) {
  return (
    <span
      className={cn("wordmark wordmark-lockup", className)}
      aria-label={ariaHidden ? undefined : "ELCAMOSO"}
      aria-hidden={ariaHidden ? true : undefined}
    >
      {WORDMARK_LETTERS.map((letter, index) => {
        const isMoso = index >= MOSO_START_INDEX;
        const mosoIndex = index - MOSO_START_INDEX;
        const style = isMoso ? mosoLetterStyle(heroPhase, mosoIndex, reducedMotion) : undefined;

        return (
          <span key={`${letter}-${index}`} aria-hidden="true" style={style}>
            {letter}
          </span>
        );
      })}
    </span>
  );
}

const WORDMARK_EXPANSION_WORDS = ["ELECTRIC", "CAR", "MOTION", "SOUND"] as const;

const MOBILE_WORDMARK_EXPANSION = WORDMARK_EXPANSION_WORDS.map((word) =>
  word.split("").join(" "),
).join("  ");

export const WordmarkExpansion = memo(function WordmarkExpansion({
  className,
  ariaHidden,
  width,
}: {
  className?: string;
  ariaHidden?: boolean;
  width?: number;
}) {
  return (
    <>
      <p
        className={cn("wordmark-expansion wordmark-expansion--mobile lg:hidden", className)}
        aria-hidden={ariaHidden ? true : undefined}
      >
        {MOBILE_WORDMARK_EXPANSION}
      </p>
      <p
        className={cn("wordmark-expansion hidden lg:flex", className)}
        aria-hidden={ariaHidden ? true : undefined}
        style={width ? { width, maxWidth: width, minWidth: width } : undefined}
      >
        {WORDMARK_EXPANSION_WORDS.map((word) => (
          <span key={word} className="shrink-0">
            {word}
          </span>
        ))}
      </p>
    </>
  );
});

interface LogoLockupProps extends MarkProps {
  markClassName?: string | undefined;
  wordmarkClassName?: string | undefined;
}

export function ElcamosoLogoLockup({
  markClassName,
  wordmarkClassName,
  ...markProps
}: LogoLockupProps) {
  return (
    <span className="inline-flex flex-col items-center text-center">
      <ElcamosoMark {...markProps} className={cn("elcamoso-mark-lockup", markClassName)} />
      <ElcamosoWordmark className={cn(wordmarkClassName)} />
    </span>
  );
}

interface LogoProps extends MarkProps {
  variant?: Variant | undefined;
  wordmarkClassName?: string | undefined;
}

export function ElcamosoLogo({
  variant = "full",
  intensity = 1,
  animate = false,
  reducedMotion = false,
  className,
  wordmarkClassName,
}: LogoProps) {
  if (variant === "mark") {
    return (
      <ElcamosoMark
        intensity={intensity}
        animate={animate}
        reducedMotion={reducedMotion}
        className={className}
      />
    );
  }
  if (variant === "wordmark") {
    return <ElcamosoWordmark className={cn("text-base", className)} />;
  }
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <ElcamosoMark
        intensity={intensity}
        animate={animate}
        reducedMotion={reducedMotion}
        className="h-5 w-auto"
      />
      <ElcamosoWordmark className={cn("text-sm", wordmarkClassName)} />
    </span>
  );
}

export default ElcamosoLogo;
