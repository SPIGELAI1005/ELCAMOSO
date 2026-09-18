import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgresql://elcamoso:elcamoso_dev@localhost:5432/elcamoso_dev",
  },
  strict: true,
  verbose: true,
});
