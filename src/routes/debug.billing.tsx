import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  adminReconcileBillingFromStripeFn,
  getBillingAdminConfiguredFn,
  lookupBillingAdminDiagnosticsFn,
} from "@/lib/billing/admin/server-fns";
import type { BillingAdminDiagnostics } from "@/lib/billing/admin/diagnostics";

const ADMIN_SECRET_STORAGE_KEY = "elcamoso.billingAdminSecret";

export const Route = createFileRoute("/debug/billing")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/" });
    }
  },
  component: BillingAdminDiagnosticsPage,
  head: () => ({
    meta: [{ title: "Billing admin · ELCAMOSO Debug" }],
  }),
});

function BillingAdminDiagnosticsPage() {
  const [adminConfigured, setAdminConfigured] = useState<boolean | null>(null);
  const [adminSecret, setAdminSecret] = useState("");
  const [query, setQuery] = useState("");
  const [diagnostics, setDiagnostics] = useState<BillingAdminDiagnostics | null>(null);
  const [lookupKind, setLookupKind] = useState<"user_id" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"lookup" | "resync" | null>(null);
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_STORAGE_KEY);
    if (stored) setAdminSecret(stored);
    void getBillingAdminConfiguredFn().then((result) => setAdminConfigured(result.configured));
  }, []);

  const persistSecret = useCallback((value: string) => {
    setAdminSecret(value);
    if (value.trim()) {
      sessionStorage.setItem(ADMIN_SECRET_STORAGE_KEY, value.trim());
    } else {
      sessionStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
    }
  }, []);

  const runLookup = useCallback(async () => {
    setError(null);
    setResyncMessage(null);
    setBusy("lookup");
    try {
      const result = await lookupBillingAdminDiagnosticsFn({
        data: { adminSecret: adminSecret.trim(), query: query.trim() },
      });
      setDiagnostics(result.diagnostics);
      setLookupKind(result.lookup);
    } catch (lookupError) {
      setDiagnostics(null);
      setLookupKind(null);
      setError(lookupError instanceof Error ? lookupError.message : "Lookup failed");
    } finally {
      setBusy(null);
    }
  }, [adminSecret, query]);

  const runResync = useCallback(async () => {
    if (!diagnostics) return;
    setError(null);
    setResyncMessage(null);
    setBusy("resync");
    try {
      const result = await adminReconcileBillingFromStripeFn({
        data: { adminSecret: adminSecret.trim(), userId: diagnostics.userId },
      });
      setDiagnostics(result.diagnostics);
      setResyncMessage(result.result.message);
    } catch (resyncError) {
      setError(resyncError instanceof Error ? resyncError.message : "Re-sync failed");
    } finally {
      setBusy(null);
    }
  }, [adminSecret, diagnostics]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Dev admin only</p>
        <h1 className="mt-3 text-3xl font-light">Billing diagnostics</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Read-only lookup by internal user id or email. Re-sync pulls subscription state from Stripe
          — never arbitrary entitlement edits.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link to="/debug" className="underline underline-offset-4 hover:text-foreground">
            Sound debug
          </Link>
          {" · "}
          <Link to="/debug/diagnostics" className="underline underline-offset-4 hover:text-foreground">
            Drive diagnostics
          </Link>
        </p>

        {adminConfigured === false ? (
          <p className="mt-8 border border-border p-4 text-sm text-muted-foreground">
            Set <code className="text-foreground">ELCAMOSO_BILLING_ADMIN_SECRET</code> on the server
            to enable admin billing tools.
          </p>
        ) : null}

        <section className="mt-10 space-y-4 border border-border p-6">
          <label className="block text-sm">
            <span className="text-muted-foreground">Admin secret</span>
            <input
              type="password"
              autoComplete="off"
              value={adminSecret}
              onChange={(event) => persistSecret(event.target.value)}
              className="mt-2 h-11 w-full border border-border bg-background px-3 font-mono text-sm"
              placeholder="ELCAMOSO_BILLING_ADMIN_SECRET"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Internal user id or email</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-2 h-11 w-full border border-border bg-background px-3 font-mono text-sm"
              placeholder="55555555-5555-4555-8555-555555555555 or driver@example.com"
            />
          </label>

          <button
            type="button"
            disabled={busy !== null || !adminSecret.trim() || !query.trim()}
            onClick={() => void runLookup()}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary disabled:opacity-40"
          >
            {busy === "lookup" ? "Looking up…" : "Lookup"}
          </button>
        </section>

        {error ? (
          <p className="mt-6 border border-border p-4 text-sm text-red-400">{error}</p>
        ) : null}

        {resyncMessage ? (
          <p className="mt-6 border border-border p-4 text-sm text-muted-foreground">{resyncMessage}</p>
        ) : null}

        {diagnostics ? (
          <section className="mt-8 space-y-6 border border-border p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base">User snapshot</h2>
              {lookupKind ? (
                <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  via {lookupKind === "email" ? "email" : "user id"}
                </span>
              ) : null}
            </div>

            <DiagnosticsGrid diagnostics={diagnostics} />

            <button
              type="button"
              disabled={busy !== null || !diagnostics.stripeConfigured}
              onClick={() => void runResync()}
              className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary disabled:opacity-40"
            >
              {busy === "resync" ? "Re-syncing…" : "Re-sync from Stripe"}
            </button>
            {!diagnostics.stripeConfigured ? (
              <p className="text-xs text-muted-foreground">Stripe is not configured on this server.</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function DiagnosticsGrid({ diagnostics }: { diagnostics: BillingAdminDiagnostics }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "User id", value: diagnostics.userId },
    { label: "Email", value: diagnostics.email ?? "—" },
    { label: "Internal plan", value: diagnostics.internalPlan },
    { label: "Entitlements", value: diagnostics.entitlements.join(", ") || "—" },
    {
      label: "Trial status",
      value: diagnostics.trial?.status ?? "none",
    },
    {
      label: "Trial remaining",
      value: diagnostics.trial
        ? `${diagnostics.trial.remainingSeconds}s · ${diagnostics.trial.remainingSessions} sessions`
        : "—",
    },
    { label: "Stripe customer id", value: diagnostics.stripeCustomerId ?? "—" },
    { label: "Stripe subscription id", value: diagnostics.stripeSubscriptionId ?? "—" },
    { label: "Local subscription status", value: diagnostics.localSubscriptionStatus },
    { label: "Local access reason", value: diagnostics.localAccessReason },
    { label: "Current period end", value: diagnostics.currentPeriodEnd ?? "—" },
    {
      label: "Cancel at period end",
      value: diagnostics.cancelAtPeriodEnd ? "yes" : "no",
    },
    { label: "Last subscription update", value: diagnostics.lastSubscriptionUpdate ?? "—" },
    { label: "Failed webhooks (recent)", value: String(diagnostics.failedWebhookCount) },
  ];

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="border-b border-border pb-3">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="mt-1 break-all font-mono text-xs">{row.value}</dd>
        </div>
      ))}

      {diagnostics.recentFailedWebhooks.length > 0 ? (
        <div className="sm:col-span-2 border-t border-border pt-4">
          <p className="text-muted-foreground">Recent failed webhook events</p>
          <ul className="mt-3 space-y-2 font-mono text-xs">
            {diagnostics.recentFailedWebhooks.map((event) => (
              <li key={event.stripeEventId} className="border-b border-border pb-2">
                {event.stripeEventId} · {event.eventType}
                {event.errorMessage ? ` · ${event.errorMessage}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </dl>
  );
}
