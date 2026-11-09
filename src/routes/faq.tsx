import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  component: Faq,
  head: () => createSeoHeadFromPath("/faq"),
});

interface FaqEntry {
  id: string;
  question: string;
  answer: React.ReactNode;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "what-is-elcamoso",
    question: "What is ELCAMOSO?",
    answer: (
      <>
        <p>
          ELCAMOSO is a web app that turns the motion of your vehicle into sound. It responds to
          speed, acceleration, and braking to create engine sounds, music, or atmospheric
          soundscapes in real time.
        </p>
        <p className="mt-3">
          ELCAMOSO is optional entertainment—a way to personalise your driving experience with
          motion-responsive audio. It is not a vehicle safety system, navigation aid, or essential
          driving feature.
        </p>
      </>
    ),
  },
  {
    id: "who-is-it-for",
    question: "Who is ELCAMOSO for?",
    answer: (
      <>
        <p>
          ELCAMOSO is for anyone who wants motion-responsive sound while driving. It runs in
          compatible in-car or phone browsers, subject to permissions and browser support.
        </p>
        <p className="mt-3">
          Electric vehicles, petrol-engine cars, hybrids, and older vehicles can all use ELCAMOSO if
          you have a compatible browser—either built into the car or on a mounted phone.
        </p>
      </>
    ),
  },
  {
    id: "phone-browser-bluetooth",
    question: "Can I play ELCAMOSO from my phone through the car speakers?",
    answer: (
      <>
        <p>
          Yes. Open elcamoso.com/drive in your phone's browser and connect the phone to your car's
          audio system via Bluetooth (or a cable). The sound plays through the car speakers while
          motion data comes from your phone.
        </p>
        <p className="mt-3 font-medium text-foreground">Important caveats:</p>
        <ul className="mt-2 ml-4 list-disc space-y-2">
          <li>
            <strong className="font-medium text-foreground">Device and browser vary.</strong>{" "}
            Background behaviour, permissions, and audio routing depend on your phone model,
            operating system, and browser. ELCAMOSO cannot guarantee universal compatibility.
          </li>
          <li>
            <strong className="font-medium text-foreground">Permissions.</strong> The browser may
            request location or motion permissions to detect your driving. Grant them when prompted.
          </li>
          <li>
            <strong className="font-medium text-foreground">Keep the browser visible.</strong>{" "}
            Minimising the browser or switching apps may pause audio or stop motion detection on
            some devices.
          </li>
          <li>
            <strong className="font-medium text-foreground">Bluetooth audio.</strong> Bluetooth
            connections may add audio delay or compression depending on your device and codec.
          </li>
        </ul>
        <p className="mt-3">
          Bluetooth audio transmits playback only. It does not by itself grant ELCAMOSO access to
          vehicle controls.
        </p>
      </>
    ),
  },
  {
    id: "live-vs-silent",
    question: "What is the difference between Live sound and Silent Capture?",
    answer: (
      <>
        <p>
          <strong className="font-medium text-foreground">Live sound</strong> plays audio in the
          cabin while you drive. The sound responds to your motion in real time—accelerate and the
          engine revs, cruise and the music flows.
        </p>
        <p className="mt-3">
          <strong className="font-medium text-foreground">Silent Capture</strong> records only how
          the journey moved, without playing any audio during the drive. When you arrive and stop,
          you can hear the journey rendered as a song in the genre you chose.
        </p>
        <p className="mt-3">
          Silent Capture is a deliberate choice you make before starting. It does not run
          automatically during Live sound drives.
        </p>
        <p className="mt-3">
          For full setup steps, see the{" "}
          <Link to="/instructions" className="text-foreground underline underline-offset-4">
            Instructions
          </Link>{" "}
          page.
        </p>
      </>
    ),
  },
  {
    id: "phone-pairing-vs-bluetooth",
    question: "What is phone sensor pairing? Is it the same as Bluetooth audio?",
    answer: (
      <>
        <p>
          <strong className="font-medium text-foreground">Phone sensor pairing</strong> connects
          your phone's motion sensors to an ELCAMOSO session running in your car's browser. Motion
          data flows from the phone to the car over the network—sound plays on the car browser.
        </p>
        <p className="mt-3">
          <strong className="font-medium text-foreground">Bluetooth audio</strong> is a separate
          transport for playing sound from your phone through the car's speakers. It carries audio,
          not motion data.
        </p>
        <p className="mt-3">
          These are independent features. You can use phone sensor pairing without Bluetooth audio
          (sound plays on the car browser). You can use Bluetooth audio without sensor pairing. Or
          you can run ELCAMOSO entirely in the car's browser.
        </p>
      </>
    ),
  },
  {
    id: "browser-collapse",
    question: "What happens if I minimise or collapse the browser?",
    answer: (
      <>
        <p>
          In our in-car test, collapsing the browser stopped playback. Other browsers and devices
          may vary.
        </p>
        <p className="mt-3">
          Keep the app visible. Background playback and motion capture are not guaranteed. Sensor
          pairing is not a confirmed remedy.
        </p>
      </>
    ),
  },
  {
    id: "free-access",
    question: "What can I use for free?",
    answer: (
      <>
        <p>
          Free access and promotional offers change over time. See the{" "}
          <Link to="/pricing" className="text-foreground underline underline-offset-4">
            Pricing
          </Link>{" "}
          page for current plans, free experiences, and availability.
        </p>
        <p className="mt-3">
          Until 27 November 2026 23:59 Europe/Berlin (Black Friday Special), Start Drive on the home
          page opens Midnight Dark Rave. Visitors without an account can play it for 15 minutes a
          day (Berlin). Sign in to keep driving Midnight Dark Rave with no daily limit until the end
          of Black Friday, and to use other Drive the Music sounds for 30 minutes a day. After the
          offer, Start Drive falls back to Racing V10. Logged-out visitors also keep the separate
          7-minute guest trial on a small set of sounds.
        </p>
      </>
    ),
  },
  {
    id: "packages",
    question: "What are Drive+, Drive the Music, and Lifetime?",
    answer: (
      <>
        <p>
          <strong className="font-medium text-foreground">Drive+</strong> unlocks every Engine sound
          profile and all World experiences.
        </p>
        <p className="mt-3">
          <strong className="font-medium text-foreground">Drive the Music</strong> unlocks every
          Symphony music genre and Fusion (engine meets music).
        </p>
        <p className="mt-3">
          <strong className="font-medium text-foreground">Drive Unlimited</strong> combines both
          packages in a single subscription.
        </p>
        <p className="mt-3">
          <strong className="font-medium text-foreground">Lifetime</strong> is a one-time payment
          for Drive+ and Drive the Music together, with no recurring subscription.
        </p>
        <p className="mt-3">
          For current pricing, see the{" "}
          <Link to="/pricing" className="text-foreground underline underline-offset-4">
            Pricing
          </Link>{" "}
          page.
        </p>
      </>
    ),
  },
  {
    id: "founders-pack",
    question: "What is the Founders Pack?",
    answer: (
      <>
        <p>
          The Founders Pack is a yearly Drive+ or yearly Drive the Music subscription until Black
          Friday, 27.11.2026 23:59 Berlin. You get the package you buy, Drive Unlimited for 4 months
          from purchase (then that package), and 4 sounds you choose that stay yours forever.
          Founders can join the Founders Test Crew.
        </p>
        <p className="mt-3">
          Buying yearly Drive+ or Drive the Music in that window makes you a Founder. The Black
          Friday Special does not grant a free Founder seat. Existing Founders who signed in before
          9 November 2026 23:59 Europe/Berlin keep Racing V10, American Muscle V8 and GT V8 forever
          and Drive Unlimited until 27.05.2027 23:59 Europe/Berlin. Founders also receive the Black
          Friday Special while that offer runs; Drive Unlimited already includes Drive the Music
          without the 30-minute cap.
        </p>
      </>
    ),
  },
  {
    id: "safety-vehicle",
    question: "Is ELCAMOSO safe for my car?",
    answer: (
      <>
        <p>
          <strong className="font-medium text-foreground">ELCAMOSO runs as a website.</strong> It
          does not install vehicle firmware or change vehicle settings, and does not connect to
          steering, braking, or propulsion controls or vehicle diagnostic interfaces.
        </p>
        <p className="mt-3">
          Bluetooth audio transmits playback only and does not by itself grant ELCAMOSO access to
          vehicle controls.
        </p>
        <p className="mt-3 font-medium text-foreground">Driver responsibility</p>
        <p className="mt-2">
          Set up ELCAMOSO while parked. Choose your sound and adjust volume before you start moving.
          Do not interact with the screen while driving—let a passenger change settings if needed,
          or wait until you stop.
        </p>
        <p className="mt-3">
          ELCAMOSO is not a vehicle control or navigation system. It creates sound from motion data
          only. Drive attentively and obey local traffic laws.
        </p>
        <p className="mt-3">
          For more technical detail, see the{" "}
          <Link
            to="/science"
            hash="safety"
            className="text-foreground underline underline-offset-4"
          >
            Safety & Security
          </Link>{" "}
          section of the Science page.
        </p>
      </>
    ),
  },
  {
    id: "troubleshooting",
    question: "Where can I find setup help and troubleshooting?",
    answer: (
      <>
        <p>
          The{" "}
          <Link to="/instructions" className="text-foreground underline underline-offset-4">
            Instructions
          </Link>{" "}
          page has step-by-step setup guidance for Live sound, Silent Capture, phone pairing, and
          common troubleshooting tips.
        </p>
        <p className="mt-3">
          For questions or issues not covered there, contact{" "}
          <a
            href="mailto:support@elcamoso.com"
            className="text-foreground underline underline-offset-4"
          >
            support@elcamoso.com
          </a>
          .
        </p>
      </>
    ),
  },
];

function Faq() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-12 sm:py-24">
      <div className="flex items-center gap-4">
        <ElcamosoMark className="h-10 w-auto shrink-0" />
        <div>
          <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
            Questions & Answers
          </p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">
            Frequently Asked Questions
          </h1>
        </div>
      </div>

      <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
        Common questions about ELCAMOSO, how it works, compatibility, and plans.
      </p>

      <Accordion type="multiple" className="mt-12 w-full" defaultValue={[]}>
        {FAQ_ENTRIES.map((entry) => (
          <AccordionItem key={entry.id} value={entry.id} className="border-border/60">
            <AccordionTrigger className="text-base font-light text-foreground hover:no-underline">
              {entry.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {entry.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="mt-16 border-t border-border/60 pt-12">
        <h2 className="text-xl font-light">Still have questions?</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Check the detailed{" "}
          <Link to="/instructions" className="text-foreground underline underline-offset-4">
            Instructions
          </Link>{" "}
          or contact{" "}
          <a
            href="mailto:support@elcamoso.com"
            className="text-foreground underline underline-offset-4"
          >
            support@elcamoso.com
          </a>
          .
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
    </main>
  );
}
