import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandNav } from "@/components/BrandNav";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { PROFILE_CATEGORIES, SOUND_PROFILES } from "@/lib/sound/profiles";
import { useSettings } from "@/lib/drive/useSettings";

export const Route = createFileRoute("/sounds")({
  component: Sounds,
  head: () => ({
    meta: [
      { title: "Sounds — ELCAMOSO" },
      {
        name: "description",
        content: "Choose a sound personality for your EV: GT V8, Racing V10 or Cyber Pulse.",
      },
      { property: "og:title", content: "Sounds — ELCAMOSO" },
      {
        property: "og:description",
        content: "Choose a sound personality for your EV: GT V8, Racing V10 or Cyber Pulse.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/sounds" },
    ],
    links: [{ rel: "canonical", href: "/sounds" }],
  }),
});

function Sounds() {
  const { settings, update } = useSettings();

  return (
    <main className="min-h-screen">
      <BrandNav />
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Choose your sound</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Each profile reads the same motion and interprets it differently.
        </p>

        {PROFILE_CATEGORIES.map((category) => {
          const items = SOUND_PROFILES.filter((p) => p.category === category);
          if (!items.length) return null;
          return (
            <section key={category} className="mt-16">
              <h2 className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
                {category}
              </h2>
              <div className="mt-6 divide-y divide-border border-y border-border">
                {items.map((profile) => {
                  const selected = settings.profileId === profile.id;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => update({ profileId: profile.id })}
                      className="flex w-full items-center gap-6 py-8 text-left transition-opacity hover:opacity-80"
                      aria-pressed={selected}
                    >
                      <ElcamosoMark
                        intensity={selected ? 1 : 0.34}
                        waveResponse={profile.voice.waveResponse}
                        className="h-6 w-auto shrink-0"
                      />
                      <span className="flex-1">
                        <span className="block text-xl font-light">{profile.name}</span>
                        <span className="mt-2 block text-xs tracking-[0.18em] text-muted-foreground uppercase">
                          {profile.traits.join(" • ")}
                        </span>
                        <span className="mt-3 block max-w-md text-sm text-muted-foreground">
                          {profile.description}
                        </span>
                      </span>
                      <span className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
                        {selected ? "Selected" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}


        <div className="mt-16 flex flex-wrap items-center gap-8">
          <Link
            to="/drive"
            className="inline-flex h-14 items-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase"
          >
            Start Drive
          </Link>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Studio &amp; Garage coming later
          </p>
        </div>
      </div>
    </main>
  );
}
