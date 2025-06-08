ALTER TABLE "threat_articles" DROP CONSTRAINT "threat_articles_source_id_threat_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "threat_articles" ADD CONSTRAINT "threat_articles_source_id_threat_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."threat_sources"("id") ON DELETE set null ON UPDATE no action;