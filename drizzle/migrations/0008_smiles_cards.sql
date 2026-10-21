CREATE TABLE IF NOT EXISTS "smiles_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "journey_id" text NOT NULL,
  "profile_id" text NOT NULL,
  "profile_name" text NOT NULL,
  "score" integer NOT NULL,
  "distance_km" real NOT NULL,
  "result" jsonb NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "smiles_cards_user_journey_uq" ON "smiles_cards" ("user_id", "journey_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "smiles_cards_user_created_idx" ON "smiles_cards" ("user_id", "created_at");
--> statement-breakpoint
ALTER TABLE "smiles_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  -- Server (DATABASE_URL owner) scopes every query by the verified user id.
  -- Data API roles get nothing; if Supabase auth ids are ever used, this policy limits rows to the owner.
  REVOKE ALL ON public.smiles_cards FROM anon, authenticated;
  EXECUTE 'CREATE POLICY smiles_cards_owner ON public.smiles_cards FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text)';
EXCEPTION WHEN undefined_object OR undefined_function OR invalid_schema_name OR duplicate_object THEN
  NULL;
END $$;
