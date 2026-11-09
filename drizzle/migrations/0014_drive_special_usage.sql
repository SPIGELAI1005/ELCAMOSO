CREATE TABLE IF NOT EXISTS "drive_special_usage" (
	"account_id" text NOT NULL,
	"day" text NOT NULL,
	"used_seconds" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "drive_special_usage_account_day_unique" ON "drive_special_usage" USING btree ("account_id","day");
