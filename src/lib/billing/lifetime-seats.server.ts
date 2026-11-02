/**
 * Real Lifetime seat count (server-only): completed, non-refunded Lifetime purchases.
 * Postgres is the source of truth when DATABASE_URL is set; otherwise the in-memory grant store.
 */
import { and, eq, like, sql } from "drizzle-orm";

import {
  countActiveLifetimeGrants,
  LIFETIME_PROVIDER_ID_PREFIX,
} from "@/lib/billing/lifetime-store";
import { lifetimeSeatStatus, type LifetimeSeatStatus } from "@/lib/billing/lifetime-seats";
import { getDb } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";

export async function countSoldLifetimeSeats(): Promise<number> {
  if (!process.env["DATABASE_URL"]) return countActiveLifetimeGrants();
  const rows = await getDb()
    .select({ n: sql<number>`count(distinct ${subscriptions.userId})::int` })
    .from(subscriptions)
    .where(
      and(
        like(subscriptions.providerSubscriptionId, `${LIFETIME_PROVIDER_ID_PREFIX}%`),
        eq(subscriptions.status, "active"),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export async function getLifetimeSeatStatus(): Promise<LifetimeSeatStatus> {
  return lifetimeSeatStatus(await countSoldLifetimeSeats());
}
