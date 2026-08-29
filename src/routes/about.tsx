import { createFileRoute } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About - ELCAMOSO" },
      {
        name: "description",
        content:
          "The story behind ELCAMOSO: motion-responsive sound for electric driving, born from four years behind the wheel and a love of both EV performance and the emotion of the drive.",
      },
      { property: "og:title", content: "About - ELCAMOSO" },
      {
        property: "og:description",
        content:
          "Motion-responsive sound for electric cars. Your EV. Your Sound. More Emotion.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
});

function AboutFieldClip({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  return (
    <figure className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-[#0A0A0A]">
        <video
          className="aspect-video w-full object-cover"
          controls
          playsInline
          preload="metadata"
          aria-label={label}
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>
      <figcaption className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </figcaption>
    </figure>
  );
}

function About() {
  return (
    <main className="min-h-screen">
      <article className="mx-auto w-full max-w-2xl px-6 pt-16 pb-28 sm:px-10">
        <header>
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">About</p>
          <h1 className="mt-4 text-3xl font-light leading-snug sm:text-4xl">
            Your EV. Your Sound. More Emotion.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            ELCAMOSO turns the way you move into sound that feels locked to the drive: responsive,
            personal, and built for people who love cars and the future they are already living in.
          </p>
        </header>

        <section className="mt-16 border-t border-border pt-16">
          <h2 className="text-2xl font-light">Where it started</h2>
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              For four years, my daily drive has been a Tesla. I still choose it every time: the
              performance, the calm, the technology, the sense that electric motion is the direction
              the road is taking. I am proud to drive an EV and I do not want to go back.
            </p>
            <p>
              But travel has a way of sharpening what you miss. On trips abroad I would rent cars
              with powerful petrol engines: the rise of revs, the character under load, the sound
              that told your body the car was working with you. Coming home to silent acceleration
              was always a relief, and always slightly incomplete. I loved the electric drive. I
              missed the emotion petrol had taught me to expect from a great car.
            </p>
            <p>
              That gap is why ELCAMOSO exists. Not to pretend an EV is something it is not, but to
              give back a layer of feeling: sound that follows speed, acceleration, and regen the way
              a great engine once did, without giving up what makes electric driving worth choosing.
            </p>
          </div>
        </section>

        <section className="mt-16 border-t border-border pt-16">
          <h2 className="text-2xl font-light">Built in the real world</h2>
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              I recorded and tested many cars and engine characters: different layouts, tones, and
              personalities. Hundreds of hours went into capture, listening, and refinement until
              each profile felt honest under real motion, not like a loop pressed to a button.
            </p>
            <p>
              Much of that work was tuned against the speakers and cabin of a Tesla, because that is
              the car I know best. But ELCAMOSO is not a Tesla app. It is for anyone driving an
              electric car who still feels like a driver: pioneers of the format who want performance
              and technology, and who sometimes want the road to sound the way a petrol engine once
              made it feel.
            </p>
            <p>
              The goal was always the same: recreate that connection as faithfully as possible, then
              let you choose the character. Your car. Your motion. Your sound.
            </p>
          </div>
          <div className="mt-12 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              A glimpse from the road: listening, capturing, and shaping sound where motion actually
              happens.
            </p>
            <div className="grid gap-8 sm:grid-cols-2">
              <AboutFieldClip
                src="/about/field-capture-1.mp4"
                label="On the road — capture and listen"
              />
              <AboutFieldClip
                src="/about/field-capture-2.mp4"
                label="Field recording — tuning to motion"
              />
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-border pt-16">
          <h2 className="text-2xl font-light">Motion becomes sound.</h2>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
            ELCAMOSO does not play a fixed track. It reads how you move and shapes sound in real
            time, so throttle, speed, and regen stay tied to what you hear.
          </p>
          <div className="mt-12 flex flex-col items-center gap-6 text-center text-sm tracking-[0.2em] text-muted-foreground uppercase">
            <p>Speed</p>
            <p>Acceleration</p>
            <p>Regeneration</p>
            <ElcamosoMark intensity={0.72} className="my-2 h-10 w-auto text-foreground" />
            <p className="text-foreground">Dynamic Sound</p>
          </div>
        </section>

        <section className="mt-16 border-t border-border pt-16">
          <h2 className="text-2xl font-light">What you get</h2>
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              Sound Profiles can behave like a virtual transmission or rise continuously with load,
              so the platform is not limited to combustion simulation. Turbine, cinematic, playful,
              and manufacturer-inspired EV signatures all share the same motion model.
            </p>
            <p>
              Your drive stays yours. Motion data is processed on your device. ELCAMOSO does not need
              to store your route to make sound react to the way you move.
            </p>
          </div>
        </section>

        <footer className="mt-16 border-t border-border pt-10">
          <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase">
            ELCAMOSO - Electric Car Motion Sound
          </p>
        </footer>
      </article>
    </main>
  );
}
