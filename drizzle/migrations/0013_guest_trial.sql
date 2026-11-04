CREATE TABLE IF NOT EXISTS "guest_trial_usage" (
	"ip_hash" text NOT NULL,
	"day" text NOT NULL,
	"used_seconds" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guest_trial_usage_hash_day_unique" ON "guest_trial_usage" USING btree ("ip_hash","day");
