import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { LandingHero } from "@/components/LandingHero";
import { LandingPlansSection } from "@/components/LandingPlansSection";
import { ExperienceFamilyGrid } from "@/components/experiences/ExperienceFamilyGrid";
import { MotionIntentDiagram } from "@/components/experiences/MotionIntentDiagram";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { EXPERIENCE_FAMILIES, isDriveSongEnabled } from "@/lib/experiences";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => createSeoHeadFromPath("/"),
});

function Landing() {
  const reducedMotion = useReducedMotion();
  const driveSong = isDriveSongEnabled();
  const families = EXPERIENCE_FAMILIES.filter((f) => f.kind !== "fusion");
  const fusion = EXPERIENCE_FAMILIES.find((f) => f.kind === "fusion");

  return (
    <main className="min-h-screen">
      <LandingHero />

      <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:px-12">
        <h2 className="text-3xl font-light tracking-tight sm:text-4xl">Choose your experience</h2>
        <p className="mt-3 max-w-lg text-muted-foreground">Machine. Music. Another world.</p>
        <ExperienceFamilyGrid className="mt-12" families={families} large />
        {fusion ? (
          <Link
            to={fusion.href}
            className="mt-8 flex flex-col border border-border/70 bg-surface-1/20 px-6 py-8 transition-colors hover:border-foreground/40"
          >
            <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
              {fusion.label}
            </p>
            <p className="mt-3 text-2xl font-light">{fusion.headline}</p>
            <p className="mt-2 text-sm text-muted-foreground">{fusion.subcopy}</p>
          </Link>
        ) : null}
      </section>

      <section className="border-y border-border/60 bg-surface-1/15 px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
            One drive. Two ways to listen.
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
            Hear it now. Or hear it later.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Bring motion-responsive sound into the cabin as you drive, or enjoy the road in complete
            silence and let ELCAMOSO remember only how the journey moved.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="border border-border/70 p-6">
              <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
                Live sound
              </p>
              <p className="mt-3 text-lg font-light">Make the drive audible.</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Engines, music, and immersive worlds respond while acceleration, cruising, and regen
                happen.
              </p>
            </div>
            <div className="border border-border/70 p-6">
              <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
                Silent capture
              </p>
              <p className="mt-3 text-lg font-light">Keep the quiet. Create later.</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Record the motion without cabin audio. When you arrive, hear the real journey
                through the experience you choose.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-light tracking-tight sm:text-4xl">
            Your driving becomes the arrangement.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            {["Drums", "Bass", "Guitar", "Strings", "Motion"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-12">
            <MotionIntentDiagram />
          </div>
          <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted-foreground">
            Accelerate and the arrangement builds. Cruise and it settles. Lift and it breathes. No
            two drives play exactly the same.
          </p>
          <div className="mt-8 text-center">
            <Link
              to="/symphony"
              className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
            >
              Drive Symphony
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-12">
        <h2 className="text-3xl font-light">Your drive is ready.</h2>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Replay the complete journey through Engine, Symphony, World, or Fusion. Or turn its most
          expressive moments into a shorter Drive Song you can replay and share.
        </p>
        {driveSong ? (
          <Link
            to="/garage"
            className="mt-6 inline-block text-[10px] tracking-[0.24em] uppercase hover:text-foreground"
          >
            Open Garage
          </Link>
        ) : (
          <p className="mt-6 text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            Coming next
          </p>
        )}
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-12">
        <h2 className="text-3xl font-light">Phone + car</h2>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Pair your phone for richer motion. Sound stays on the car. Set up while parked.
        </p>
        <div className="mt-8 flex items-center gap-8 border border-border/70 bg-surface-1/20 px-6 py-8">
          <div
            className="flex h-28 w-28 shrink-0 items-center justify-center border-2 border-foreground bg-white"
            aria-hidden
          >
            <ElcamosoMark
              reducedMotion={reducedMotion}
              className="h-10 w-auto text-black opacity-80"
            />
          </div>
          <div>
            <p className="text-sm font-light">Scan to connect phone</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Free basic pairing on every Drive session.
            </p>
            <Link
              to="/drive"
              className="mt-4 inline-block text-[10px] tracking-[0.22em] uppercase hover:text-foreground"
            >
              Open Drive
            </Link>
          </div>
        </div>
      </section>

      <LandingPlansSection />

      <section className="mx-auto w-full max-w-3xl px-6 pb-8 sm:px-12">
        <nav aria-label="Popular destinations" className="flex flex-wrap gap-x-6 gap-y-3">
          {(
            [
              ["/explore", "Explore"],
              ["/sounds", "Sounds"],
              ["/symphony", "Symphony"],
              ["/worlds", "Worlds"],
              ["/fusion", "Fusion"],
              ["/pricing", "Pricing"],
              ["/about", "About"],
            ] as const
          ).map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-12">
        <h2 className="text-3xl font-light">Your drive stays yours.</h2>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Driving data is processed locally on your device. ELCAMOSO does not need to store your
          route to make sound react to your motion.
        </p>
      </section>
    </main>
  );
}
