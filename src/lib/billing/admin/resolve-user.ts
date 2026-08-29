import { eq } from "drizzle-orm";

import { resolveUserIdForEmail } from "@/lib/account/session-store";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResolvedInternalUser {
  userId: string;
  email: string | null;
  lookup: "user_id" | "email";
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

async function resolveEmailFromPostgres(userId: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.email ?? null;
  } catch {
    return null;
  }
}

async function resolveUserIdFromPostgresEmail(email: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** Resolve an internal user id from UUID or email — admin lookup only. */
export async function resolveInternalUserLookup(query: string): Promise<ResolvedInternalUser> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("User lookup query is required");
  }

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    const userId =
      resolveUserIdForEmail(email) ?? (await resolveUserIdFromPostgresEmail(email));
    if (!userId) {
      throw new Error("No user found for that email");
    }
    return { userId, email, lookup: "email" };
  }

  if (!isUuid(trimmed)) {
    throw new Error("Provide a valid internal user id (UUID) or email");
  }

  const email = await resolveEmailFromPostgres(trimmed);
  return { userId: trimmed, email, lookup: "user_id" };
}
