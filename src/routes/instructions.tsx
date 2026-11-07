import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";

export const Route = createFileRoute("/instructions")({
  component: Instructions,
  head: () => createSeoHeadFromPath("/instructions"),
});

function Section({
  id,
  step,
  title,
  children,
}: {
  id?: string;
  step?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      {step ? (
        <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">{step}</p>
      ) : null}
      <h2 className="mt-2 text-2xl font-light tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Instructions() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-12 sm:py-24">
      <div className="flex items-center gap-4">
        <ElcamosoMark className="h-10 w-auto shrink-0" />
        <div>
          <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
            Getting started
          </p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">
            How to use ELCAMOSO
          </h1>
        </div>
      </div>

      <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
        ELCAMOSO turns the motion of your electric vehicle into sound. It runs in your car's
        browser or on your phone, responding to speed, acceleration, and regenerative braking in
        real time.
      </p>

      <nav
        aria-label="Instructions sections"
        className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-y border-border/60 py-5 text-xs tracking-[0.14em] uppercase"
      >
        <a href="#setup" className="text-muted-foreground hover:text-foreground">
          Setup
        </a>
        <a href="#choose-sound" className="text-muted-foreground hover:text-foreground">
          Choose sound
        </a>
        <a href="#live-sound" className="text-muted-foreground hover:text-foreground">
          Live sound
        </a>
        <a href="#silent-capture" className="text-muted-foreground hover:text-foreground">
          Silent Capture
        </a>
        <a href="#phone-pairing" className="text-muted-foreground hover:text-foreground">
          Phone pairing
        </a>
        <a href="#before-departure" className="text-muted-foreground hover:text-foreground">
          Before departure
        </a>
        <a href="#after-drive" className="text-muted-foreground hover:text-foreground">
          After drive
        </a>
        <a href="#troubleshooting" className="text-muted-foreground hover:text-foreground">
          Troubleshooting
        </a>
        <a href="#safety" className="text-muted-foreground hover:text-foreground">
          Safety
        </a>
      </nav>

      <div className="mt-12 space-y-16">
        <Section id="setup" step="Step 1" title="Set up while parked">
          <p>
            <strong className="font-medium text-foreground">
              Configure ELCAMOSO before you start moving.
            </strong>{" "}
            Choose your sound and drive mode while the vehicle is stationary. The app is designed to
            be set once, then left alone during the drive.
          </p>
          <p>
            Open{" "}
            <Link to="/drive" className="text-foreground underline underline-offset-4">
              elcamoso.com/drive
            </Link>{" "}
            in your car's browser (Tesla, Rivian, or any EV with a web browser) or on your phone.
          </p>
          <p>
            On your first visit, the app asks you to acknowledge that ELCAMOSO responds to motion
            and that you should keep your attention on the road. This safety prompt appears once.
          </p>
        </Section>

        <Section id="choose-sound" step="Step 2" title="Choose and preview your sound">
          <p>
            Tap the experience name on the Drive screen to open the sound picker. You can browse:
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong className="font-medium text-foreground">Engine</strong> — combustion character
              locked to motion (V8s, V10s, turbos, motorcycles, and more)
            </li>
            <li>
              <strong className="font-medium text-foreground">Symphony</strong> — music genres
              shaped by how you drive (Latino Fiesta, Jazz Cruise, Piano Flow, and others)
            </li>
            <li>
              <strong className="font-medium text-foreground">Worlds</strong> — atmospheric
              soundscapes (Space Drive, Cyber City, Storm Run)
            </li>
            <li>
              <strong className="font-medium text-foreground">Fusion</strong> — engine and music
              blended together
            </li>
          </ul>
          <p className="font-medium text-foreground">Availability by plan</p>
          <p>
            <strong className="font-medium text-foreground">Free</strong> includes Racing V10,
            American Muscle V8, Dracula Carriage, and Latino Fiesta.{" "}
            <strong className="font-medium text-foreground">Drive+</strong> unlocks all engine
            profiles and Worlds.{" "}
            <strong className="font-medium text-foreground">Drive the Music</strong> unlocks all
            Symphony genres and Fusion. Tap a locked sound to see which plan includes it.
          </p>
          <p>
            You can preview any sound before starting a drive. Tap the play button next to a sound
            to hear a short demo.
          </p>
        </Section>

        <Section id="live-sound" step="Step 3a" title="Live sound mode">
          <p>
            <strong className="font-medium text-foreground">Live sound</strong> plays audio in real
            time as you drive. The sound responds to your speed, acceleration, and regenerative
            braking.
          </p>
          <ol className="ml-4 list-decimal space-y-2">
            <li>Select your sound from the picker.</li>
            <li>
              Under "Choose drive mode," ensure <strong>Live sound</strong> is selected.
            </li>
            <li>Tap the large circular Start button.</li>
            <li>The app will request location permission to read your speed.</li>
            <li>Drive. Sound responds to motion in real time.</li>
            <li>When finished, park and tap Stop.</li>
          </ol>
          <p>
            No route is stored—only motion data is used. Live sound does not record a journey for
            later playback. If you want to replay your drive as a song afterward, use Silent Capture
            instead.
          </p>
        </Section>

        <Section id="silent-capture" step="Step 3b" title="Silent Capture mode">
          <p>
            <strong className="font-medium text-foreground">Silent Capture</strong> records how the
            journey moved without playing audio in the cabin. When you stop, the motion becomes a
            song in the genre you chose.
          </p>
          <p className="font-medium text-foreground">Choose your genre before starting</p>
          <ol className="ml-4 list-decimal space-y-2">
            <li>On the Drive screen, tap "Silent Capture" under drive mode.</li>
            <li>
              A genre picker appears. Choose the style you want your song in (Latino Fiesta, Piano
              Flow, Jazz Cruise, etc.).
            </li>
            <li>Tap the circular Start button to begin capturing.</li>
            <li>
              Drive normally. The screen shows elapsed time and distance. No audio plays in the
              cabin.
            </li>
            <li>When you arrive, park and tap Stop.</li>
          </ol>
          <p>
            After stopping, your journey is ready to hear. You can also change the genre afterward
            to hear the same drive in a different style.
          </p>
          <p>
            <strong className="font-medium text-foreground">Note:</strong> Silent Capture is a
            dedicated mode. It does not run automatically during normal Live sound drives.
          </p>
        </Section>

        <Section id="phone-pairing" step="Optional" title="Phone sensor pairing">
          <p>
            Phone pairing connects your phone's motion sensors to the car browser session. This can
            provide richer motion data than GPS alone, especially for detecting acceleration and
            braking.
          </p>
          <p className="font-medium text-foreground">How to pair</p>
          <ol className="ml-4 list-decimal space-y-2">
            <li>
              Open{" "}
              <Link to="/drive" className="text-foreground underline underline-offset-4">
                elcamoso.com/drive
              </Link>{" "}
              on the car browser.
            </li>
            <li>Scroll to the "Phone + car" panel and scan the QR code with your phone.</li>
            <li>
              Your phone may ask for motion and location permissions. Grant them to enable sensor
              data.
            </li>
            <li>
              Once linked, motion data flows from your phone to the car. Sound plays on the car
              browser.
            </li>
          </ol>
          <p>
            Phone pairing is optional—ELCAMOSO works with GPS-only motion. Pairing adds motion
            detail but{" "}
            <strong className="font-medium text-foreground">
              does not enable background playback or recording
            </strong>
            . The car browser must stay visible for audio to play.
          </p>
        </Section>

        <Section id="before-departure" step="Step 4" title="Before you depart">
          <p>Complete these checks while still parked:</p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong className="font-medium text-foreground">Volume</strong> — Adjust the car's
              media volume to a comfortable level. ELCAMOSO plays through the browser audio channel.
            </li>
            <li>
              <strong className="font-medium text-foreground">Connection</strong> — If using phone
              pairing, confirm the "Connected" indicator appears on the Drive screen.
            </li>
            <li>
              <strong className="font-medium text-foreground">Browser visibility</strong> — Keep the
              browser tab open and visible during the drive. On Tesla and most in-car browsers,{" "}
              <strong className="font-medium text-foreground">
                minimizing or navigating away stops audio playback
              </strong>
              . Background playback is not supported.
            </li>
          </ul>
          <p>Once set, you're ready. Start the drive and let motion shape the sound.</p>
        </Section>

        <Section id="after-drive" step="Step 5" title="After the drive">
          <p className="font-medium text-foreground">For Live sound drives</p>
          <p>
            Park and tap Stop. A summary card may appear showing your drive stats and earned Smiles.
            Live drives do not generate a replayable song unless you used Silent Capture.
          </p>
          <p className="font-medium text-foreground">For Silent Capture drives</p>
          <p>
            After tapping Stop, you'll see your captured journey ready to play. The screen shows:
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong className="font-medium text-foreground">Song player</strong> — Tap play to
              hear your drive rendered in the selected genre.
            </li>
            <li>
              <strong className="font-medium text-foreground">Drive chart</strong> — A visual
              representation of how motion shaped the music (speed, acceleration, intensity over
              time).
            </li>
            <li>
              <strong className="font-medium text-foreground">Genre selector</strong> — Change the
              genre to hear the same journey in a different style.
            </li>
          </ul>
          <p>
            If the capture was interrupted (browser paused), you'll see a notice explaining any
            gaps. You can still play the captured portions.
          </p>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <div className="space-y-6">
            <div>
              <p className="font-medium text-foreground">No sound plays</p>
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>Check the car's media volume is not muted.</li>
                <li>Ensure the browser tab is visible, not minimized.</li>
                <li>
                  Confirm location permission was granted (the app needs GPS to detect motion).
                </li>
                <li>Try a short movement—sound responds to detected motion, not just time.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Phone pairing not working</p>
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>Scan the QR code again from the Drive screen on the car.</li>
                <li>Grant motion and location permissions when your phone prompts.</li>
                <li>
                  Ensure both devices are online (phone pairing uses a network connection, not
                  Bluetooth).
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Sound or capture interrupted</p>
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>
                  The browser was likely minimized or lost focus. On Tesla and most car browsers,
                  audio and capture pause when the browser is not visible.
                </li>
                <li>
                  Return to the browser tab to resume. For Silent Capture, the app will note any
                  gaps when you finish.
                </li>
                <li>Keep the browser visible throughout the drive for uninterrupted playback.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">App says "No motion yet"</p>
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>The app is waiting for GPS data. Move the vehicle slightly.</li>
                <li>If indoors or in a parking garage, GPS signal may be weak.</li>
                <li>You can also try the Demo Drive to test without vehicle motion.</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="safety" title="Safety">
          <p>
            <strong className="font-medium text-foreground">
              ELCAMOSO is not a vehicle control or navigation system.
            </strong>{" "}
            It creates sound from motion data only—it cannot steer, brake, or affect how your car
            drives.
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong className="font-medium text-foreground">Set up while parked.</strong> Choose
              your sound and settings before you start moving.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Do not interact with the screen while driving.
              </strong>{" "}
              Let a passenger adjust settings if needed, or wait until you stop.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Park before tapping Stop or changing settings.
              </strong>{" "}
              End your session only when the vehicle is stationary.
            </li>
            <li>
              <strong className="font-medium text-foreground">Drive attentively.</strong> Obey local
              traffic laws and keep your attention on the road at all times.
            </li>
          </ul>
        </Section>

        <section className="border-t border-border/60 pt-12">
          <h2 className="text-xl font-light">Ready to drive?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Choose your sound, pick your mode, and let motion shape the experience.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/drive"
              className="inline-flex h-12 items-center rounded-full bg-primary px-8 text-[11px] tracking-[0.22em] text-primary-foreground uppercase"
            >
              Open Drive
            </Link>
            <Link
              to="/sounds"
              className="inline-flex h-12 items-center rounded-full border border-border px-8 text-[11px] tracking-[0.22em] uppercase hover:bg-secondary"
            >
              Browse sounds
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
