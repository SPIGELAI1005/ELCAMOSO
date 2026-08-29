import { eq } from "drizzle-orm";

import type { UserBillingRepository } from "@/lib/billing/user-billing-store";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const postgresUserBillingRepository: UserBillingRepository = {
  async getStripeCustomerId(userId) {
    const db = getDb();
    const [row] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.stripeCustomerId ?? null;
  },

  async getUserIdByStripeCustomerId(stripeCustomerId) {
    const db = getDb();
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row?.id ?? null;
  },

  async setStripeCustomerId(userId, stripeCustomerId, email = null) {
    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

    if (existing) {
      await db
        .update(users)
        .set({ stripeCustomerId, ...(email ? { email } : {}) })
        .where(eq(users.id, userId));
      return;
    }

    await db.insert(users).values({
      id: userId,
      email,
      stripeCustomerId,
    });
  },
};
