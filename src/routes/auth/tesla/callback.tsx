import { createFileRoute, redirect } from "@tanstack/react-router";
import { teslaOAuthCallbackFn } from "@/lib/tesla/server-fns";
import type { TeslaOAuthCallbackInput } from "@/lib/tesla/types";
function parseCallbackSearch(search: Record<string, unknown>): TeslaOAuthCallbackInput {
  return {
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
    error_description:
      typeof search["error_description"] === "string" ? search["error_description"] : undefined,
  };
}

export const Route = createFileRoute("/auth/tesla/callback")({
  validateSearch: parseCallbackSearch,
  beforeLoad: async ({ search }) => {
    const result = await teslaOAuthCallbackFn({ data: search });
    const status = result.ok ? result.status : "error";
    throw redirect({
      to: "/settings",
      search: {
        workspace: "sensors",
        tesla: status,
        ...(result.message ? { teslaMsg: result.message.slice(0, 120) } : {}),
      },
    });
  },
  component: CallbackPending,
  head: () => ({
    meta: [{ title: "Connecting vehicle - ELCAMOSO" }],
  }),
});

function CallbackPending() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">Connecting your vehicle…</p>
    </main>
  );
}
