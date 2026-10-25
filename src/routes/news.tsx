import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createSeoHeadFromPath } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { getVisibleNewsItems } from "@/lib/news/items";

export const Route = createFileRoute("/news")({
  // Server side: only items whose publish time has passed are sent.
  loader: () => ({ now: Date.now() }),
  component: NewsPage,
  head: () => createSeoHeadFromPath("/news"),
});

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function NewsPage() {
  const { now: serverNow } = Route.useLoaderData();
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const items = getVisibleNewsItems(now);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_at_top,oklch(1_0_0_/_0.06),transparent_65%)]"
      />
      <article className="relative mx-auto w-full max-w-5xl px-6 pt-16 pb-28 sm:px-10">
        <header className="max-w-2xl">
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">News</p>
          <h1 className="mt-5 text-3xl font-light leading-[1.15] sm:text-5xl sm:leading-[1.12]">
            What is new on ELCAMOSO.
          </h1>
          <div className="mt-8 flex items-center gap-4">
            <ElcamosoMark intensity={0.7} className="h-8 w-auto text-foreground" />
            <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              Sounds · Crew · Smiles
            </p>
          </div>
        </header>

        {items.length === 0 ? (
          <p className="mt-16 border-t border-border pt-16 text-sm text-muted-foreground">
            First news drops soon.
          </p>
        ) : (
          <ul className="mt-16 grid gap-8 border-t border-border pt-16 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                data-testid="news-item"
                className="flex flex-col overflow-hidden border border-border/70 bg-surface-1/30"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <time
                    dateTime={item.publishAt}
                    className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
                  >
                    {DATE_FMT.format(new Date(item.publishAt))}
                  </time>
                  <p className="text-sm leading-relaxed text-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </main>
  );
}
