import { createFileRoute } from "@tanstack/react-router";

import { RumosoComingSoon } from "@/components/rumoso/RumosoComingSoon";
import { RumosoGate } from "@/components/rumoso/RumosoGate";
import type { RumosoDemoView } from "@/components/rumoso/RumosoApp";
import { createSeoHeadFromPath } from "@/lib/seo";
import { getRumosoAccessFn, type RumosoAccessResult } from "@/lib/rumoso/server-fns";

function parseDemo(value: unknown): RumosoDemoView | "coming-soon" | undefined {
  if (
    value === "ready" ||
    value === "running" ||
    value === "summary" ||
    value === "diagnostics" ||
    value === "coming-soon"
  ) {
    return value;
  }
  return undefined;
}

export const Route = createFileRoute("/rumoso")({
  // Same pattern as /admin: server-side loader, no nav link, noindex.
  loader: async (): Promise<RumosoAccessResult> => getRumosoAccessFn(),
  staleTime: 0,
  gcTime: 0,
  validateSearch: (search: Record<string, unknown>): { demo?: RumosoDemoView | "coming-soon" } => {
    const demo = parseDemo(search["demo"]);
    return demo ? { demo } : {};
  },
  component: RumosoPage,
  head: rumosoHead,
});

/** Route-scoped icons and OG for /rumoso only. Does not change the global ELCAMOSO favicon, manifest or default OG. */
function rumosoHead() {
  const base = createSeoHeadFromPath("/rumoso");
  return {
    ...base,
    meta: [
      ...base.meta,
      { name: "apple-mobile-web-app-title", content: "RUMOSO" },
    ],
    links: [
      ...base.links,
      { rel: "icon", type: "image/svg+xml", href: "/rumoso/icons/favicon-16.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/rumoso/icons/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/rumoso/icons/favicon-16.png" },
      { rel: "shortcut icon", href: "/rumoso/icons/favicon.ico" },
      { rel: "apple-touch-icon", href: "/rumoso/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/rumoso/manifest.webmanifest" },
    ],
  };
}

function RumosoPage() {
  const result = Route.useLoaderData();
  const { demo } = Route.useSearch();
  if (import.meta.env.DEV && demo === "coming-soon") {
    return <RumosoComingSoon />;
  }
  return (
    <RumosoGate
      result={result}
      {...(import.meta.env.DEV && demo && demo !== "coming-soon" ? { demo } : {})}
    />
  );
}
