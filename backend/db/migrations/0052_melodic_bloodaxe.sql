CREATE TYPE "public"."account_status" AS ENUM('active', 'pending_deletion', 'deleted');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "account_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_deleted_at" timestamp;