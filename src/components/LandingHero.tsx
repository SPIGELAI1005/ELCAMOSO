import { useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ElcamosoMark,
  ElcamosoWordmark,
  type HeroWavePhase,
  useHeroWavePhase,
  WordmarkExpansion,
} from "@/components/ElcamosoLogo";
import { getSession } from "@/lib/drive/session";
import { StartDriveBeacon } from "@/components/StartDriveBeacon";
import { cn } from "@/lib/utils";

function HeroMark({
  className,
  phase,
  reducedMotion,
}: {
  className?: string;
  phase: HeroWavePhase;
  reducedMotion: boolean;
}) {
  return (
    <ElcamosoMark
      heroPhase={phase}
      intensity={1}
      reducedMotion={reducedMotion}
      className={className}
    />
  );
}

export function LandingStartDriveButton({ className }: { className?: string }) {
  const navigate = useNavigate();

  const onStartDrive = () => {
    getSession().primeAudioFromUserGesture();
    void navigate({ to: "/drive", search: { start: true } });
  };

  return (
    <StartDriveBeacon className="max-w-full">
      <button
        type="button"
        onClick={onStartDrive}
        className={cn(
          "relative z-10 inline-flex h-14 w-full min-w-[14rem] items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90 sm:w-auto",
          className,
        )}
      >
        Start Drive
      </button>
    </StartDriveBeacon>
  );
}

function HeroReadAboutLink({ className }: { className?: string }) {
  return (
    <Link
      to="/about"
      className={cn(
        "group shrink-0 text-[10px] leading-[1.2] tracking-[0.24em] text-muted-foreground uppercase sm:text-[11px] lg:text-xs",
        className,
      )}
    >
      Read{" "}
      <span className="text-[#e53935] transition-colors group-hover:text-[#ff5252]">
        About
      </span>
    </Link>
  );
}

function HeroBrandTitle({
  phase,
  reducedMotion,
}: {
  phase: HeroWavePhase;
  reducedMotion: boolean;
}) {
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const [wordmarkWidth, setWordmarkWidth] = useState<number>();

  useLayoutEffect(() => {
    const wordmark = wordmarkRef.current?.querySelector(".wordmark-lockup");
    if (!wordmark) return;

    const sync = () => {
      setWordmarkWidth(wordmark.getBoundingClientRect().width);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(wordmark);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wordmarkRef}
      className="mt-4 flex w-fit flex-col items-center lg:col-start-1 lg:row-start-2 lg:row-span-2 lg:mt-0 lg:items-start lg:justify-self-start lg:self-center"
      aria-label="ELCAMOSO, Electric Car Motion Sound"
    >
      <ElcamosoWordmark
        ariaHidden
        heroPhase={phase}
        reducedMotion={reducedMotion}
        className="text-[2.76rem] sm:text-[3.24rem] lg:text-[3.45rem]"
      />
      <WordmarkExpansion
        ariaHidden
        className="mt-[0.55rem] w-full text-[9px] sm:text-[10px] lg:-mt-2.5 lg:text-xs xl:-mt-3.5"
        width={wordmarkWidth}
      />
    </div>
  );
}

export function LandingHero() {
  const { phase, reducedMotion } = useHeroWavePhase();

  return (
    <section className="flex min-h-0 items-start px-6 pt-3 pb-14 sm:px-12 sm:pt-6 lg:min-h-[calc(100svh-4.5rem)] lg:items-center lg:px-10 lg:py-16 lg:pb-28 xl:px-16">
      <div className="mx-auto grid w-full max-w-6xl justify-items-center gap-5 sm:gap-7 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto] lg:justify-items-stretch lg:gap-x-12 lg:gap-y-8 lg:gap-10 xl:gap-x-20 xl:gap-y-10">
        <HeroMark
          phase={phase}
          reducedMotion={reducedMotion}
          className="elcamoso-mark-lockup h-[7.65rem] w-auto sm:h-[9rem] lg:col-start-1 lg:row-start-1 lg:h-[11.475rem] lg:justify-self-start xl:h-[12.825rem]"
        />
        <HeroBrandTitle phase={phase} reducedMotion={reducedMotion} />

        <div className="flex w-full max-w-xs flex-col items-center text-center lg:col-start-2 lg:row-start-1 lg:max-w-none lg:items-start lg:self-end lg:text-left">
          <h1 className="text-[2.05rem] leading-[1.08] font-light tracking-tight sm:text-5xl xl:text-[3.25rem] xl:leading-[1.06]">
            Your EV.
            <br />
            Your Sound.
            <br />
            More Emotion.
          </h1>
          <p className="mt-3 max-w-md text-[0.9375rem] text-muted-foreground sm:mt-6 sm:text-base">
            Feel the e-motion in your electrical motion.
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col items-center lg:col-start-2 lg:row-start-2 lg:max-w-none lg:flex-row lg:items-center lg:gap-8 lg:justify-self-start lg:self-center">
          <LandingStartDriveButton />
          <Link
            to="/demo"
            hash="feel"
            className="mt-3 shrink-0 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground sm:mt-4 lg:mt-0"
          >
            Hear it
          </Link>
          <HeroReadAboutLink className="mt-3 sm:mt-4 lg:hidden" />
        </div>

        <HeroReadAboutLink className="hidden lg:inline-flex lg:col-start-2 lg:row-start-3 lg:justify-self-start lg:self-baseline" />
      </div>
    </section>
  );
}
