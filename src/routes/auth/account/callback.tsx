import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { activateDynamicDriveTrialForSession } from "@/components/TryDynamicDriveButton";
import { writePersistedAccountSession } from "@/lib/account/persist";
import { verifyAccountMagicLinkFn } from "@/lib/account/server-fns";
import { useSettings } from "@/lib/drive/useSettings";

function parseSearch(search: Record<string, unknown>): {
  token?: string;
  returnTo?: string;
} {
  const out: { token?: string; returnTo?: string } = {};
  if (typeof search["token"] === "string") out.token = search["token"];
  if (typeof search["returnTo"] === "string") out.returnTo = search["returnTo"];
  return out;
}

export const Route = createFileRoute("/auth/account/callback")({
  validateSearch: parseSearch,
  component: AccountCallbackPage,
  head: () => ({
    meta: [{ title: "Signing in - ELCAMOSO" }],
  }),
});

function AccountCallbackPage() {
  const { token, returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const { update } = useSettings();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }

    void (async () => {
      try {
        const verified = await verifyAccountMagicLinkFn({ data: { token } });
        writePersistedAccountSession({
          userId: verified.userId,
          email: verified.email,
          expiresAt: verified.expiresAt,
        });
        await activateDynamicDriveTrialForSession(update, verified.email);
        const next = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/drive";
        if (next.startsWith("/drive")) {
          await navigate({ to: "/drive", search: { activateTrial: true } });
          return;
        }
        window.location.assign(next);
      } catch {
        setError("This sign-in link expired. Request a new one from Drive.");
      }
    })();
  }, [navigate, returnTo, token, update]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">
        {error ?? "Saving your Dynamic Drive Preview…"}
      </p>
    </main>
  );
}
