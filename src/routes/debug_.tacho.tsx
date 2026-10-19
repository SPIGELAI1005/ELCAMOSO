import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ModeTachometer } from "@/components/drive/ModeTachometer";
import { TACH_THEMES, type TachThemeId } from "@/lib/drive/tach-theme";

/** Dev-only gallery of cockpit tachometer designs (not linked, noindex). */
export const Route = createFileRoute("/debug_/tacho")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Tacho · Debug · ELCAMOSO" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: TachoGallery,
});

const IDS = Object.keys(TACH_THEMES) as TachThemeId[];

function TachoGallery() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const only = params.get("theme") as TachThemeId | null;
  const p = Number(params.get("p") ?? "0.62");
  const [replay, setReplay] = useState(0);
  const ids = only && TACH_THEMES[only] ? [only] : IDS;
  return (
    <main
      className="min-h-screen bg-background p-8 text-foreground"
      onClick={() => setReplay((n) => n + 1)}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-16">
        {ids.map((id) => (
          <section
            key={id}
            data-testid={`tach-${id}`}
            className="flex flex-col items-center gap-10 p-10"
          >
            <div className="relative aspect-square w-[260px]">
              <ModeTachometer
                themeId={id}
                introKey={`${id}:${replay}`}
                progress={p}
                reducedMotion={false}
                redlineRpm={
                  id === "rail" ||
                  id === "nautical" ||
                  id === "aviation" ||
                  id === "warp" ||
                  id === "rocket" ||
                  id === "stage"
                    ? null
                    : 8500
                }
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-5xl font-extralight tabular-nums">{Math.round(p * 180)}</p>
                <p className="mt-1.5 text-[11px] tracking-[0.34em] text-muted-foreground uppercase">
                  {id === "nautical" || id === "aviation"
                    ? "kn"
                    : id === "warp"
                      ? "c · warp"
                      : "km/h"}
                </p>
              </div>
            </div>
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
              {TACH_THEMES[id].label}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
