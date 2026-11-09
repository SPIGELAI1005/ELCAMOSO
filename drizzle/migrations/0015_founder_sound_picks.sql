CREATE TABLE IF NOT EXISTS "founder_sound_picks" (
	"account_id" text NOT NULL,
	"sound_id" text NOT NULL,
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "founder_sound_picks_account_id_sound_id_pk" PRIMARY KEY("account_id","sound_id")
);
