import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { listWorldExperiences } from "@/lib/experiences";
import { useSettings } from "@/lib/drive/useSettings";
import { getSession } from "@/lib/drive/session";
import { demoStateAt, demoTotalDurationSec } from "@/lib/symphony";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/worlds")({
  component: WorldsPage,
  head: () => createSeoHeadFromPath("/worlds"),
});

function WorldsPage() {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const worlds = listWorldExperiences();
  const [listeningId, setListeningId] = useState<string | null>(null);
  const [energy, setEnergy] = useState(0);
  const [worldState, setWorldState] = useState("idle");
  const [transition, setTransition] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      getSession().setAuditionDriveOverride(null);
    };
  }, []);

  const stopListen = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setListeningId(null);
    setTransition(false);
    getSession().setAuditionDriveOverride(null);
    void getSession().stop();
  };

  const startListen = async (profileId: string) => {
    stopListen();
    update({ profileId });
    setTransition(true);
    getSession().primeAudioFromUserGesture();
    await getSession().listenProfile(profileId, 30);
    setListeningId(profileId);
    const start = performance.now();
    timer.current = window.setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > 1.6) setTransition(false);
      if (elapsed > Math.min(32, demoTotalDurationSec())) {
        stopListen();
        return;
      }
      const st = demoStateAt(elapsed);
      getSession().setAuditionDriveOverride(st);
      const e = Math.min(1, st.load * 0.55 + st.throttle * 0.5 + st.speedNormalized * 0.25);
      setEnergy(e);
      setWorldState(
        st.speed < 1
          ? "idle"
          : st.regen > 0.4
            ? "regen"
            : st.throttle > 0.75
              ? "high_energy"
              : "motion",
      );
    }, 100);
  };

  const toggleFavourite = (id: string) => {
    const has = settings.experienceFavourites.includes(id);
    update({
      experienceFavourites: has
        ? settings.experienceFavourites.filter((x) => x !== id)
        : [...settings.experienceFavourites, id].slice(0, 80),
    });
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
      <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">Worlds</p>
      <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
        Drive somewhere impossible.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Reactive sonic fiction - motion wakes the world, not a looping backdrop.
      </p>

      {transition ? (
        <p className="mt-8 text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Entering world…
        </p>
      ) : null}

      <ul className="mt-14 divide-y divide-border border-y border-border">
        {worlds.map((item) => {
          const profileId = item.capabilities.profileId;
          const listening = listeningId === profileId;
          const starred = settings.experienceFavourites.includes(item.id);
          return (
            <li key={item.id} className="py-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xl font-light">{item.name}</p>
                  <p className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    {item.tagline}
                  </p>
                  <div
                    className={cn(
                      "mt-5 h-16 w-40 overflow-hidden border border-border/60",
                      listening && "animate-pulse",
                    )}
                    aria-hidden
                  >
                    <div
                      className="h-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
                      style={{
                        transform: `translateX(${listening ? energy * 40 : 8}%)`,
                        transition: "transform 200ms linear",
                      }}
                    />
                  </div>
                  {listening ? (
                    <p className="mt-3 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                      {worldState.replace("_", " ")} · energy {Math.round(energy * 100)}%
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {profileId && item.capabilities.selectableInDrive ? (
                    <>
                      <button
                        type="button"
                        onClick={() => (listening ? stopListen() : void startListen(profileId))}
                        className="h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.2em] uppercase hover:border-foreground"
                      >
                        {listening ? "Stop" : "Listen"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          update({ profileId });
                          void navigate({ to: "/drive" });
                        }}
                        className="h-10 rounded-full bg-primary px-4 text-[10px] tracking-[0.2em] text-primary-foreground uppercase"
                      >
                        Start Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavourite(item.id)}
                        className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
                      >
                        {starred ? "Saved" : "Save"}
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                      Coming next
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-12 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        <Link to="/explore" className="hover:text-foreground">
          Back to Explore
        </Link>
      </p>
    </main>
  );
}
