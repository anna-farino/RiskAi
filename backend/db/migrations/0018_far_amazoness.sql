ALTER TABLE "capsule_articles" ALTER COLUMN "target_os" SET DEFAULT 'Unspecified';--> statement-breakpoint
ALTER TABLE "threat_sources" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;