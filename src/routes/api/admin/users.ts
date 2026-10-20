import { createFileRoute } from "@tanstack/react-router";

import { AdminAuthError, type AdminIdentity } from "@/lib/admin/admin-access";
import { requireAdmin } from "@/lib/admin/admin-store.server";
import {
  AccountsError,
  adminGrantDrivePlus,
  adminGrantSound,
  adminRemoveSound,
  adminRevokeDrivePlus,
  adminSetPromoActive,
  adminUpsertPromo,
  getUserDetail,
  hasAccountsDb,
  listPromos,
  searchUsers,
} from "@/lib/accounts/accounts.server";
import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";

async function guard(request: Request): Promise<AdminIdentity | Response> {
  try {
    return await requireAdmin(readAccountSessionToken(request));
  } catch (error) {
    if (error instanceof AdminAuthError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "Unavailable" }, 500);
  }
}
function fail(e: unknown) {
  if (e instanceof AccountsError) return jsonResponse({ error: e.message }, e.status);
  console.error("[admin users]", e instanceof Error ? e.message : e);
  return jsonResponse({ error: `Database error: ${classifyDbError(e)}` }, 500);
}

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await guard(request);
        if (admin instanceof Response) return admin;
        if (!hasAccountsDb()) return jsonResponse({ configured: false, users: [], promos: [] });
        const url = new URL(request.url);
        try {
          const id = url.searchParams.get("id");
          if (id) return jsonResponse({ configured: true, detail: await getUserDetail(id) });
          const [list, promos] = await Promise.all([searchUsers(url.searchParams.get("q") ?? ""), listPromos()]);
          return jsonResponse({ configured: true, users: list, promos });
        } catch (e) {
          if (isMissingTables(e)) {
            try {
              const { runPendingMigrations } = await import("@/lib/db/runtime-migrate.server");
              const applied = await runPendingMigrations();
              return jsonResponse({ configured: true, users: [], promos: [], migrated: applied });
            } catch (m) {
              return fail(m);
            }
          }
          return fail(e);
        }
      },
      POST: async ({ request }) => {
        const admin = await guard(request);
        if (admin instanceof Response) return admin;
        const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!b || typeof b["action"] !== "string") return jsonResponse({ error: "Bad request" }, 400);
        const userId = String(b["userId"] ?? "");
        const profileId = String(b["profileId"] ?? "");
        const days = b["days"] == null || b["days"] === "" ? null : Number(b["days"]);
        try {
          switch (b["action"]) {
            case "grant_sound":
              if (!profileId) return jsonResponse({ error: "profileId required" }, 400);
              await adminGrantSound(admin, userId, profileId, days);
              break;
            case "remove_sound":
              await adminRemoveSound(admin, userId, profileId);
              break;
            case "grant_drive_plus":
              await adminGrantDrivePlus(admin, userId, Number(days));
              break;
            case "revoke_drive_plus":
              await adminRevokeDrivePlus(admin, userId);
              break;
            case "upsert_promo":
              await adminUpsertPromo(admin, b as never);
              break;
            case "set_promo_active":
              await adminSetPromoActive(admin, String(b["code"] ?? ""), Boolean(b["active"]));
              break;
            default:
              return jsonResponse({ error: "Unknown action" }, 400);
          }
          return jsonResponse({ ok: true });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});

/** Error class + redacted message (never the connection string or password). */
function classifyDbError(e: unknown): string {
  const chain: { code?: string; message?: string; name?: string }[] = [];
  let cur = e as { cause?: unknown } | null;
  for (let i = 0; cur && i < 5; i++) {
    chain.push(cur as never);
    cur = (cur as { cause?: unknown }).cause as never;
  }
  const root = chain[chain.length - 1] ?? {};
  const code = chain.map((c) => c.code).find(Boolean) ?? "";
  const m = chain.map((c) => `${c.code ?? ""} ${c.message ?? ""}`).join(" | ");
  const redacted = String(root.message ?? "")
    .replace(/postgres(ql)?:\/\/\S+/gi, "[url]")
    .replace(/password=\S+/gi, "password=[x]")
    .slice(0, 160);
  let hint = "unexpected";
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) hint = "host not found";
  else if (/ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT|timeout/i.test(m)) hint = "cannot reach database host";
  else if (/password authentication|28P01/i.test(m)) hint = "wrong database password";
  else if (/tenant|user not found|XX000/i.test(m)) hint = "pooler user/region wrong";
  else if (/does not exist|42P01|42704/i.test(m)) hint = "tables missing";
  else if (/Invalid URL|malformed/i.test(m)) hint = "DATABASE_URL malformed";
  return `${hint} [${code || root.name || "?"}] ${redacted}`;
}

function isMissingTables(e: unknown): boolean {
  let cur = e as { code?: string; message?: string; cause?: unknown } | null;
  for (let i = 0; cur && i < 5; i++) {
    if (cur.code === "42P01" || /relation .* does not exist/i.test(cur.message ?? "")) return true;
    cur = cur.cause as never;
  }
  return false;
}
