CREATE TYPE "public"."app_type" AS ENUM('news-radar', 'threat-tracker', 'news-capsule');--> statement-breakpoint
CREATE TYPE "public"."error_type" AS ENUM('network', 'parsing', 'ai', 'puppeteer', 'timeout', 'auth', 'unknown');--> statement-breakpoint
CREATE TABLE "scraping_error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_id" text,
	"source_url" text NOT NULL,
	"app_type" "app_type" NOT NULL,
	"article_url" text,
	"error_type" "error_type" NOT NULL,
	"error_message" text NOT NULL,
	"error_details" jsonb,
	"scraping_method" text NOT NULL,
	"extraction_step" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"retry_count" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "scraping_error_logs" ADD CONSTRAINT "scraping_error_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat_sources" DROP COLUMN "active";