import { createServerFn } from "@tanstack/react-start";

export type AdminOverviewResult =
  | { ok: true; overview: import("@/lib/admin/admin-store.server").AdminOverview }
  | { ok: false; status: 401 | 403; error: string };

export const getAdminOverviewFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<AdminOverviewResult> => {
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const { AdminAuthError } = await import("@/lib/admin/admin-access");
    const { requireAdmin, loadAdminOverview, writeAdminAudit } =
      await import("@/lib/admin/admin-store.server");
    try {
      const admin = await requireAdmin(tryResolveRequestSessionToken(null));
      await writeAdminAudit(admin, "admin.overview.view").catch(() => undefined);
      return { ok: true, overview: await loadAdminOverview(admin) };
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return { ok: false, status: error.status, error: error.message };
      }
      throw error;
    }
  },
);
