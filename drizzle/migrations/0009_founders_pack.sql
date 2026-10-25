ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "founder_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_founder_at_idx" ON "users" ("founder_at") WHERE "founder_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "founder_seat" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_founder_seat_uq" ON "users" ("founder_seat") WHERE "founder_seat" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "test_crew_opt_in" boolean DEFAULT false NOT NULL;
