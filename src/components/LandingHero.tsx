import { Link } from "@tanstack/react-router";
import {
  ElcamosoLogoLockup,
  ElcamosoWordmark,
  useHeroWavePhase,
  WordmarkExpansion,
} from "@/components/ElcamosoLogo";
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
      to="/story"
      className={cn("group shrink-0 leading-[1.2] text-muted-foreground", className)}
    >
      Read{" "}
      <span className="text-[#e53935] transition-colors group-hover:text-[#ff5252]">Story</span>
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

const WORDMARK_CLASS = "text-[2.76rem] sm:text-[3.24rem] lg:text-[3.45rem]";
const MARK_CLASS = "h-[7.65rem] w-auto sm:h-[9rem] lg:h-[11.475rem] xl:h-[12.825rem]";

export function LandingHero() {
  const { phase, reducedMotion } = useHeroWavePhase();

  return (
    <section className="flex min-h-0 items-start overflow-x-clip px-6 pt-[calc(0.75rem+5svh)] pb-14 sm:px-12 sm:pt-[calc(1.5rem+5svh)] lg:min-h-[calc(100svh-4.5rem)] lg:items-center lg:px-10 lg:pt-16 lg:pb-28 xl:px-16">
      <div className="mx-auto grid w-full max-w-6xl justify-items-center gap-5 sm:gap-7 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto] lg:justify-items-stretch lg:gap-x-12 lg:gap-y-8 lg:gap-10 xl:gap-x-20 xl:gap-y-10">
        <div className="flex w-full flex-col items-center lg:contents">
          {/* Rows 1–2: mark + ELCAMOSO, self-end so the wordmark lines up with Start Drive. */}
          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:flex lg:justify-center lg:justify-self-center lg:self-end">
            <ElcamosoLogoLockup
              heroPhase={phase}
              intensity={1}
              reducedMotion={reducedMotion}
              wordmarkAriaHidden
              markClassName={MARK_CLASS}
              wordmarkClassName={cn(WORDMARK_CLASS, "mt-4 sm:mt-5 lg:mt-6 xl:mt-8")}
            />
          </div>

          {/* Row 3: expansion aligned with Read Story // Hear it; width locked via invisible wordmark sizer. */}
          <div className="mt-[0.55rem] flex w-full justify-center lg:col-start-1 lg:row-start-3 lg:mt-0 lg:self-start">
            <div className="inline-flex w-fit max-w-full flex-col items-center">
              <ElcamosoWordmark
                ariaHidden
                className={cn(WORDMARK_CLASS, "pointer-events-none invisible h-0 overflow-hidden")}
              />
              <WordmarkExpansion
                ariaHidden
                className="w-full text-[10px] text-muted-foreground/70 sm:text-[11px] lg:text-xs"
              />
            </div>
          </div>
        </div>

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

        <div className="flex w-full max-w-xs flex-col items-center lg:col-start-2 lg:row-start-2 lg:max-w-none lg:items-start lg:justify-self-start lg:self-center">
          <LandingStartDriveButton />
          <HeroSecondaryLinks className="mt-3 sm:mt-4 lg:hidden" />
        </div>

        <HeroSecondaryLinks className="hidden lg:col-start-2 lg:row-start-3 lg:flex lg:justify-self-start lg:self-start" />
      </div>
    </section>
  );
}
