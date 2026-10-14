import { describe, expect, it } from "vitest";

import {
  AdminAuthError,
  assertAdmin,
  isAllowlistedAdminEmail,
  readAdminEmailAllowlist,
} from "@/lib/admin/admin-access";

const session = (email: string) => ({ token: "raw", userId: "u1", email });
const deps = (email: string | null, extra: Partial<Parameters<typeof assertAdmin>[1]> = {}) => ({
  getSession: (t: string) => (t === "good" && email ? session(email) : null),
  allowlist: readAdminEmailAllowlist(""),
  ...extra,
});

async function status(p: Promise<unknown>): Promise<number | "ok"> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof AdminAuthError) return e.status;
    throw e;
  }
}

describe("admin guard", () => {
  it("matches George's email case-insensitively", () => {
    expect(
      isAllowlistedAdminEmail("George.M.Neacsu@GoogleMail.com", readAdminEmailAllowlist("")),
    ).toBe(true);
    expect(
      isAllowlistedAdminEmail(" george.m.neacsu@googlemail.com ", readAdminEmailAllowlist("")),
    ).toBe(true);
    expect(isAllowlistedAdminEmail("george.m.neacsu@gmail.com", readAdminEmailAllowlist(""))).toBe(
      false,
    );
  });

  it("adds ELCAMOSO_ADMIN_EMAILS entries", () => {
    expect(
      isAllowlistedAdminEmail("ops@x.com", readAdminEmailAllowlist("a@b.com, OPS@x.com")),
    ).toBe(true);
  });

  it("401 without a token or with an invalid one", async () => {
    expect(await status(assertAdmin(null, deps("george.m.neacsu@googlemail.com")))).toBe(401);
    expect(await status(assertAdmin("  ", deps("george.m.neacsu@googlemail.com")))).toBe(401);
    expect(await status(assertAdmin("forged", deps("george.m.neacsu@googlemail.com")))).toBe(401);
  });

  it("403 for a signed-in non-admin", async () => {
    expect(await status(assertAdmin("good", deps("someone@example.com")))).toBe(403);
    expect(
      await status(
        assertAdmin("good", deps("someone@example.com", { getDbRole: async () => "user" })),
      ),
    ).toBe(403);
  });

  it("allows the allowlisted admin (any case)", async () => {
    const id = await assertAdmin("good", deps("George.M.Neacsu@googlemail.com"));
    expect(id).toEqual({ userId: "u1", email: "george.m.neacsu@googlemail.com" });
  });

  it("allows users with role=admin in the DB", async () => {
    expect(
      await status(
        assertAdmin("good", deps("ops@example.com", { getDbRole: async () => "admin" })),
      ),
    ).toBe("ok");
  });

  it("rejects revoked sessions even for admins", async () => {
    expect(
      await status(
        assertAdmin(
          "good",
          deps("george.m.neacsu@googlemail.com", { isSessionRevoked: async () => true }),
        ),
      ),
    ).toBe(401);
  });

  it("fails closed when the DB role lookup throws", async () => {
    expect(
      await status(
        assertAdmin(
          "good",
          deps("x@example.com", { getDbRole: async () => Promise.reject(new Error("db")) }),
        ),
      ),
    ).toBe(403);
  });
});
