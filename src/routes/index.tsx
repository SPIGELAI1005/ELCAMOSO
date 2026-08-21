import { createFileRoute, Link } from "@tanstack/react-router";
import { ElcamosoMark, ElcamosoWordmark } from "@/components/ElcamosoLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PROFILE_CATEGORIES,
  SOUND_PROFILES,
  intensityBand,
} from "@/lib/sound/profiles";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "ELCAMOSO · Your EV. Your Sound. More Emotion." },
      {
        name: "description",
        content: "Motion-responsive sound experiences for electric cars.",
      },
      { property: "og:title", content: "ELCAMOSO · Your EV. Your Sound. More Emotion." },
      {
        property: "og:description",
        content: "Motion-responsive sound experiences for electric cars.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Landing() {
  const catalog = PROFILE_CATEGORIES.filter((category) => category !== "Garage")
    .map((category) => ({
      category,
      items: SOUND_PROFILES.filter((p) => p.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <main className="min-h-screen">
      <section className="flex min-h-[calc(100svh-4.5rem)] flex-col justify-between px-6 py-10 sm:px-12">
        <div className="mx-auto grid w-full max-w-5xl flex-1 content-center items-end gap-x-16 gap-y-12 py-16 lg:grid-cols-2 lg:gap-x-24">
          {/* Brand stack: mark centered on ELCAMOSO; expansion directly under the wordmark */}
          <div className="order-1 flex flex-col items-center gap-8">
            <ElcamosoMark
              animate
              className="h-[10.76rem] w-auto sm:h-[13.46rem]"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="flex min-h-14 items-center justify-center">
                <ElcamosoWordmark className="text-center text-[2.6325rem] sm:text-[2.925rem]" />
              </div>
              <p className="text-center text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                Electric Car Motion Sound
              </p>
            </div>
          </div>

          <div className="order-2 flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
            <h1 className="animate-rise text-4xl leading-[1.05] font-light tracking-tight sm:text-6xl">
              Your EV.
              <br />
              Your Sound.
              <br />
              More Emotion.
            </h1>
            <p
              className="animate-rise max-w-sm text-base text-muted-foreground"
              style={{ animationDelay: "160ms" }}
            >
              Electric motion. More e-motion.
            </p>
            <div className="flex flex-col items-center gap-3 lg:items-start">
              <div className="flex min-h-14 items-center justify-center lg:justify-start">
                <Link
                  to="/drive"
                  className="animate-rise inline-flex h-14 items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
                  style={{ animationDelay: "300ms" }}
                >
                  Start Drive
                </Link>
              </div>
              {/* Match expansion line so Start Drive lines up with ELCAMOSO */}
              <p
                className="invisible hidden text-[11px] tracking-[0.28em] uppercase lg:block"
                aria-hidden="true"
              >
                Electric Car Motion Sound
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
          Works with your EV
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16 sm:px-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xs tracking-[0.28em] text-muted-foreground uppercase">
              Choose your sound
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Browse full library.
            </p>
          </div>
          <Link
            to="/sounds"
            className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Browse all
          </Link>
        </div>

        <Accordion type="multiple" className="border-t border-border">
          {catalog.map(({ category, items }) => (
            <AccordionItem key={category} value={category} className="border-border">
              <AccordionTrigger className="py-6 text-[11px] font-normal tracking-[0.34em] text-muted-foreground uppercase hover:no-underline hover:text-foreground">
                <span className="flex items-baseline gap-4">
                  <span>{category}</span>
                  <span className="text-[10px] tracking-[0.2em] tabular-nums opacity-70">
                    {items.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-8">
                <div className="divide-y divide-border border-y border-border sm:grid sm:grid-cols-3 sm:gap-px sm:divide-y-0 sm:border-0 sm:bg-border">
                  {items.map((profile) => (
                    <div
                      key={profile.id}
                      className="bg-background py-8 sm:px-8 sm:py-10"
                    >
                      <p className="text-xl font-light sm:text-2xl">{profile.name}</p>
                      <p className="mt-3 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                        {profile.traits.join(" · ")} · {intensityBand(profile)}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-20 max-w-md border-t border-border pt-10">
          <p className="text-lg font-light">Your drive stays yours.</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Speed and motion data are processed directly on this device. ELCAMOSO does not
            upload your driving route in this MVP.
          </p>
          <nav
            aria-label="Legal"
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[11px] tracking-[0.18em] text-muted-foreground uppercase"
          >
            <Link to="/legal/impressum" className="hover:text-foreground">
              Impressum
            </Link>
            <Link to="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/legal/cookies" className="hover:text-foreground">
              Cookies
            </Link>
            <Link to="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/legal/accessibility" className="hover:text-foreground">
              Accessibility
            </Link>
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
