import { createFileRoute, Link } from "@tanstack/react-router";
import { LandingHero } from "@/components/LandingHero";
import { LandingPlansSection } from "@/components/LandingPlansSection";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfile } from "@/lib/sound/profiles";

const CURATED = ["gt-v8", "racing-v10", "cyber-pulse", "zen-drive"] as const;

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "ELCAMOSO · Your EV. Your Sound." },
      {
        name: "description",
        content: "Motion-responsive sound experiences for electric cars.",
      },
      { property: "og:title", content: "ELCAMOSO · Your EV. Your Sound." },
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
  const { update } = useSettings();
  const curated = CURATED.map((id) => getProfile(id));

  const playCurated = (id: string) => {
    update({ profileId: id });
    void getSession().listenProfile(id, 70);
  };

  return (
    <main className="min-h-screen">
      <LandingHero />

      <section className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-12">
        <h2 className="text-3xl font-light">Choose how motion feels.</h2>
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {curated.map((profile) => (
            <li key={profile.id} className="flex items-center justify-between gap-4 py-7">
              <div className="min-w-0 text-left">
                <p className="text-xl font-light">{profile.name}</p>
                <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  {profile.traits.join(" · ")}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Preview ${profile.name}`}
                onClick={() => playCurated(profile.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-sm hover:bg-secondary"
              >
                ▶
              </button>
            </li>
          ))}
        </ul>
        <Link
          to="/sounds"
          className="mt-8 inline-block text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Browse all sounds
        </Link>
      </section>

      <LandingPlansSection />

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
