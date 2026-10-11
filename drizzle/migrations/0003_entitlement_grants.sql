-- Prompt 11: user-owned entitlement / profile grants (additive).
-- Clients may read their rows via authenticated server functions; they cannot
-- INSERT/UPDATE premium grants from the browser. Application code is the
-- authorization boundary (equivalent to RLS for this stack).

CREATE TYPE "public"."entitlement_grant_kind" AS ENUM(
  'purchased_profile',
  'grandfathered_profile',
  'reward_profile',
  'reward_entitlement'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entitlement_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" "entitlement_grant_kind" NOT NULL,
  "profile_id" text,
  "entitlement" text,
  "expires_at" timestamp with time zone,
  "source" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlement_grants"
  ADD CONSTRAINT "entitlement_grants_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entitlement_grants_user_profile_kind_unique"
  ON "entitlement_grants" ("user_id", "kind", "profile_id")
  WHERE "profile_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entitlement_grants_user_entitlement_kind_unique"
  ON "entitlement_grants" ("user_id", "kind", "entitlement")
  WHERE "entitlement" IS NOT NULL;
