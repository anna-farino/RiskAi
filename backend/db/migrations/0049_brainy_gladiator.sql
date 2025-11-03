ALTER TABLE "global_sources" ADD COLUMN "required_tier_level" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_tiers" ADD COLUMN "tier_level" integer DEFAULT 0 NOT NULL;
