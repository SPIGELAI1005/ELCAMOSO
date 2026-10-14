DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'user' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_sessions_user_id_idx" ON "account_sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" text NOT NULL,
  "admin_email" text NOT NULL,
  "action" text NOT NULL,
  "target" text,
  "before" jsonb,
  "after" jsonb,
  "at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_at_idx" ON "admin_audit_log" ("at");
--> statement-breakpoint
UPDATE "users" SET "role" = 'admin' WHERE lower("email") = 'george.m.neacsu@googlemail.com';
