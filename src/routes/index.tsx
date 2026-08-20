import { createFileRoute, Link } from "@tanstack/react-router";
import { ElcamosoMark, ElcamosoWordmark } from "@/components/ElcamosoLogo";
import { SOUND_PROFILES } from "@/lib/sound/profiles";

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
  return (
    <main className="min-h-screen">
      <section className="flex min-h-screen flex-col justify-between px-6 py-10 sm:px-12">
        <div className="flex items-center justify-end gap-6 text-xs tracking-[0.18em] uppercase">
          <Link to="/sounds" className="text-muted-foreground hover:text-foreground">
            Sounds
          </Link>
          <Link to="/settings" className="text-muted-foreground hover:text-foreground">
            Settings
          </Link>
        </div>

        <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-16 py-16 lg:grid-cols-2 lg:gap-24">
          <div className="flex flex-col items-center gap-8 lg:items-start">
            <ElcamosoMark animate className="h-16 w-auto sm:h-20" />
            <ElcamosoWordmark className="text-lg sm:text-xl" />
          </div>

          <div className="flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
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
              Turn motion into an experience.
            </p>
            <Link
              to="/drive"
              className="animate-rise inline-flex h-14 items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
              style={{ animationDelay: "300ms" }}
            >
              Start Drive
            </Link>
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
              Electric Car Motion Sound
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
          Works with your EV
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-32 sm:px-12">
        <h2 className="mb-14 text-xs tracking-[0.28em] text-muted-foreground uppercase">
          Choose your sound
        </h2>
        <div className="grid gap-px overflow-hidden border-y border-border sm:grid-cols-3">
          {SOUND_PROFILES.map((profile) => (
            <div key={profile.id} className="py-12 sm:px-8 sm:first:pl-0 sm:last:pr-0">
              <p className="text-2xl font-light">{profile.name}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                {profile.traits.join(" · ")}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-20 max-w-md">
          <p className="text-lg font-light">Your drive stays yours.</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Speed and motion data are processed directly on this device. ELCAMOSO does not
            upload your driving route in this MVP.
          </p>
        </div>
      </section>
    </main>
  );
}
