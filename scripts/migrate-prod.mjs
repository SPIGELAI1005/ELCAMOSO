/**
 * Apply Drizzle migrations to a hosted Postgres (Supabase / Neon) - run once per new migration.
 * Usage:
 *   DATABASE_URL='postgresql://...' CONFIRM_PRODUCTION_MIGRATE=yes npm run db:migrate:prod
 * Use the direct / session connection string (port 5432) for migrations, not the 6543 pooler.
 */
const url = process.env.DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error("Set DATABASE_URL to a postgresql:// connection string.");
  process.exit(1);
}
if (process.env.CONFIRM_PRODUCTION_MIGRATE !== "yes") {
  console.error("Refusing to migrate: set CONFIRM_PRODUCTION_MIGRATE=yes to confirm.");
  process.exit(1);
}
const { drizzle } = await import("drizzle-orm/postgres-js");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const postgres = (await import("postgres")).default;
const sql = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle/migrations" });
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  console.log("Migrations applied. Tables:", rows.map((r) => r.table_name).join(", "));
} finally {
  await sql.end();
}
