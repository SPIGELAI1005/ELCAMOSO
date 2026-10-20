ALTER TYPE "entitlement_grant_kind" ADD VALUE IF NOT EXISTS 'admin_profile';
--> statement-breakpoint
ALTER TYPE "entitlement_grant_kind" ADD VALUE IF NOT EXISTS 'admin_entitlement';
--> statement-breakpoint
ALTER TYPE "entitlement_grant_kind" ADD VALUE IF NOT EXISTS 'promo_profile';
--> statement-breakpoint
ALTER TYPE "entitlement_grant_kind" ADD VALUE IF NOT EXISTS 'promo_entitlement';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_devices" (
  "install_id" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_devices_user_id_idx" ON "account_devices" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_codes" (
  "code" text PRIMARY KEY NOT NULL,
  "profile_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "drive_plus_days" integer,
  "grant_days" integer,
  "max_redemptions" integer,
  "redemptions" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone,
  "active" boolean DEFAULT true NOT NULL,
  "note" text,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_redemptions" (
  "code" text NOT NULL REFERENCES "promo_codes"("code") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("code", "user_id")
);
--> statement-breakpoint
DO $$
DECLARE t record;
BEGIN
  -- Lock every app table against the public Supabase Data API (anon / authenticated keys).
  -- The server connects as the database owner via DATABASE_URL and bypasses RLS.
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
EXCEPTION WHEN undefined_object THEN
  -- Plain Postgres (no anon/authenticated roles): just enable RLS.
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
