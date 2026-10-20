/**
 * Runtime fallback for the build-time migrator: applies drizzle/migrations/*.sql that are not yet
 * recorded in drizzle.__drizzle_migrations (same bookkeeping as drizzle-orm's migrator, so the
 * two stay compatible). Admin-triggered only.
 */
import { createHash } from "node:crypto";
import postgres from "postgres";

import journal from "../../../drizzle/migrations/meta/_journal.json";

const files = import.meta.glob("../../../drizzle/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export async function runPendingMigrations(url = process.env["DATABASE_URL"]): Promise<string[]> {
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
  const applied: string[] = [];
  try {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );
    const done = await sql.unsafe<{ created_at: string }[]>(
      `SELECT created_at FROM drizzle.__drizzle_migrations`,
    );
    const seen = new Set(done.map((r) => Number(r.created_at)));
    for (const entry of journal.entries) {
      if (seen.has(entry.when)) continue;
      const key = Object.keys(files).find((k) => k.endsWith(`/${entry.tag}.sql`));
      if (!key) throw new Error(`missing migration file ${entry.tag}`);
      const text = files[key]!;
      const hash = createHash("sha256").update(text).digest("hex");
      await sql.begin(async (tx) => {
        for (const stmt of text.split("--> statement-breakpoint")) {
          if (stmt.trim()) await tx.unsafe(stmt);
        }
        await tx.unsafe(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [
          hash,
          entry.when,
        ]);
      });
      applied.push(entry.tag);
    }
  } finally {
    await sql.end();
  }
  return applied;
}
