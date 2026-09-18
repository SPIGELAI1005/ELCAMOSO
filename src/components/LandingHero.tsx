import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ElcamosoLogoLockup, useHeroWavePhase, WordmarkExpansion } from "@/components/ElcamosoLogo";
import { getSession } from "@/lib/drive/session";
import { StartDriveBeacon } from "@/components/StartDriveBeacon";
import { cn } from "@/lib/utils";

export function LandingStartDriveButton({ className }: { className?: string }) {
  const primeAudio = () => {
    getSession().primeAudioFromUserGesture();
  };

  return (
    <StartDriveBeacon className="max-w-full">
      <Link
        to="/drive"
        search={{ start: true }}
        onClick={primeAudio}
        className={cn(
          "relative z-10 inline-flex h-14 w-full min-w-[14rem] items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90 sm:w-auto",
          className,
        )}
      >
        Start Drive
      </Link>
    </StartDriveBeacon>
  );
}

function HeroReadAboutLink({ className }: { className?: string }) {
  return (
    <Link
      to="/about"
      className={cn("group shrink-0 leading-[1.2] text-muted-foreground", className)}
    >
      Read{" "}
      <span className="text-[#e53935] transition-colors group-hover:text-[#ff5252]">About</span>
    </Link>
  );
}

function HeroSecondaryLinks({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-[10px] tracking-[0.24em] uppercase sm:text-[11px] lg:items-start lg:text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <HeroReadAboutLink />
        <span className="text-muted-foreground/50" aria-hidden="true">
          //
        </span>
        <Link
          to="/demo"
          hash="feel"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          Hear it
        </Link>
      </div>
      <Link to="/explore" className="text-muted-foreground hover:text-foreground">
        Explore Experiences
      </Link>
    </div>
  );
}

function useWordmarkWidth() {
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const [wordmarkWidth, setWordmarkWidth] = useState<number>();

  useLayoutEffect(() => {
    const wordmark = wordmarkRef.current;
    if (!wordmark) return;

    // Layout width only - getBoundingClientRect includes letter wave-in transforms
    // and can make the expansion (and perceived lockup) jitter on refresh.
    const sync = () => {
      const width = wordmark.offsetWidth;
      if (width > 0) setWordmarkWidth(width);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(wordmark);
    void document.fonts?.ready?.then(sync);
    return () => observer.disconnect();
  }, []);

  return { wordmarkRef, wordmarkWidth };
}

const WORDMARK_CLASS = "text-[2.76rem] sm:text-[3.24rem] lg:text-[3.45rem]";
const MARK_CLASS = "h-[7.65rem] w-auto sm:h-[9rem] lg:h-[11.475rem] xl:h-[12.825rem]";

export function LandingHero() {
  const { phase, reducedMotion } = useHeroWavePhase();
  const { wordmarkRef, wordmarkWidth } = useWordmarkWidth();

  return (
    <section className="flex min-h-0 items-start overflow-x-clip px-6 pt-3 pb-14 sm:px-12 sm:pt-6 lg:min-h-[calc(100svh-4.5rem)] lg:items-center lg:px-10 lg:py-16 lg:pb-28 xl:px-16">
      <div className="mx-auto grid w-full max-w-6xl justify-items-center gap-5 sm:gap-7 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto] lg:justify-items-stretch lg:gap-x-12 lg:gap-y-8 lg:gap-10 xl:gap-x-20 xl:gap-y-10">
        <div className="flex w-full flex-col items-center lg:contents">
          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:flex lg:justify-center lg:justify-self-center lg:self-end">
            <ElcamosoLogoLockup
              heroPhase={phase}
              intensity={1}
              reducedMotion={reducedMotion}
              wordmarkRef={wordmarkRef}
              wordmarkAriaHidden
              markClassName={MARK_CLASS}
              wordmarkClassName={cn(WORDMARK_CLASS, "mt-4 sm:mt-5 lg:mt-6 xl:mt-8")}
            />
          </div>

          {wordmarkWidth ? (
            <div className="mt-[0.55rem] flex w-full justify-center lg:col-start-1 lg:row-start-3 lg:mt-0 lg:self-baseline">
              <WordmarkExpansion
                ariaHidden
                className="text-[8px] sm:text-[9px] lg:text-[10px] xl:text-xs"
                width={wordmarkWidth}
              />
            </div>
          ) : null}
        </div>

        <div className="flex w-full max-w-xs flex-col items-center text-center lg:col-start-2 lg:row-start-1 lg:max-w-none lg:items-start lg:self-end lg:text-left">
          <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
            Turn motion into sound
          </p>
          <h1 className="mt-3 text-[2.05rem] leading-[1.08] font-light tracking-tight sm:text-5xl xl:text-[3.25rem] xl:leading-[1.06]">
            Your EV.
            <br />
            Your Sound.
            <br />
            More Emotion.
          </h1>
          <p className="mt-3 max-w-md text-[0.9375rem] text-muted-foreground sm:mt-6 sm:text-base">
            Engines. Music. Worlds.
            <br />
            Feel the e-motion in your electrical motion.
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col items-center lg:col-start-2 lg:row-start-2 lg:max-w-none lg:items-start lg:justify-self-start lg:self-center">
          <LandingStartDriveButton />
          <HeroSecondaryLinks className="mt-3 sm:mt-4 lg:hidden" />
        </div>

        <HeroSecondaryLinks className="hidden lg:col-start-2 lg:row-start-3 lg:flex lg:justify-self-start lg:self-baseline" />
      </div>
    </section>
  );
}
