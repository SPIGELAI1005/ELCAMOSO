import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ExperienceCardList } from "@/components/experiences/ExperienceCardList";
import { WorldMotionDiagram } from "@/components/experiences/WorldMotionDiagram";
import { SymphonyHeroBackdrop } from "@/components/SymphonyHeroBackdrop";
import { listWorldPageExperiences, listWorldPageHeroIds } from "@/lib/experiences";
import { useSettings } from "@/lib/drive/useSettings";

export const Route = createFileRoute("/worlds")({
  component: WorldsPage,
  head: () => createSeoHeadFromPath("/worlds"),
});

function WorldsPage() {
  const { settings, update } = useSettings();
  const worlds = listWorldPageExperiences();
  const navigate = useNavigate();
  const driveWorld = (profileId?: string) => {
    const current = settings.profileId ?? "";
    const known = worlds.some((item) => item.capabilities.profileId === current);
    const next = profileId ?? (known ? current : "world-space-drive");
    update({ profileId: next });
    void navigate({ to: "/drive" });
  };
  const cards = worlds.map((item) => ({ ...item, entitlement: "drive_plus" as const }));

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
      <div className="relative isolate -mx-6 overflow-hidden px-6 pt-10 pb-16 sm:-mx-10 sm:px-10 sm:pt-16 sm:pb-24">
        <SymphonyHeroBackdrop profileIds={listWorldPageHeroIds()} />
        <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">Worlds</p>
        <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">Enter another world.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Impossible places shaped by motion.
        </p>
      </div>

      <section className="mt-14 border border-border/70 bg-surface-1/20 px-6 py-10">
        <p className="text-center text-sm text-muted-foreground">
          Motion wakes the world, not a looping backdrop.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("world-list")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="h-12 rounded-full border border-white bg-white px-8 text-[10px] tracking-[0.22em] text-black uppercase hover:bg-white/90"
          >
            Choose a world
          </button>
        </div>
        <div className="mt-10">
          <WorldMotionDiagram />
        </div>
      </section>

      <section id="world-list" className="mt-16 scroll-mt-20">
        <h2 className="text-2xl font-light">Experiences</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Space Drive, Cyber City, Storm Run and Ocean, then Retro Arcade, Synthwave Drive, Deep Bass
          Pulse, Heartbeat, Bollywood Rickshaw, Dracula Carriage, Road Anthem, Mechanical Symphony,
          Midnight Boost and Future Pulse.
        </p>
        <ExperienceCardList
          className="mt-8"
          items={cards}
          onSelect={(item) => {
            if (item.capabilities.profileId) driveWorld(item.capabilities.profileId);
          }}
        />
      </section>

      <p className="mt-12 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        <Link to="/explore" className="hover:text-foreground">
          Back to Explore
        </Link>
      </p>
    </main>
  );
}
