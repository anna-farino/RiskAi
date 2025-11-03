CREATE TYPE "public"."billingPeriod" AS ENUM('monthly', 'yearly');--> statement-breakpoint
ALTER TABLE "subscription_tiers" ADD COLUMN "billingPeriod" "billingPeriod";