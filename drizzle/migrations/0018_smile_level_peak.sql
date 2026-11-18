ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smile_level_peak" text;
--> statement-breakpoint
UPDATE "users" SET "smile_level_peak" = "smile_level" WHERE "smile_level_peak" IS NULL;
