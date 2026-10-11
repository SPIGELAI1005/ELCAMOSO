-- Prompt 13: extend discount reservation lifecycle for Stripe apply/consume.

ALTER TYPE "public"."discount_reservation_status" ADD VALUE IF NOT EXISTS 'applied';
--> statement-breakpoint
ALTER TYPE "public"."discount_reservation_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."discount_reservation_status" ADD VALUE IF NOT EXISTS 'ineligible';
--> statement-breakpoint
ALTER TYPE "public"."discount_reservation_status" ADD VALUE IF NOT EXISTS 'failed';
--> statement-breakpoint
ALTER TABLE "reward_discount_reservations"
  ADD COLUMN IF NOT EXISTS "discount_case" text,
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_coupon_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_invoice_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_discount_id" text,
  ADD COLUMN IF NOT EXISTS "apply_idempotency_key" text,
  ADD COLUMN IF NOT EXISTS "last_error" text,
  ADD COLUMN IF NOT EXISTS "ineligible_reason" text,
  ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "consumed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "expected_subtotal_cents" integer,
  ADD COLUMN IF NOT EXISTS "expected_discount_amount_cents" integer,
  ADD COLUMN IF NOT EXISTS "expected_invoice_total_cents" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reward_discount_reservations_apply_idem_unique"
  ON "reward_discount_reservations" ("apply_idempotency_key")
  WHERE "apply_idempotency_key" IS NOT NULL;
