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
  return {
    token: typeof search["token"] === "string" ? search["token"] : undefined,
    returnTo: typeof search["returnTo"] === "string" ? search["returnTo"] : undefined,
  };
}

export const Route = createFileRoute("/auth/account/callback")({
  validateSearch: parseSearch,
  component: AccountCallbackPage,
  head: () => ({
    meta: [{ title: "Signing in - ELCAMOSO" }],
  }),
});

function AccountCallbackPage() {
  const { token } = Route.useSearch();
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
          sessionToken: verified.sessionToken,
          userId: verified.userId,
          email: verified.email,
          expiresAt: verified.expiresAt,
        });
        await activateDynamicDriveTrialForSession(
          verified.sessionToken,
          update,
          verified.email,
        );
        await navigate({ to: "/drive", search: { activateTrial: true } });
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
