import { createFileRoute } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => createSeoHeadFromPath("/about"),
});

function AboutFieldClip({ src, label }: { src: string; label: string }) {
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
            ELCAMOSO turns the way you move into sound, live in the cabin or later from a recorded
            journey. It is for people who love responsive sound, and for people who love the quiet
            just as much.
          </p>
        </header>

        <section className="mt-16 border-t border-border pt-16">
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Sound when you want it
          </p>
          <h2 className="mt-3 text-2xl font-light">Hear it now. Or hear it later.</h2>
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              Some drives call for sound in the moment. Choose an Engine, Symphony, World, or Fusion
              experience and ELCAMOSO responds as the road unfolds. Acceleration builds energy,
              cruising finds a rhythm, and regeneration releases it.
            </p>
            <p>
              Other drives are better in silence. Silent Capture lets the cabin stay calm while
              ELCAMOSO records a private motion trace on your device. No route is needed. When you
              arrive, the journey is ready to be heard in a completely different form.
            </p>
          </div>

          <div className="mt-10 border border-border/70 bg-surface-1/20 p-6 sm:p-8">
            <p className="text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
              Imagine the journey
            </p>
            <p className="mt-4 text-lg font-light leading-relaxed">
              Munich to Garmisch. The whole drive in complete silence.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              At the hotel, ELCAMOSO says: Your drive is ready. Choose Symphony and hear your own
              acceleration, mountain-road rhythm, open cruising, and regen become an orchestral
              journey. The road already composed it. You decide when to listen.
            </p>
          </div>

          <div className="mt-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              This makes ELCAMOSO both a live driving experience and a creative journey recorder. It
              does not require constant sound in the cabin. Silence is not the absence of the
              product. It can be the beginning of the creation.
            </p>
            <p>
              It is made for EV enthusiasts, quiet-cabin drivers, commuters, road-trippers, music
              lovers, and curious creators who want to discover what their own movement sounds like.
            </p>
          </div>
        </section>

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
              give back a layer of feeling: sound that follows speed, acceleration, and regen the
              way a great engine once did, without giving up what makes electric driving worth
              choosing.
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
              electric car who still feels like a driver: pioneers of the format who want
              performance and technology. It is also for people who prefer silence while moving,
              then want to return to the journey as music, atmosphere, or a new engine personality
              after they arrive.
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
                label="On the road: capture and listen"
              />
              <AboutFieldClip
                src="/about/field-capture-2.mp4"
                label="Field recording: tuning to motion"
              />
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-border pt-16">
          <h2 className="text-2xl font-light">Motion becomes sound.</h2>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
            ELCAMOSO does not play a fixed track. Live, it reads how you move and shapes sound in
            real time. In Journey Replay, the recorded motion becomes the timeline, so speed,
            acceleration, cruising, and regen remain tied to what you hear.
          </p>
          <div className="mt-12 flex flex-col items-center gap-6 text-center text-sm tracking-[0.2em] text-muted-foreground uppercase">
            <p>Speed</p>
            <p>Acceleration</p>
            <p>Regeneration</p>
            <ElcamosoMark intensity={0.72} className="my-2 h-10 w-auto text-foreground" />
            <p className="text-foreground">Dynamic Sound</p>
          </div>
          <div className="mt-12 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              In the cabin: motion from the drive, sound shaped to match.
            </p>
            <div className="grid gap-8 sm:grid-cols-2">
              <AboutFieldClip
                src="/about/tesla-motion-1.mp4"
                label="In the cabin: motion to sound"
              />
              <AboutFieldClip
                src="/about/tesla-motion-2.mp4"
                label="On the road: sound follows drive"
              />
            </div>
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
              A recorded journey can be replayed at its real duration through different experiences
              without creating a second journey. When you want a shorter piece, Drive Song condenses
              its character into a composition made for listening and sharing.
            </p>
            <p>
              Your drive stays yours. Motion data is processed on your device. ELCAMOSO does not
              need to store your route to make sound react to the way you move.
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
