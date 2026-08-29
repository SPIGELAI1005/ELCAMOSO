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
    <div className="flex w-full flex-col items-center md:contents">
      <div
        ref={wordmarkRef}
        className="mt-8 w-fit md:col-start-1 md:row-start-2 md:mt-0 md:justify-self-start md:self-center"
        aria-label="ELCAMOSO, Electric Car Motion Sound"
      >
        <ElcamosoWordmark
          ariaHidden
          heroPhase={phase}
          reducedMotion={reducedMotion}
          className="text-[2.76rem] sm:text-[3.24rem] lg:text-[3.45rem]"
        />
      </div>
      <WordmarkExpansion
        ariaHidden
        className="mt-[0.7rem] text-[10px] sm:text-[11px] md:col-start-1 md:row-start-3 md:-mt-2.5 md:justify-self-start md:self-baseline lg:-mt-3.5 lg:text-xs"
        width={wordmarkWidth}
      />
      <Link
        to="/about"
        className="group mt-4 shrink-0 self-baseline text-[10px] leading-[1.2] tracking-[0.24em] text-muted-foreground uppercase sm:text-[11px] md:col-start-2 md:row-start-3 md:mt-0 md:justify-self-start lg:text-xs"
      >
        Read{" "}
        <span className="text-[#e53935] transition-colors group-hover:text-[#ff5252]">
          About
        </span>
      </Link>
    </div>
  );
}

export function LandingHero() {
  const { phase, reducedMotion } = useHeroWavePhase();

  return (
    <section className="flex min-h-[calc(100svh-4.5rem)] items-center px-6 py-16 pb-28 sm:px-12 md:px-10 lg:px-16">
      <div className="mx-auto grid w-full max-w-6xl justify-items-center gap-10 md:grid-cols-2 md:grid-rows-[auto_auto_auto] md:justify-items-stretch md:gap-x-12 md:gap-y-8 lg:gap-x-20 lg:gap-y-10">
        <HeroMark
          phase={phase}
          reducedMotion={reducedMotion}
          className="elcamoso-mark-lockup h-[9.45rem] w-auto sm:h-[10.8rem] md:col-start-1 md:row-start-1 md:h-[11.475rem] md:justify-self-start lg:h-[12.825rem]"
        />
        <HeroBrandTitle phase={phase} reducedMotion={reducedMotion} />

        <div className="flex w-full max-w-xs flex-col items-center text-center md:col-start-2 md:row-start-1 md:max-w-none md:items-start md:self-end md:text-left">
          <h1 className="text-4xl leading-[1.08] font-light tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.06]">
            Your EV.
            <br />
            Your Sound.
            <br />
            More Emotion.
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground">
            Feel the e-motion in your electrical motion.
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col items-center md:col-start-2 md:row-start-2 md:max-w-none md:flex-row md:items-center md:gap-8 md:justify-self-start md:self-center">
          <LandingStartDriveButton />
          <Link
            to="/demo"
            hash="feel"
            className="mt-4 shrink-0 text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground md:mt-0"
          >
            Hear it
          </Link>
        </div>
      </div>
    </section>
  );
}
