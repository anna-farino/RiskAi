CREATE TABLE "capsule_articles_in_reports" (
	"article_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	CONSTRAINT "capsule_articles_in_reports_article_id_report_id_pk" PRIMARY KEY("article_id","report_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE IF EXISTS "threat_articles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "threat_keywords" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "threat_settings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "threat_sources" CASCADE;--> statement-breakpoint
ALTER TABLE "capsule_articles_in_reports" ADD CONSTRAINT "capsule_articles_in_reports_article_id_capsule_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."capsule_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capsule_articles_in_reports" ADD CONSTRAINT "capsule_articles_in_reports_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
