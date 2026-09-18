import { desc, eq } from "drizzle-orm";

import type {
  SubscriptionRepository,
  UpsertSubscriptionInput,
} from "@/lib/billing/subscription-repository";
import { subscriptionRowToSubscription } from "@/lib/db/mappers";
import { getDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";

export const postgresSubscriptionRepository: SubscriptionRepository = {
  async upsert(input) {
    const db = getDb();
    const existing = await this.findByProviderSubscriptionId(
      input.provider,
      input.providerSubscriptionId,
    );

    if (existing) {
      const [row] = await db
        .update(subscriptions)
        .set({
          userId: input.userId,
          providerCustomerId: input.providerCustomerId,
          plan: input.plan,
          interval: input.interval,
          status: input.status,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id))
        .returning();
      return subscriptionRowToSubscription(row!);
    }

    const [row] = await db
      .insert(subscriptions)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerCustomerId: input.providerCustomerId,
        providerSubscriptionId: input.providerSubscriptionId,
        plan: input.plan,
        interval: input.interval,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      })
      .returning();
    return subscriptionRowToSubscription(row!);
  },

  async findByProviderSubscriptionId(provider, providerSubscriptionId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
      .limit(1);
    if (!row || row.provider !== provider) return null;
    return subscriptionRowToSubscription(row);
  },

  async findLatestByUserId(userId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.updatedAt))
      .limit(1);
    return row ? subscriptionRowToSubscription(row) : null;
  },
};
