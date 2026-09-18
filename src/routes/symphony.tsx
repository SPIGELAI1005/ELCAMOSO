import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ExperienceCardList } from "@/components/experiences/ExperienceCardList";
import { MotionIntentDiagram } from "@/components/experiences/MotionIntentDiagram";
import { listSymphonyExperiences } from "@/lib/experiences";
import { useSettings } from "@/lib/drive/useSettings";
import { getSession } from "@/lib/drive/session";
import { demoStateAt, demoStepLabel, demoTotalDurationSec, type StemId } from "@/lib/symphony";
import {
  SYMPHONY_LOAD_FAILURE_COPY,
  loadSymphonyPackBuffers,
  type PackLoadProgress,
} from "@/lib/symphony/pack-loader";
import { cn } from "@/lib/utils";

const STEM_LABELS: { id: StemId; label: string }[] = [
  { id: "drumsHigh", label: "Drums" },
  { id: "bass", label: "Bass" },
  { id: "rhythm", label: "Guitar" },
  { id: "strings", label: "Strings" },
  { id: "lead", label: "Lead" },
];

export const Route = createFileRoute("/symphony")({
  component: SymphonyPage,
  head: () => createSeoHeadFromPath("/symphony"),
});

function SymphonyPage() {
  const { settings, update } = useSettings();
  const items = listSymphonyExperiences();
  const [listening, setListening] = useState(false);
  const [energy, setEnergy] = useState(0);
  const [movement, setMovement] = useState("stopped");
  const [stemOn, setStemOn] = useState<Record<string, boolean>>({});
  const [demoLabel, setDemoLabel] = useState("");
  const [loadProgress, setLoadProgress] = useState<PackLoadProgress | null>(null);
  const [musicFailed, setMusicFailed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      getSession().setAuditionDriveOverride(null);
    };
  }, []);

  const preloadPack = async (packId: string) => {
    setMusicFailed(false);
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const result = await loadSymphonyPackBuffers(ctx, packId, {
        onProgress: setLoadProgress,
      });
      if (result.buffers.size === 0) {
        setMusicFailed(true);
        return false;
      }
      if (result.degraded && result.errors.some((e) => !e.includes("procedural"))) {
        // WAV missing → procedural still ok; only hard-fail when empty
      }
      return true;
    } catch {
      setMusicFailed(true);
      return false;
    } finally {
      void ctx.close();
    }
  };

  const startDemo = async () => {
    const packId = settings.profileId.startsWith("symphony-")
      ? settings.profileId
      : "symphony-cinematic-rock";
    update({ profileId: packId });
    const ok = await preloadPack(packId);
    if (!ok) return;
    getSession().primeAudioFromUserGesture();
    await getSession().listenProfile(packId, 40);
    setListening(true);
    const start = performance.now();
    timer.current = window.setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > demoTotalDurationSec()) {
        stopDemo();
        return;
      }
      const st = demoStateAt(elapsed);
      getSession().setAuditionDriveOverride(st);
      setDemoLabel(demoStepLabel(elapsed));
      const e = Math.min(1, st.load * 0.55 + st.throttle * 0.5 + st.speedNormalized * 0.25);
      setEnergy(e);
      setMovement(
        st.speed < 1
          ? "stopped"
          : st.regen > 0.4
            ? "decelerating"
            : st.throttle > 0.75
              ? "energetic"
              : "cruise",
      );
      setStemOn({
        drumsHigh: e > 0.35,
        bass: e > 0.2,
        rhythm: e > 0.28,
        strings: e > 0.45,
        lead: e > 0.7,
      });
    }, 100);
  };

  const stopDemo = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setListening(false);
    getSession().setAuditionDriveOverride(null);
    getSession().stop();
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
      <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
        Drive Symphony
      </p>
      <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
        Your driving becomes the arrangement.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Not music playing over the drive. Music shaped by the drive.
      </p>

      <section className="mt-14 border border-border/70 bg-surface-1/20 px-6 py-10">
        <p className="text-center text-sm text-muted-foreground">
          Watch your drive become an arrangement.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          {!listening ? (
            <button
              type="button"
              onClick={() => void startDemo()}
              className="h-12 rounded-full bg-primary px-8 text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
            >
              Listen - Demo
            </button>
          ) : (
            <button
              type="button"
              onClick={stopDemo}
              className="h-12 rounded-full border border-foreground px-8 text-[10px] tracking-[0.22em] uppercase"
            >
              Stop
            </button>
          )}
        </div>

        {loadProgress?.phase === "loading" ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Loading music… {loadProgress.loaded}/{loadProgress.total}
          </p>
        ) : null}

        {musicFailed ? (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-base text-muted-foreground">{SYMPHONY_LOAD_FAILURE_COPY}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void startDemo()}
                className="h-11 rounded-full border border-border px-6 text-[10px] tracking-[0.2em] uppercase"
              >
                Retry
              </button>
              <Link
                to="/explore"
                className="inline-flex h-11 items-center rounded-full border border-border px-6 text-[10px] tracking-[0.2em] uppercase"
              >
                Switch Experience
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Drive itself continues with Engine sound.
            </p>
          </div>
        ) : null}

        {listening ? (
          <div className="mt-10 space-y-8">
            <div>
              <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                Drive energy
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full bg-foreground transition-[width] duration-200"
                  style={{ width: `${Math.round(energy * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {demoLabel} · {movement}
              </p>
            </div>
            <ul className="space-y-3">
              {STEM_LABELS.map((stem) => {
                const on = Boolean(stemOn[stem.id]);
                return (
                  <li
                    key={stem.id}
                    className="flex items-center justify-between text-sm tracking-[0.2em] uppercase"
                  >
                    <span className={cn(on ? "text-foreground" : "text-muted-foreground/50")}>
                      {stem.label}
                    </span>
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full transition-opacity",
                        on ? "bg-foreground opacity-100" : "bg-border opacity-40",
                      )}
                      aria-hidden
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mt-10">
            <MotionIntentDiagram />
          </div>
        )}
      </section>

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
            if (item.capabilities.profileId) update({ profileId: item.capabilities.profileId });
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
