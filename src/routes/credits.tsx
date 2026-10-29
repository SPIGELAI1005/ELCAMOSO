import { createFileRoute, Link } from "@tanstack/react-router";

import { createSeoHeadFromPath } from "@/lib/seo";
import { DEBRIS_GRAIN_CREDITS } from "@/lib/sound/dsp/debris-grains";
import { RECORDED_LOOP_CREDITS } from "@/lib/sound/realism/v2/recorded-loops";
import { RECORDED_BED_CREDITS } from "@/lib/sound/recorded-beds";
import { HORSE_SNORT_CREDITS } from "@/lib/sound/horse-snorts";
import { HORSE_WHINNY_CREDITS } from "@/lib/sound/horse-whinnies";

const CREDITS = [...RECORDED_LOOP_CREDITS, ...RECORDED_BED_CREDITS, ...HORSE_SNORT_CREDITS, ...HORSE_WHINNY_CREDITS, ...DEBRIS_GRAIN_CREDITS];

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
  head: () => createSeoHeadFromPath("/credits"),
});

function CreditsPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-6 pt-12 pb-28 sm:px-10 sm:pt-16">
        <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="mt-4 text-3xl font-light">Sound credits & licences</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Some engine and effect sounds use real recordings shared under free licences. Thank you to
          the recordists below. All other sounds are synthesised by ELCAMOSO.
        </p>
        <ul className="mt-8 space-y-6">
          {CREDITS.map((c) => (
            <li key={c.sourceUrl} className="rounded-xl border border-border px-4 py-4">
              <p className="text-base font-medium">{c.title}</p>
              <p className="mt-1 text-sm">{c.attribution}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Author: {c.author} · Licence:{" "}
                <a href={c.licenceUrl} target="_blank" rel="noreferrer" className="underline">
                  {c.licence}
                </a>{" "}
                ·{" "}
                <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  Source
                </a>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Used in: {c.usedIn}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
