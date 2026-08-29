import { createServerFn } from "@tanstack/react-start";

import { assertBillingAdminAccess } from "@/lib/billing/admin/auth";
import { buildBillingAdminDiagnostics } from "@/lib/billing/admin/diagnostics";
import { resolveInternalUserLookup } from "@/lib/billing/admin/resolve-user";
import { reconcileUserBillingFromStripe } from "@/lib/billing/resilience/reconciliation";

/** Dev/admin only — lookup billing state by internal user id or email. */
export const lookupBillingAdminDiagnosticsFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { adminSecret: string; query: string }) => data,
  )
  .handler(async ({ data }) => {
    assertBillingAdminAccess(data.adminSecret);
    const resolved = await resolveInternalUserLookup(data.query);
    const diagnostics = await buildBillingAdminDiagnostics(resolved.userId, resolved.email);
    return { lookup: resolved.lookup, diagnostics };
  });

/** Dev/admin only — explicit Stripe re-sync for an internal user. Never mutates entitlements arbitrarily. */
export const adminReconcileBillingFromStripeFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { adminSecret: string; userId: string }) => data,
  )
  .handler(async ({ data }) => {
    assertBillingAdminAccess(data.adminSecret);
    const result = await reconcileUserBillingFromStripe(data.userId);
    const diagnostics = await buildBillingAdminDiagnostics(data.userId);
    return { result, diagnostics };
  });

/** Dev/admin only — whether admin billing tools are configured on this server. */
export const getBillingAdminConfiguredFn = createServerFn({ method: "POST" }).handler(() => ({
  configured: Boolean(process.env.ELCAMOSO_BILLING_ADMIN_SECRET?.trim()),
}));
