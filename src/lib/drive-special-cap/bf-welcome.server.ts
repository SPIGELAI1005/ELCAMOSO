/**
 * Server source of truth for the Black Friday congratulations modal.
 * Once per account across devices. localStorage is only a cache.
 */
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memory = new Map<string, number>();

const dbEnabled = (userId: string) => Boolean(process.env["DATABASE_URL"]) && UUID_RE.test(userId);

export function resetBfWelcomeServerForTests(): void {
  memory.clear();
}

export async function hasSeenBlackFridayWelcomeServer(userId: string): Promise<boolean> {
  if (!userId) return true;
  if (memory.has(userId)) return true;
  if (!dbEnabled(userId)) return false;
  try {
    const rows = await getDb()
      .select({ seenAt: users.bfWelcomeSeenAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const seen = rows[0]?.seenAt != null;
    if (seen) memory.set(userId, rows[0]!.seenAt!.getTime());
    return seen;
  } catch (error) {
    console.error("[bf-welcome] load failed", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function markBlackFridayWelcomeSeenServer(
  userId: string,
  email: string | null = null,
  now = Date.now(),
): Promise<void> {
  if (!userId) return;
  memory.set(userId, now);
  if (!dbEnabled(userId)) return;
  try {
    const db = getDb();
    await db.insert(users).values({ id: userId, email }).onConflictDoNothing();
    await db
      .update(users)
      .set({ bfWelcomeSeenAt: new Date(now) })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("[bf-welcome] persist failed", error instanceof Error ? error.message : error);
  }
}
