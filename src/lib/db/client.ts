import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

export type Db = PostgresJsDatabase<typeof schema>;

let sqlClient: postgres.Sql | null = null;
let dbInstance: Db | null = null;

/** Server-only Postgres client. Requires DATABASE_URL. */
export function getDb(connectionString = process.env["DATABASE_URL"]): Db {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database access");
  }
  if (!sqlClient) {
    sqlClient = postgres(connectionString, { max: 1 });
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
