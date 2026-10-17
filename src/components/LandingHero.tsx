import { Link, useNavigate } from "@tanstack/react-router";
import {
  ElcamosoWordmark,
  useHeroWavePhase,
  WordmarkExpansion,
  type HeroWavePhase,
} from "@/components/ElcamosoLogo";
import { HeroSoundBackdrop } from "@/components/HeroSoundBackdrop";
import { StartDriveMarkControl } from "@/components/StartDriveMarkControl";
import { cn } from "@/lib/utils";

/**
 * Hero Start Drive: brand + expansion above, O ))) in the middle, tagline next,
 * Start Drive face last after the logo intro settles.
 */
export function LandingStartDriveMark({
  heroPhase,
  reducedMotion,
  className,
}: {
  heroPhase: HeroWavePhase;
  reducedMotion: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const showTagline = reducedMotion || heroPhase === "hold" || heroPhase === "radiate";
  const showStartFace = reducedMotion || heroPhase === "radiate";

  return (
    <div
      className={cn(
        "inline-flex w-fit max-w-full flex-col items-center text-center",
        className,
      )}
    >
      <div className="inline-flex w-fit max-w-full flex-col items-center">
        <ElcamosoWordmark
          ariaHidden
          heroPhase={heroPhase}
          reducedMotion={reducedMotion}
          className={WORDMARK_CLASS}
        />
        <WordmarkExpansion
          ariaHidden
          className="mt-[0.55rem] w-full text-[10px] text-muted-foreground/70 sm:text-[11px] lg:text-xs"
        />
      </div>

      <StartDriveMarkControl
        heroPhase={heroPhase}
        reducedMotion={reducedMotion}
        revealFace={showStartFace}
        className="mt-8 sm:mt-10 lg:mt-12"
        onStart={() => {
          void navigate({ to: "/drive", search: { start: true } });
        }}
      />

      <h1
        className={cn(
          "mt-8 text-[1.35rem] leading-[1.12] font-light tracking-tight transition-[opacity,transform] duration-700 ease-out sm:mt-10 sm:text-4xl lg:mt-12 lg:text-5xl xl:text-[3.25rem] xl:leading-[1.06]",
          showTagline ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <span className="whitespace-nowrap">Your EV. Your Sound.</span>
        <br />
        More Emotion.
      </h1>
    </div>
  );
}

function HeroSecondaryLinks({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-[10px] tracking-[0.24em] uppercase sm:text-[11px] lg:text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Link
          to="/story"
          className="group shrink-0 leading-[1.2] text-muted-foreground"
        >
          Read{" "}
          <span className="text-[#e53935] transition-colors group-hover:text-[#ff5252]">
            Story
          </span>
        </Link>
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

export function LandingHero() {
  const { phase, reducedMotion } = useHeroWavePhase();

  return (
    <section className="relative flex min-h-0 flex-col overflow-x-clip px-6 pt-[calc(0.75rem+5svh)] pb-10 sm:px-12 sm:pt-[calc(1.5rem+5svh)] sm:pb-12 lg:min-h-[calc(100svh-4.5rem)] lg:px-10 lg:pt-16 lg:pb-16 xl:px-16">
      <HeroSoundBackdrop phase={phase} reducedMotion={reducedMotion} />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center">
        <LandingStartDriveMark heroPhase={phase} reducedMotion={reducedMotion} />
      </div>

      <HeroSecondaryLinks className="relative z-10 mx-auto mt-10 w-full max-w-6xl items-center sm:mt-12 lg:mt-14" />
    </section>
  );
}
