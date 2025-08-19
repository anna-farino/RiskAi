CREATE TABLE "global_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"url" text NOT NULL,
	"author" text,
	"publish_date" timestamp,
	"summary" text,
	"is_cybersecurity" boolean DEFAULT false,
	"security_score" integer,
	"threat_categories" jsonb,
	"scraped_at" timestamp DEFAULT now(),
	"last_analyzed_at" timestamp,
	"analysis_version" text,
	"detected_keywords" jsonb,
	CONSTRAINT "global_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "global_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"priority" integer DEFAULT 50,
	"scraping_config" jsonb,
	"last_scraped" timestamp,
	"last_successful_scrape" timestamp,
	"consecutive_failures" integer DEFAULT 0,
	"added_at" timestamp DEFAULT now(),
	"added_by" uuid,
	CONSTRAINT "global_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "user_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"app_context" text NOT NULL,
	"term" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_keywords_user_id_app_context_term_unique" UNIQUE("user_id","app_context","term")
);
--> statement-breakpoint
CREATE TABLE "user_source_preferences" (
	"user_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"app_context" text NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"enabled_at" timestamp DEFAULT now(),
	CONSTRAINT "user_source_preferences_user_id_source_id_app_context_pk" PRIMARY KEY("user_id","source_id","app_context")
);
--> statement-breakpoint
ALTER TABLE "global_articles" ADD CONSTRAINT "global_articles_source_id_global_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."global_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_source_preferences" ADD CONSTRAINT "user_source_preferences_source_id_global_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."global_sources"("id") ON DELETE no action ON UPDATE no action;