#!/usr/bin/env npx tsx
/**
 * Billing admin diagnostics CLI — development/ops only.
 *
 * Usage:
 *   ELCAMOSO_BILLING_ADMIN_SECRET=… npm run billing:diagnostics -- <user-id-or-email>
 *   ELCAMOSO_BILLING_ADMIN_SECRET=… npm run billing:diagnostics -- --resync <user-id-or-email>
 */
import { assertBillingAdminAccess } from "../src/lib/billing/admin/auth.ts";
import { buildBillingAdminDiagnostics } from "../src/lib/billing/admin/diagnostics.ts";
import { resolveInternalUserLookup } from "../src/lib/billing/admin/resolve-user.ts";
import { reconcileUserBillingFromStripe } from "../src/lib/billing/resilience/reconciliation.ts";

function printUsage(): void {
  console.log(`Usage:
  npm run billing:diagnostics -- <user-id-or-email>
  npm run billing:diagnostics -- --resync <user-id-or-email>

Requires ELCAMOSO_BILLING_ADMIN_SECRET in the environment.`);
}

function printDiagnostics(
  diagnostics: Awaited<ReturnType<typeof buildBillingAdminDiagnostics>>,
): void {
  console.log(JSON.stringify(diagnostics, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  assertBillingAdminAccess(process.env.ELCAMOSO_BILLING_ADMIN_SECRET);

  const resync = args[0] === "--resync";
  const query = resync ? args[1] : args[0];
  if (!query) {
    printUsage();
    process.exit(1);
  }

  const resolved = await resolveInternalUserLookup(query);
  if (resync) {
    const result = await reconcileUserBillingFromStripe(resolved.userId);
    console.log(JSON.stringify({ reconcile: result }, null, 2));
  }

  const diagnostics = await buildBillingAdminDiagnostics(resolved.userId, resolved.email);
  printDiagnostics(diagnostics);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
