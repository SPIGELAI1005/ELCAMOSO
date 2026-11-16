import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { RumosoApp, type RumosoDemoView } from "@/components/rumoso/RumosoApp";
import { RumosoLockup } from "@/components/rumoso/RumosoIcon";
import { createSeoHeadFromPath } from "@/lib/seo";
import { getRumosoAccessFn, type RumosoAccessResult } from "@/lib/rumoso/server-fns";

function parseDemo(value: unknown): RumosoDemoView | undefined {
  if (value === "ready" || value === "running" || value === "summary" || value === "diagnostics") {
    return value;
  }
  return undefined;
}

export const Route = createFileRoute("/rumoso")({
  // Same pattern as /admin: server-side loader, no nav link, noindex.
  loader: async (): Promise<RumosoAccessResult> => getRumosoAccessFn(),
  staleTime: 0,
  gcTime: 0,
  validateSearch: (search: Record<string, unknown>): { demo?: RumosoDemoView } => {
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
  if (!result.ok) {
    return <RumosoDenied status={result.status} />;
  }
  return (
    <RumosoApp
      accessEmail={result.email}
      dev={result.dev}
      {...(import.meta.env.DEV && demo ? { demo } : {})}
    />
  );
}

function RumosoDenied({ status }: { status: 401 | 403 }) {
  const [signIn, setSignIn] = useState(status === 401);
  return (
    <main
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-16"
      data-testid="rumoso-denied"
    >
      <h1 className="m-0">
        <RumosoLockup className="h-10 w-auto max-w-full" />
      </h1>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        {status === 401
          ? "Sign in with an admin account to test RUMOSO. This page is unlisted and uses the same allowlist as Admin."
          : "This account does not have access to the RUMOSO test. It is limited to the admin allowlist while it is in private preview."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {status === 401 ? (
          <button
            type="button"
            onClick={() => setSignIn(true)}
            className="h-11 rounded-full bg-foreground px-5 text-[11px] tracking-[0.2em] text-background uppercase"
          >
            Sign in
          </button>
        ) : null}
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-[11px] tracking-[0.2em] uppercase"
        >
          Back to ELCAMOSO
        </Link>
      </div>
      <AccountSignInDialog
        open={signIn}
        onOpenChange={setSignIn}
        returnTo="/rumoso"
        title="Sign in to RUMOSO"
        description="Use the same admin account you use for the ELCAMOSO admin page."
      />
    </main>
  );
}
