/**
 * Server source of truth for the Black Friday / Cyber Monday congratulations modal.
 * Once per account per special, across devices. localStorage is only a cache.
 * The single `users.bf_welcome_seen_at` timestamp is enough for both: a sighting counts for
 * a special only when it is on/after that special's `welcomeSeenSinceMs`.
 */
import { driveSpecialWindowForCopy } from "@/lib/billing/drive-special";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memory = new Map<string, number>();

const dbEnabled = (userId: string) => Boolean(process.env["DATABASE_URL"]) && UUID_RE.test(userId);

export function resetBfWelcomeServerForTests(): void {
  memory.clear();
}

export async function hasSeenBlackFridayWelcomeServer(
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  if (!userId) return true;
  const since = driveSpecialWindowForCopy(now).welcomeSeenSinceMs;
  const cached = memory.get(userId);
  if (cached !== undefined && cached >= since) return true;
  if (!dbEnabled(userId)) return false;
  try {
    const rows = await getDb()
      .select({ seenAt: users.bfWelcomeSeenAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const seenAt = rows[0]?.seenAt?.getTime();
    if (seenAt === undefined) return false;
    memory.set(userId, seenAt);
    return seenAt >= since;
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
