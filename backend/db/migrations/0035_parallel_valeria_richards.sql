ALTER TABLE "keywords" ADD COLUMN "wrapped_dek" text;--> statement-breakpoint
ALTER TABLE "keywords" ADD COLUMN "key_id" text;--> statement-breakpoint
ALTER TABLE "user_keywords" DROP COLUMN "wrapped_dek";--> statement-breakpoint
ALTER TABLE "user_keywords" DROP COLUMN "key_id";