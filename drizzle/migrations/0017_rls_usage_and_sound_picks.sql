-- These tables are only used by the server via DATABASE_URL (table owner, bypasses RLS).
-- Enabling RLS with no policies blocks the Supabase anon/authenticated Data API roles.
ALTER TABLE "guest_trial_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "drive_special_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "founder_sound_picks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  REVOKE ALL ON public.guest_trial_usage FROM anon, authenticated;
  REVOKE ALL ON public.drive_special_usage FROM anon, authenticated;
  REVOKE ALL ON public.founder_sound_picks FROM anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
