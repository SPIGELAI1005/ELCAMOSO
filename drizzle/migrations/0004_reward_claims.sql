-- Prompt 12: monthly Sound Spin claims, discount reservations, cockpit themes.
-- Application code enforces auth scoping; UNIQUE constraints enforce one claim
-- per account/campaign/UTC period under concurrent requests.

CREATE TYPE "public"."reward_fulfilment_status" AS ENUM(
  'pending',
  'fulfilled',
  'failed',
  'disabled'
);
--> statement-breakpoint
CREATE TYPE "public"."reward_outcome_kind" AS ENUM(
  'sound_48h',
  'sound_pack_7d',
  'cockpit_theme',
  'one_payment_discount',
  'full_library_weekend'
);
--> statement-breakpoint
CREATE TYPE "public"."reward_audience" AS ENUM('free', 'paid');
--> statement-breakpoint
CREATE TYPE "public"."discount_reservation_status" AS ENUM(
  'reserved',
  'consumed',
  'expired'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_campaigns" (
  "campaign_id" text PRIMARY KEY NOT NULL,
  "config_version" integer NOT NULL,
  "title" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "staging_illustrative_only" boolean DEFAULT true NOT NULL,
  "period_strategy" text DEFAULT 'utc_calendar_month' NOT NULL,
  "config_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_claims" (
  "claim_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "campaign_id" text NOT NULL,
  "config_version" integer NOT NULL,
  "period_key" text NOT NULL,
  "audience" "reward_audience" NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "reward_fulfilment_status" DEFAULT 'pending' NOT NULL,
  "outcome_kind" "reward_outcome_kind" NOT NULL,
  "outcome_reward_id" text NOT NULL,
  "outcome_json" jsonb NOT NULL,
  "fulfilment_attempts" integer DEFAULT 0 NOT NULL,
  "last_fulfilment_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."reward_campaigns"("campaign_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reward_claims_user_campaign_period_unique"
  ON "reward_claims" ("user_id", "campaign_id", "period_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reward_claims_user_campaign_period_idem_unique"
  ON "reward_claims" ("user_id", "campaign_id", "period_key", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_claims_user_id_idx"
  ON "reward_claims" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_discount_reservations" (
  "reservation_id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "discount_percent" integer NOT NULL,
  "status" "discount_reservation_status" DEFAULT 'reserved' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_discount_reservations"
  ADD CONSTRAINT "reward_discount_reservations_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reward_discount_reservations"
  ADD CONSTRAINT "reward_discount_reservations_claim_id_fkey"
  FOREIGN KEY ("claim_id") REFERENCES "public"."reward_claims"("claim_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reward_discount_reservations_claim_unique"
  ON "reward_discount_reservations" ("claim_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_cockpit_themes" (
  "user_id" uuid NOT NULL,
  "theme_id" text NOT NULL,
  "claim_id" uuid,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "theme_id")
);
--> statement-breakpoint
ALTER TABLE "reward_cockpit_themes"
  ADD CONSTRAINT "reward_cockpit_themes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
