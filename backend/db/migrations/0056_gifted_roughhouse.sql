ALTER TABLE "global_articles" ADD COLUMN "extracted_facts" jsonb;--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "facts_extraction_version" text;