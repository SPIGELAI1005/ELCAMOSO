import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HALLOWEEN_ORANGE, HALLOWEEN_SOUNDS, HALLOWEEN_TAG, isHalloweenWindow } from "@/lib/halloween/halloween";
import { useTryProfile } from "@/lib/halloween/useTryProfile";

export const Route = createFileRoute("/news_/halloween")({
  component: HalloweenArticle,
  head: () => ({ meta: [{ title: "Halloween sounds · ELCAMOSO" }, { name: "robots", content: "noindex" }] }),
});

function HalloweenArticle() {
  const tryProfile = useTryProfile();
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(isHalloweenWindow()), []);

  if (!open) {
    return (
      <main className="mx-auto max-w-2xl px-6 pt-24 pb-28 text-center">
        <p className="text-sm text-muted-foreground">The Halloween special has ended.</p>
        <Link to="/news" className="mt-6 inline-block text-[11px] tracking-[0.2em] uppercase underline underline-offset-4">
          Back to news
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden" data-testid="halloween-article">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46vh]"
        style={{ background: `radial-gradient(ellipse at top, ${HALLOWEEN_ORANGE}22, transparent 65%)` }}
      />
      <article className="relative mx-auto w-full max-w-5xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase" style={{ color: HALLOWEEN_ORANGE }}>
          {HALLOWEEN_TAG}
        </p>
        <h1 className="mt-5 max-w-2xl text-3xl font-light leading-[1.15] sm:text-5xl sm:leading-[1.12]">
          Dress your car up for Halloween.
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Two new sounds for the spooky season. Pick one, start driving, and let the night follow your speed. Both are free until 1 November.
        </p>
        <ul className="mt-14 grid gap-8 sm:grid-cols-2">
          {HALLOWEEN_SOUNDS.map((s) => (
            <li key={s.id} className="flex flex-col overflow-hidden border bg-surface-1/30" style={{ borderColor: `${HALLOWEEN_ORANGE}44` }}>
              <img src={s.image} alt={s.name} className="aspect-video w-full object-cover" />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-light">{s.name}</h2>
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: HALLOWEEN_ORANGE }}>
                    {s.access}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.copy}</p>
                <button
                  type="button"
                  data-testid={`try-${s.id}`}
                  onClick={() => tryProfile(s.id)}
                  className="mt-auto self-start rounded-sm px-4 py-2 text-[11px] font-semibold tracking-[0.2em] text-black uppercase"
                  style={{ background: HALLOWEEN_ORANGE }}
                >
                  Try it
                </button>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}
