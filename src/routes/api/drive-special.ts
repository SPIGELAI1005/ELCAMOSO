import { createFileRoute } from "@tanstack/react-router";

import { getAccountSession } from "@/lib/account/auth-service";
import { readAccountSessionToken } from "@/lib/billing/checkout-http";
import { recordDriveSpecialHeartbeat } from "@/lib/drive-special-cap/usage.server";
import { resolveEntitlementUser } from "@/lib/entitlements/service";
import { isTrialActive } from "@/lib/entitlements/trial";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function handle(request: Request, claimedSeconds: number) {
  const now = Date.now();
  const token = readAccountSessionToken(request);
  const session = token ? getAccountSession(token, now) : null;
  if (!session) return jsonResponse({ mode: "signed_out" });
  try {
    const user = await resolveEntitlementUser({ sessionToken: token, now });
    const account = {
      accountId: user.accountId,
      plan: user.plan,
      founderDrivePlusActive: Boolean(user.founder?.drivePlusActive),
      grantedEntitlements: user.grantedEntitlements,
      trialActive: isTrialActive(user, now),
      trialEntitlements: user.trialEntitlements,
    };
    const result = await recordDriveSpecialHeartbeat({
      account,
      claimedSeconds,
      now,
    });
    return jsonResponse(result);
  } catch (e) {
    console.error("[drive-special]", e instanceof Error ? e.message : "error");
    return jsonResponse({ mode: "uncapped" });
  }
}

export const Route = createFileRoute("/api/drive-special")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request, 0),
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => null)) as { seconds?: number } | null;
        return handle(request, Number(b?.seconds ?? 0));
      },
    },
  },
});
