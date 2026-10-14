import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { accountSessions, adminAuditLog, users } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-client";

describe("admin foundations migration", () => {
  let db: TestDb;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  beforeEach(async () => {
    ({ db, client } = await createTestDb());
  });
  afterEach(async () => {
    await client.close();
  });

  it("users default to role=user and can be promoted", async () => {
    const [u] = await db.insert(users).values({ email: "a@example.com" }).returning();
    expect(u?.role).toBe("user");
    await db.update(users).set({ role: "admin" }).where(eq(users.email, "a@example.com"));
    const rows = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = 'a@example.com'`);
    expect(rows[0]?.role).toBe("admin");
  });

  it("stores sessions and audit entries", async () => {
    await db.insert(accountSessions).values({
      tokenHash: "h",
      userId: "u",
      email: "a@example.com",
      expiresAt: new Date(Date.now() + 1000),
    });
    await db
      .insert(adminAuditLog)
      .values({ adminUserId: "u", adminEmail: "a@example.com", action: "x" });
    expect((await db.select().from(accountSessions)).length).toBe(1);
    expect((await db.select().from(adminAuditLog))[0]?.action).toBe("x");
  });
});
