import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

export type Db = PostgresJsDatabase<typeof schema>;

let sqlClient: postgres.Sql | null = null;
let dbInstance: Db | null = null;
let overrideDb: Db | null = null;

/** Tests only: route getDb() to an injected database (e.g. PGlite). Pass null to clear. */
export function setDbOverrideForTests(db: unknown): void {
  overrideDb = (db as Db | null) ?? null;
}

/** Server-only Postgres client. Requires DATABASE_URL. */
export function getDb(connectionString = process.env["DATABASE_URL"]): Db {
  if (overrideDb) return overrideDb;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database access");
  }
  if (!sqlClient) {
    // prepare:false keeps Supabase/PgBouncer transaction pooling (port 6543) working.
    sqlClient = postgres(connectionString, { max: 1, prepare: false });
  }
  if (!dbInstance) {
    dbInstance = drizzle(sqlClient, { schema });
  }
  return dbInstance;
}

/** Close the pooled connection (tests and scripts). */
export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    dbInstance = null;
  }
}
