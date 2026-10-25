CREATE TABLE IF NOT EXISTS "smile_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"sound" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "smile_ledger_user_reason_ref_uq" ON "smile_ledger" ("user_id","reason","ref") WHERE "ref" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "smile_ledger_user_created_idx" ON "smile_ledger" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "smile_ledger_created_idx" ON "smile_ledger" ("created_at");
--> statement-breakpoint
ALTER TABLE "smile_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smile_total" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smile_level" text DEFAULT 'Cruiser' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smile_handle" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smile_ref_code" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_smile_ref_code_uq" ON "users" ("smile_ref_code") WHERE "smile_ref_code" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "smile_referred_by" text;
