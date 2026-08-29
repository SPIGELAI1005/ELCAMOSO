CREATE TYPE "public"."dynamic_drive_trial_session_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."dynamic_drive_trial_status" AS ENUM('available', 'active', 'exhausted', 'expired', 'converted');--> statement-breakpoint
CREATE TABLE "dynamic_drive_trial_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"drive_session_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_heartbeat_at" timestamp with time zone NOT NULL,
	"last_credited_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"credited_seconds" integer DEFAULT 0 NOT NULL,
	"status" "dynamic_drive_trial_session_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_drive_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"allocated_seconds" integer DEFAULT 1800 NOT NULL,
	"used_seconds" integer DEFAULT 0 NOT NULL,
	"allocated_sessions" integer DEFAULT 3 NOT NULL,
	"used_sessions" integer DEFAULT 0 NOT NULL,
	"status" "dynamic_drive_trial_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dynamic_drive_trial_sessions" ADD CONSTRAINT "dynamic_drive_trial_sessions_trial_id_dynamic_drive_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."dynamic_drive_trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_drive_trial_sessions" ADD CONSTRAINT "dynamic_drive_trial_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_drive_trials" ADD CONSTRAINT "dynamic_drive_trials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dynamic_drive_trial_sessions_drive_unique" ON "dynamic_drive_trial_sessions" USING btree ("trial_id","drive_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dynamic_drive_trials_user_unique" ON "dynamic_drive_trials" USING btree ("user_id");