/**
 * Access gate for /rumoso. Mirrors /admin: signed-in allowlist or role=admin.
 * Local `vite dev` is open so the page can be built, tested and screenshotted
 * without a session. Preview and production builds stay admin-gated.
 */
import { createServerFn } from "@tanstack/react-start";

export type RumosoAccessResult =
  | { ok: true; email: string; dev: boolean }
  | { ok: false; status: 401 | 403; error: string };

export const getRumosoAccessFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<RumosoAccessResult> => {
    if (import.meta.env.DEV) {
      return { ok: true, email: "dev@localhost", dev: true };
    }
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const { AdminAuthError } = await import("@/lib/admin/admin-access");
    const { requireAdmin } = await import("@/lib/admin/admin-store.server");
    try {
      const admin = await requireAdmin(tryResolveRequestSessionToken(null));
      return { ok: true, email: admin.email, dev: false };
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return { ok: false, status: error.status, error: error.message };
      }
      throw error;
    }
  },
);
