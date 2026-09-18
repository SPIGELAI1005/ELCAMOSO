/**
 * Apply Drizzle migrations — development only.
 * Usage: npm run db:migrate:dev
 *
 * DATABASE_URL:
 * - postgresql://… — standard Postgres (docker compose or hosted)
 * - idb://elcamoso-dev — embedded PGlite (default when unset)
 */
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const env = process.env.ELCAMOSO_ENV ?? "development";
if (env !== "development") {
  console.error(`Refusing to migrate: ELCAMOSO_ENV=${env} (development only).`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
/** Default dev store when DATABASE_URL is unset — PGlite, not production. */
const resolvedUrl = databaseUrl ?? "idb://elcamoso-dev";
const isPglite = !resolvedUrl.startsWith("postgresql://") && !resolvedUrl.startsWith("postgres://");

async function migratePostgres(url) {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  } finally {
    await sql.end();
  }
}

async function migratePglite(dataDir) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await mkdir(dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await client.close();
}

try {
  if (isPglite) {
    const dataDir = resolvedUrl.replace(/^idb:\/\//, ".data/") || ".data/elcamoso-dev";
    console.log(`Applying migrations to PGlite dev store (${dataDir})…`);
    await migratePglite(dataDir);
  } else {
    console.log(`Applying migrations to ${resolvedUrl.replace(/:[^:@/]+@/, ":***@")}…`);
    await migratePostgres(resolvedUrl);
  }
  console.log("Migrations applied.");
} catch (error) {
  console.error(error);
  process.exit(1);
}
