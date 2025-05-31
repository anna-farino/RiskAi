CREATE TABLE "puppeteer_job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"status" text NOT NULL,
	"user_id" uuid,
	"source_app" text,
	"input_data" jsonb NOT NULL,
	"output_data" jsonb,
	"run_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "capsule_articles" ALTER COLUMN "target_os" SET DEFAULT 'Unspecified';--> statement-breakpoint
ALTER TABLE "puppeteer_job_queue" ADD CONSTRAINT "puppeteer_job_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;