/**
 * Vercel build hook: apply Drizzle migrations when DATABASE_URL is set on a production build.
 * Never fails the build (the app degrades gracefully without the DB); logs the outcome.
 * Prefers DATABASE_URL_DIRECT / POSTGRES_URL_NON_POOLING when present.
 */
const url =
  process.env.DATABASE_URL_DIRECT || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const enabled =
  url && /^postgres(ql)?:\/\//.test(url) && (process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_BUILD === "1");
if (!enabled) {
  console.log("[migrate-on-build] skipped (no DATABASE_URL or not a production build)");
  process.exit(0);
}
try {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle/migrations" });
    const rows = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
    console.log(`[migrate-on-build] ok, ${rows[0].n} public tables`);
  } finally {
    await sql.end();
  }
} catch (e) {
  console.error("[migrate-on-build] FAILED (build continues):", e instanceof Error ? e.message : e);
}
