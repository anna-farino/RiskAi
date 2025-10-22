ALTER TABLE "subscription_tiers" RENAME COLUMN "features" TO "metadata";--> statement-breakpoint
ALTER TABLE "subscription_tiers" DROP COLUMN "max_api_calls";--> statement-breakpoint
ALTER TABLE "subscription_tiers" DROP COLUMN "sort_order";