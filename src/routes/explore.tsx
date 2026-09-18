import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ExperienceFamilyGrid } from "@/components/experiences/ExperienceFamilyGrid";
import { DrivingInteractionGate } from "@/components/DrivingInteractionGate";
import { EXPERIENCE_FAMILIES, experienceForProfileId } from "@/lib/experiences";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfile } from "@/lib/sound/profiles";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
  head: () => createSeoHeadFromPath("/explore"),
});

function ExplorePage() {
  const { settings } = useSettings();
  const active = experienceForProfileId(settings.profileId);
  const favourites = settings.favourites.slice(0, 6).map((id) => getProfile(id));

  return (
    <DrivingInteractionGate surface="explore">
      <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pt-8 pb-24 sm:px-10">
        <header className="max-w-2xl">
          <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">Explore</p>
          <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
            Choose what motion becomes.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">Machine. Music. Another world.</p>
        </header>

        <section className="mt-14" aria-label="Experience families">
          <ExperienceFamilyGrid families={EXPERIENCE_FAMILIES} large />
        </section>

        <section className="mt-20 grid gap-12 sm:grid-cols-3">
          <div>
            <h2 className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Recent
            </h2>
            <p className="mt-4 text-xl font-light">{active.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">{active.tagline}</p>
            <Link
              to="/drive"
              className="mt-4 inline-block text-[10px] tracking-[0.22em] uppercase hover:text-foreground"
            >
              Continue in Drive
            </Link>
          </div>
          <div>
            <h2 className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Favorites
            </h2>
            {favourites.length ? (
              <ul className="mt-4 space-y-3">
                {favourites.map((p) => (
                  <li key={p.id} className="text-sm font-light">
                    {p.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Star sounds in Garage - they appear here.
              </p>
            )}
          </div>
          <div>
            <h2 className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              For you
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Start with an Engine you know, then hear the same motion as Symphony, World, or
              Fusion.
            </p>
            <Link
              to="/sounds"
              className="mt-4 inline-block text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
            >
              Browse engines
            </Link>
          </div>
        </section>
      </main>
    </DrivingInteractionGate>
  );
}
