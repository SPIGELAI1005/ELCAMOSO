import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ExperienceCardList } from "@/components/experiences/ExperienceCardList";
import { MotionIntentDiagram } from "@/components/experiences/MotionIntentDiagram";
import { SymphonyHeroBackdrop } from "@/components/SymphonyHeroBackdrop";
import { MusicGenrePicker } from "@/components/experiences/MusicGenrePicker";
import { LockedSoundNotice } from "@/components/premium/LockedSoundNotice";
import { CarPhonePairPanel } from "@/components/phone-sync/CarPhonePairPanel";
import { listSymphonyExperiences } from "@/lib/experiences";
import { useSettings } from "@/lib/drive/useSettings";

export const Route = createFileRoute("/symphony")({
  component: SymphonyPage,
  head: () => createSeoHeadFromPath("/symphony"),
});

function SymphonyPage() {
  const { settings, update } = useSettings();
  const items = listSymphonyExperiences();
  const navigate = useNavigate();
  const driveWithMusic = (profileId?: string) => {
    const current = settings.profileId ?? "";
    const next =
      profileId ?? (current.startsWith("symphony-") ? current : "symphony-motion-orchestra");
    update({ profileId: next });
    void navigate({ to: "/drive" });
  };
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
      <div className="relative isolate -mx-6 overflow-hidden px-6 pt-10 pb-16 sm:-mx-10 sm:px-10 sm:pt-16 sm:pb-24">
        <SymphonyHeroBackdrop />
        <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
          Drive Symphony
        </p>
        <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
          Your driving becomes the arrangement.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Not music playing over the drive. Music shaped by the drive.
        </p>
      </div>

      <section className="mt-14 border border-border/70 bg-surface-1/20 px-6 py-10">
        <p className="text-center text-sm text-muted-foreground">
          Watch your drive become an arrangement.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("music-genre-picker")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="h-12 rounded-full border border-white bg-white px-8 text-[10px] tracking-[0.22em] text-black uppercase hover:bg-white/90"
          >
            Select Music Genre
          </button>
        </div>

        <div className="mt-10">
          <MotionIntentDiagram />
        </div>
      </section>

      <LockedSoundNotice className="mt-12" />
      <div id="music-genre-picker" className="scroll-mt-20">
        <MusicGenrePicker
          className="mt-12"
          onPick={() => driveWithMusic()}
          onStart={() => driveWithMusic()}
        />
      </div>

      <CarPhonePairPanel className="mt-8" />

      <section className="mt-16">
        <h2 className="text-2xl font-light">Experiences</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cinematic Rock and Motion Orchestra run on the Drive Symphony engine. Production packs
          play only after every stem passes provenance, alignment, and level checks.
        </p>
        <ExperienceCardList
          className="mt-8"
          items={items}
          onSelect={(item) => {
            if (item.capabilities.profileId) driveWithMusic(item.capabilities.profileId);
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
