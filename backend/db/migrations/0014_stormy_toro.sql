CREATE TABLE "threat_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"url" text NOT NULL,
	"author" text,
	"publish_date" timestamp,
	"summary" text,
	"relevance_score" text,
	"detected_keywords" jsonb,
	"scrape_date" timestamp DEFAULT now(),
	"user_id" uuid,
	"marked_for_capsule" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "threat_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"category" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "threat_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"user_id" uuid,
	CONSTRAINT "threat_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "threat_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"includeinautoscrape" boolean DEFAULT true NOT NULL,
	"scraping_config" jsonb,
	"last_scraped" timestamp,
	"user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "threat_articles" ADD CONSTRAINT "threat_articles_source_id_threat_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."threat_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat_articles" ADD CONSTRAINT "threat_articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat_keywords" ADD CONSTRAINT "threat_keywords_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat_settings" ADD CONSTRAINT "threat_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat_sources" ADD CONSTRAINT "threat_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
