import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";

export const Route = createFileRoute("/science")({
  component: ScienceOfElcamoso,
  head: () => createSeoHeadFromPath("/science"),
});

function Equation({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <div
      role="math"
      aria-label={ariaLabel}
      className="my-8 overflow-x-auto border border-border/70 bg-surface-1/30 px-5 py-7 text-center font-mono text-[1.05rem] leading-relaxed tracking-wide text-foreground sm:px-8 sm:text-lg"
    >
      {children}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <sub className="text-[0.72em]">{children}</sub>;
}

function Overline({ children }: { children: ReactNode }) {
  return (
    <span className="underline decoration-1 underline-offset-[0.28em]">{children}</span>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-28 border-t border-border pt-16 sm:mt-20 sm:pt-20">
      {eyebrow ? (
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{eyebrow}</p>
      ) : null}
      <h2 className={`text-2xl font-light sm:text-3xl ${eyebrow ? "mt-3" : ""}`}>{title}</h2>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

function ExperienceBlock({
  name,
  lead,
  body,
}: {
  name: string;
  lead: string;
  body: string;
}) {
  return (
    <div className="border-t border-border/60 pt-8 first:border-t-0 first:pt-0">
      <h3 className="text-lg font-light text-foreground">{name}</h3>
      <p className="mt-2 text-sm font-medium text-foreground/90">{lead}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function ScienceOfElcamoso() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_at_top,oklch(1_0_0_/_0.06),transparent_65%)]"
      />

      <article className="relative mx-auto w-full max-w-2xl px-6 pt-16 pb-28 sm:px-10">
        <header>
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
            Science of ELCAMOSO
          </p>
          <h1 className="mt-5 text-3xl font-light leading-[1.15] sm:text-5xl sm:leading-[1.12]">
            Every journey has a rhythm.
            <span className="mt-2 block text-foreground">Hear yours.</span>
          </h1>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              A quiet departure. A stretch of steady motion. The gentle release as the world slows
              around you.
            </p>
            <p>
              ELCAMOSO Experiences turns these moments into musical expression: shaping a soundtrack
              around the way your journey unfolds.
            </p>
          </div>
          <p className="mt-10 text-lg font-light leading-relaxed text-foreground">
            Your movement becomes an instrument. Your journey becomes a composition.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <ElcamosoMark intensity={0.7} className="h-8 w-auto text-foreground" />
            <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              Motion · Music · Continuity
            </p>
          </div>
        </header>

        <Section title="From motion to emotion">
          <p>Music has movement, tension, continuity and release. A journey does too.</p>
          <p>
            Our approach connects these two worlds through a mathematical composition model. Driving
            signals guide musical expression, while a musical framework preserves melody, harmony
            and structure.
          </p>
          <p>
            Speed influences texture. Acceleration introduces movement. Steady travel gives a melody
            room to develop. Deceleration creates space for a softer response.
          </p>
          <p className="text-foreground">
            The purpose is simple:{" "}
            <strong className="font-medium">
              make the soundtrack feel connected to the moment, while still sounding like music
              worth listening to.
            </strong>
          </p>
        </Section>

        <Section title="The mathematics behind the music">
          <p>The composition begins with three observations:</p>
          <ul className="list-none space-y-3">
            <li>
              <strong className="font-medium text-foreground">Speed:</strong> how quickly you are
              moving.
            </li>
            <li>
              <strong className="font-medium text-foreground">Acceleration:</strong> how that
              movement changes over time.
            </li>
            <li>
              <strong className="font-medium text-foreground">Continuity:</strong> how long a steady
              rhythm of travel is maintained.
            </li>
          </ul>
          <p>
            Before these signals become music, they are filtered to reduce measurement noise.
            Acceleration is derived from changes in filtered speed when a reliable direct
            measurement is unavailable.
          </p>
          <p>
            The model then converts these observations into bounded musical controls. These are
            expressive signals, not driving scores.
          </p>
        </Section>

        <Section id="motion" eyebrow="01 · Motion" title="A sense of movement that opens gradually.">
          <Equation ariaLabel="V equals filtered speed over filtered speed plus v zero">
            <span>
              V = <Overline>v</Overline> / (<Overline>v</Overline> + v<Sub>0</Sub>)
            </span>
          </Equation>
          <p>
            Here, <Overline>v</Overline> is filtered speed in metres per second, and v
            <Sub>0</Sub> sets the sensitivity of the response.
          </p>
          <p>
            This curve rises smoothly and gradually levels off. It lets motion influence musical
            texture without making the soundtrack endlessly faster, louder or more intense as speed
            increases.
          </p>
          <p>
            <strong className="font-medium text-foreground">Musical purpose:</strong> shape register,
            rhythmic presence and the feeling of forward movement.
          </p>
        </Section>

        <Section
          id="expression"
          eyebrow="02 · Expression"
          title="Small changes in movement become changes in phrasing."
        >
          <Equation ariaLabel="A equals hyperbolic tangent of max filtered acceleration over a zero">
            <span>
              A = tanh(max(<Overline>a</Overline>, 0) / a<Sub>0</Sub>)
            </span>
          </Equation>
          <Equation ariaLabel="D equals hyperbolic tangent of max negative filtered acceleration over d zero">
            <span>
              D = tanh(max(−<Overline>a</Overline>, 0) / d<Sub>0</Sub>)
            </span>
          </Equation>
          <p>
            Here, <Overline>a</Overline> is filtered acceleration. The sensitivity constants a
            <Sub>0</Sub> and d<Sub>0</Sub> control how strongly acceleration and deceleration
            influence the composition.
          </p>
          <p>
            The hyperbolic tangent function, tanh, creates a smooth response that approaches a
            limit. Larger inputs therefore have progressively less additional influence.
          </p>
          <p>
            <strong className="font-medium text-foreground">Musical purpose:</strong> acceleration can
            introduce an ascending phrase or clearer articulation; deceleration can soften an
            attack, thin the percussion or invite a descending answer.
          </p>
          <p>
            These signals describe changes in motion. They do not, by themselves, identify
            accelerator position, braking or regenerative torque.
          </p>
        </Section>

        <Section
          id="continuity"
          eyebrow="03 · Continuity"
          title="Give a moment time, and the music finds more to say."
        >
          <Equation ariaLabel="C equals one minus e to the power of negative T steady over tau">
            <span>
              C = 1 − e<sup>−T<Sub>steady</Sub> / τ</sup>
            </span>
          </Equation>
          <p>
            Here, T<Sub>steady</Sub> is the duration of approximately steady moving travel, and τ
            determines how gradually the arrangement develops.
          </p>
          <p>
            With an initial τ of 20 seconds, the continuity signal reaches approximately:
          </p>
          <div className="overflow-hidden border border-border/70">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Continuity percentages for steady travel durations at tau equals 20 seconds
              </caption>
              <thead className="border-b border-border/70 bg-surface-1/40 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Steady travel
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Continuity
                  </th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {[
                  ["5 seconds", "22%"],
                  ["15 seconds", "53%"],
                  ["30 seconds", "78%"],
                  ["60 seconds", "95%"],
                ].map(([travel, continuity]) => (
                  <tr key={travel} className="border-t border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">{travel}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{continuity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            These percentages represent musical development, not a rating of the driver.
          </p>
          <p>
            Steadiness is evaluated over a rolling window, using both speed variation and
            acceleration. Tolerance around the thresholds prevents a small sensor fluctuation from
            interrupting a developing phrase.
          </p>
          <p>
            <strong className="font-medium text-foreground">Musical purpose:</strong> introduce a
            counter-melody, open the harmony or let another instrument carry the theme. Once the
            arrangement is full, it evolves through variation rather than accumulating more sound.
          </p>
          <p className="text-foreground">
            Some of the richest moments begin with simply finding a steady rhythm.
          </p>
        </Section>

        <Section title="Turning signals into a composition">
          <p>
            The composer combines driving signals with its own musical development value, P. This
            value represents the planned growth of the current section.
          </p>
          <Equation ariaLabel="M equals clip of 0.20 plus 0.20 V plus 0.25 A plus 0.35 P">
            <span>
              M = clip<Sub>[0,1]</Sub>(0.20 + 0.20V + 0.25A + 0.35P)
            </span>
          </Equation>
          <Equation ariaLabel="R equals clip of 0.25 plus 0.45 C plus 0.30 P">
            <span>
              R = clip<Sub>[0,1]</Sub>(0.25 + 0.45C + 0.30P)
            </span>
          </Equation>
          <Equation ariaLabel="L equals D">
            <span>L = D</span>
          </Equation>
          <div className="overflow-x-auto border border-border/70">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Musical control meanings and effects</caption>
              <thead className="border-b border-border/70 bg-surface-1/40 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Control
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Meaning
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Musical effect
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/50">
                  <td className="px-4 py-3 font-mono text-foreground">M · Movement</td>
                  <td className="px-4 py-3 text-muted-foreground">Rhythmic expression</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Articulation, pattern activity and melodic direction
                  </td>
                </tr>
                <tr className="border-t border-border/50">
                  <td className="px-4 py-3 font-mono text-foreground">R · Richness</td>
                  <td className="px-4 py-3 text-muted-foreground">Arrangement development</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Instrumentation, harmonic fullness and counter-melody
                  </td>
                </tr>
                <tr className="border-t border-border/50">
                  <td className="px-4 py-3 font-mono text-foreground">L · Release</td>
                  <td className="px-4 py-3 text-muted-foreground">Deceleration response</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Softer textures, space and descending gestures
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The clipping function keeps a value between zero and one. The coefficients set the
            relative influence of each input.
          </p>
          <p>
            Crucially, the composition has its own capacity to develop. A gentle journey can reach a
            full, expressive musical moment without requiring higher speed or stronger acceleration.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground/90 italic">
            Initial model settings: v<Sub>0</Sub> = 12 m/s, a<Sub>0</Sub> = d<Sub>0</Sub> = 1 m/s
            <Sup>2</Sup>, and τ = 20 s. These are sound-design sensitivities, not recommended
            driving targets. Musical mappings are tuned for each Experience.
          </p>
        </Section>

        <Section title="Responsive in the moment. Coherent over time.">
          <p>Music needs room to breathe.</p>
          <p>
            Expression can respond smoothly within a beat. Instruments enter at bar boundaries.
            Harmony develops across phrases.
          </p>
          <p>
            This musical timing allows the soundtrack to acknowledge a change in movement without
            breaking its flow. Tempo remains anchored to the Experience, while the arrangement
            carries much of the response.
          </p>
          <p>
            A stop can become an interlude. A long cruise can become a variation. The end of a
            journey can become a resolution.
          </p>
        </Section>

        <Section title="Five ways to hear your journey">
          <div className="space-y-8">
            <ExperienceBlock
              name="Cinematic Rock"
              lead="Give the everyday a main theme."
              body="Guitar, bass, drums and strings build around a memorable riff. Movement sharpens its expression; steady travel opens the arrangement into a broader, cinematic sound."
            />
            <ExperienceBlock
              name="Motion Orchestra"
              lead="Let the journey unfold in colour."
              body="A piano theme finds its way into strings, woodwinds and brass. Gentle transitions become orchestral gestures, and sustained motion gives the melody space to grow."
            />
            <ExperienceBlock
              name="Neon Run"
              lead="Find the pulse beneath the city."
              body="Electronic drums, evolving bass and luminous synth patterns form a rhythmic signature. The hook develops with your journey, returning in new textures while keeping its identity."
            />
            <ExperienceBlock
              name="Piano Flow"
              lead="Make room for the quieter moments."
              body="Piano phrases breathe with movement and release. A steady passage invites warmer harmony; slowing down leaves space between the notes."
            />
            <ExperienceBlock
              name="Jazz Cruise"
              lead="Settle into your own groove."
              body="Bass, piano, brushed drums and horn phrases exchange musical ideas. The arrangement moves between intimate passages and richer conversations around the same theme."
            />
          </div>
        </Section>

        <Section title="A theme that belongs to this journey">
          <p>
            At the heart of each composition is a short original motif: a musical idea that returns,
            changes and becomes familiar.
          </p>
          <p>
            The sequence and duration of your journey’s movements help shape its development. A
            stored composition seed preserves the choices that give the piece its identity.
          </p>
          <p>That identity can travel between Experiences.</p>
          <p>
            Hear the same theme through an orchestra. Discover its electronic version. Let it settle
            into piano.
          </p>
          <p className="text-foreground">
            <strong className="font-medium">
              One journey. Different interpretations. A melody that connects them.
            </strong>
          </p>
        </Section>

        <Section title="Arrive with something worth keeping">
          <p>
            The live soundtrack accompanies the journey. A{" "}
            <strong className="font-medium text-foreground">Journey Edit</strong> gives it a
            finished form.
          </p>
          <p>
            A short arrangement brings together the motif, its development and a satisfying return.
            Repeated passages can be shortened; memorable musical transitions can take centre stage.
          </p>
          <p>
            Choose a 15-, 30- or 60-second version. Give it a title. Pair it with an animated visual.
            Keep it for yourself, or share it after the drive.
          </p>
          <p>
            The edit celebrates the musical story, rather than the highest speed or strongest
            acceleration.
          </p>
          <p className="text-lg font-light text-foreground">
            “This is what my journey sounded like.”
          </p>
        </Section>

        <Section title="Designed around the experience">
          <p>
            The composition model can work without precise route coordinates. Location and exact
            speed are hidden from share visuals by default.
          </p>
          <p>
            When driving signals become unreliable, the music continues gently instead of turning
            sensor noise into sudden musical changes.
          </p>
          <p>
            There is no perfect driving pattern to perform and no intensity score to chase.
          </p>
          <p>Bring your journey. Let the music find its shape.</p>
          <div className="mt-10 border border-border/70 bg-surface-1/25 px-6 py-8 sm:px-8">
            <p className="text-xl font-light text-foreground">Choose your Experience.</p>
            <p className="mt-2 text-sm italic text-muted-foreground">Your journey wrote this.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/explore"
                className="inline-flex items-center justify-center border border-foreground bg-foreground px-5 py-2.5 text-[11px] tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-90"
              >
                Explore Experiences
              </Link>
              <Link
                to="/symphony"
                className="inline-flex items-center justify-center border border-border px-5 py-2.5 text-[11px] tracking-[0.2em] text-foreground uppercase transition-colors hover:border-foreground"
              >
                Open Symphony
              </Link>
            </div>
          </div>
        </Section>

        <footer className="mt-16 border-t border-border pt-10">
          <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase">
            Science of ELCAMOSO
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Composition model notes for Symphony Experiences. Sound-design sensitivities, not
            driving targets.
          </p>
        </footer>
      </article>
    </main>
  );
}

function Sup({ children }: { children: ReactNode }) {
  return <sup className="text-[0.72em]">{children}</sup>;
}
