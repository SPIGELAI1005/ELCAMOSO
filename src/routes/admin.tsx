import { createFileRoute, Link } from "@tanstack/react-router";

import { getAdminOverviewFn, type AdminOverviewResult } from "@/lib/admin/server-fns";

export const Route = createFileRoute("/admin")({
  // Guard runs server-side on every load; non-admins never receive admin data.
  loader: async (): Promise<AdminOverviewResult> => getAdminOverviewFn(),
  staleTime: 0,
  gcTime: 0,
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin · ELCAMOSO" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function Stat({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value ?? "–"}</div>
    </div>
  );
}

function AdminPage() {
  const result = Route.useLoaderData();
  if (!result.ok) {
    return (
      <main className="mx-auto max-w-xl p-8" data-testid="admin-denied">
        <h1 className="text-2xl font-semibold">Admin access required</h1>
        <p className="mt-2 opacity-70">
          {result.status === 401
            ? "Please sign in with an admin account."
            : "This account does not have admin access."}
        </p>
        <Link to="/" className="mt-4 inline-block underline">
          Back to ELCAMOSO
        </Link>
      </main>
    );
  }
  const o = result.overview;
  return (
    <main className="mx-auto max-w-5xl p-6" data-testid="admin-dashboard">
      <h1 className="text-2xl font-semibold">ELCAMOSO Admin</h1>
      <p className="mt-1 text-sm opacity-70">
        Signed in as {o.admin.email}
        {o.deploySha ? ` · build ${o.deploySha}` : ""}
      </p>
      {!o.databaseConfigured && (
        <p className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
          DATABASE_URL is not configured on this deployment – metrics and audit log are unavailable.
        </p>
      )}
      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Users" value={o.userCount} />
        <Stat label="Subscriptions" value={o.subscriptionCount} />
        <Stat label="Active sessions" value={o.activeSessionCount} />
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Audit log</h2>
        {o.recentAudit.length === 0 ? (
          <p className="mt-2 text-sm opacity-70">No entries yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {o.recentAudit.map((r, i) => (
              <li key={i} className="font-mono opacity-80">
                {r.at} · {r.adminEmail} · {r.action}
                {r.target ? ` · ${r.target}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
