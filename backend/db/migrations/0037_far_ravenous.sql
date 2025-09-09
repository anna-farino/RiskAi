CREATE TABLE "scheduler_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduler_name" text NOT NULL,
	"last_successful_run" timestamp,
	"last_attempted_run" timestamp,
	"consecutive_failures" integer DEFAULT 0,
	"is_running" boolean DEFAULT false,
	"next_scheduled_run" timestamp,
	"metadata" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "scheduler_metadata_scheduler_name_unique" UNIQUE("scheduler_name")
);
--> statement-breakpoint
ALTER TABLE "threat_keywords" ADD COLUMN "wrapped_dek_term" text;--> statement-breakpoint
ALTER TABLE "threat_keywords" ADD COLUMN "key_id_term" text;