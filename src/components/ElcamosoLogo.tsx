import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
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
export const HERO_MARK_RADIATE_DELAY_MS = 600;

const WAVE_RADIATE_STAGGER_MS = 130;
const MOSO_START_INDEX = 4;

/** Start wave-radiate at peak opacity so hold → idle matches header pulse without a flash. */
const WAVE_RADIATE_PEAK_OFFSET = 0.35;

export type HeroWavePhase = "intro" | "hold" | "radiate";

function markRadiateCycleMs(intensity: number, waveResponse: number, drive: number): number {
  const cycleRaw = 2400 / (0.55 + waveResponse * (0.5 + Math.max(drive, intensity * 0.6)));
  return Math.max(1200, Math.round(cycleRaw / 40) * 40);
}

/** Idle mark pulse at full intensity - matches header logo. */
export const MARK_IDLE_RADIATE_CYCLE_MS = markRadiateCycleMs(1, 1, 0);

function markRadiateAnimation(index: number, cycleMs: number, phaseOffsetMs = 0) {
  const delayMs = index * WAVE_RADIATE_STAGGER_MS + phaseOffsetMs;
  return `wave-radiate ${cycleMs}ms ease-out ${delayMs}ms infinite`;
}

export function useHeroWavePhase(): { phase: HeroWavePhase; reducedMotion: boolean } {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<HeroWavePhase>(() => (reducedMotion ? "radiate" : "intro"));

  useEffect(() => {
    if (reducedMotion) {
      setPhase("radiate");
      return;
    }

    const holdAt = MARK_WAVE_IN_DURATION_MS;
    const radiateAt = holdAt + HERO_WAVE_HANDOFF_MS + HERO_MARK_RADIATE_DELAY_MS;

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
  const heroMotion = Boolean(heroPhase) && !reducedMotion;
  const live = !heroPhase && !reducedMotion && (drive > 0.02 || brake > 0.02 || intensity > 0.08);
  const animateIn = !reducedMotion && !heroPhase && animate;
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
          heroMotion || animateIn
            ? { animation: `wave-in ${WAVE_IN_MS}ms ease-out both` }
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
        const waveScale = 1 + intensity * 0.04 * (i + 1);
        const waveOpacity = (0.08 + lit * 0.92) * (1 - brake * 0.45);
        const waveTransform = heroPhase
          ? `translateX(0px) scale(${waveScale})`
          : `translateX(${shift}px) scale(${waveScale})`;
        const introDelay = WAVE_IN_LEAD_MS + i * WAVE_IN_STAGGER_MS;
        const radiateDelay =
          HERO_RADIATE_AT_MS +
          i * WAVE_RADIATE_STAGGER_MS -
          MARK_IDLE_RADIATE_CYCLE_MS * WAVE_RADIATE_PEAK_OFFSET;
        const waveTransition =
          heroMotion || animateIn || live
            ? undefined
            : reducedMotion
              ? "opacity 400ms ease-out"
              : "opacity 260ms ease-out, transform 220ms ease-out";
        return (
          <path
            key={wave.d}
            d={wave.d}
            stroke="currentColor"
            strokeWidth={wave.w}
            strokeLinecap="round"
            style={{
              ["--wave-scale" as string]: String(waveScale),
              opacity: waveOpacity,
              transform: waveTransform,
              transformOrigin: "20px 36px",
              transition: waveTransition,
              ...(heroMotion
                ? {
                    // Intro then idle pulse in one CSS timeline (no React phase handoff required).
                    animation: [
                      `wave-in ${WAVE_IN_MS}ms ease-out ${introDelay}ms both`,
                      `wave-radiate ${MARK_IDLE_RADIATE_CYCLE_MS}ms ease-out ${radiateDelay}ms infinite`,
                    ].join(", "),
                  }
                : animateIn
                  ? {
                      animation: `wave-in ${WAVE_IN_MS}ms ease-out ${introDelay}ms both`,
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

/** Intro hold + idle radiate start, matching useHeroWavePhase timing. */
const HERO_RADIATE_AT_MS =
  MARK_WAVE_IN_DURATION_MS + HERO_WAVE_HANDOFF_MS + HERO_MARK_RADIATE_DELAY_MS;

/**
 * CSS-chained intro → idle pulse so MOSO keeps radiating even if React phase
 * timers never advance (e.g. delayed hydration).
 */
function mosoLetterStyle(
  heroPhase: HeroWavePhase | "off" | undefined,
  mosoIndex: number,
  reducedMotion: boolean,
): CSSProperties | undefined {
  if (!heroPhase || heroPhase === "off" || reducedMotion) return undefined;

  const introDelay = WAVE_IN_LEAD_MS + mosoIndex * WAVE_IN_STAGGER_MS;
  const radiateDelay =
    HERO_RADIATE_AT_MS +
    mosoIndex * WAVE_RADIATE_STAGGER_MS -
    MARK_IDLE_RADIATE_CYCLE_MS * WAVE_RADIATE_PEAK_OFFSET;

  return {
    display: "inline-block",
    animation: [
      `wordmark-letter-in ${WAVE_IN_MS}ms ease-out ${introDelay}ms both`,
      `wave-radiate ${MARK_IDLE_RADIATE_CYCLE_MS}ms ease-out ${radiateDelay}ms infinite`,
    ].join(", "),
  };
}

export const ElcamosoWordmark = forwardRef<
  HTMLSpanElement,
  {
    className?: string;
    ariaHidden?: boolean;
    heroPhase?: HeroWavePhase | "off";
    reducedMotion?: boolean;
  }
>(function ElcamosoWordmark(
  { className, ariaHidden, heroPhase = "off", reducedMotion = false },
  ref,
) {
  return (
    <span
      ref={ref}
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
});

const WORDMARK_EXPANSION_WORDS = ["ELECTRIC", "CAR", "MOTION", "SOUND"] as const;

/** Letter + word-gap tokens so the line can flex to the ELCAMOSO width. */
const WORDMARK_EXPANSION_TOKENS = WORDMARK_EXPANSION_WORDS.flatMap((word, wordIndex) => {
  const letters = [...word].map((letter, letterIndex) => ({
    key: `${word}-${letterIndex}`,
    kind: "letter" as const,
    letter,
  }));
  if (wordIndex >= WORDMARK_EXPANSION_WORDS.length - 1) return letters;
  return [
    ...letters,
    { key: `gap-${wordIndex}`, kind: "gap" as const, letter: "\u00a0" },
  ];
});

/**
 * Expansion line under ELCAMOSO. Parent must be the wordmark-width lockup
 * (`w-fit` from the wordmark); this row is `w-full` + flex space-between so
 * its length always matches the logo text on web and mobile (no JS measure).
 */
export const WordmarkExpansion = memo(function WordmarkExpansion({
  className,
  ariaHidden,
}: {
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <p
      className={cn("wordmark-expansion", className)}
      aria-hidden={ariaHidden ? true : undefined}
    >
      {WORDMARK_EXPANSION_TOKENS.map((token) =>
        token.kind === "gap" ? (
          <span key={token.key} className="wordmark-expansion__gap" aria-hidden="true">
            {token.letter}
          </span>
        ) : (
          <span key={token.key}>{token.letter}</span>
        ),
      )}
    </p>
  );
});

interface LogoLockupProps extends MarkProps {
  markClassName?: string | undefined;
  wordmarkClassName?: string | undefined;
  wordmarkRef?: RefObject<HTMLSpanElement | null> | undefined;
  wordmarkAriaHidden?: boolean | undefined;
}

export function ElcamosoLogoLockup({
  markClassName,
  wordmarkClassName,
  wordmarkRef,
  wordmarkAriaHidden,
  heroPhase,
  reducedMotion,
  ...markProps
}: LogoLockupProps) {
  return (
    <span className="inline-flex w-fit max-w-full flex-col items-center text-center">
      <span className={cn("relative block overflow-visible", markClassName, "w-full max-w-full")}>
        <ElcamosoMark
          {...markProps}
          heroPhase={heroPhase}
          reducedMotion={reducedMotion}
          className="elcamoso-mark-over-wordmark absolute top-0 left-1/2 h-full w-auto max-w-none"
        />
      </span>
      <ElcamosoWordmark
        {...(wordmarkRef ? { ref: wordmarkRef } : {})}
        {...(wordmarkAriaHidden !== undefined ? { ariaHidden: wordmarkAriaHidden } : {})}
        heroPhase={heroPhase ?? "off"}
        reducedMotion={reducedMotion ?? false}
        className={cn(wordmarkClassName)}
      />
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
