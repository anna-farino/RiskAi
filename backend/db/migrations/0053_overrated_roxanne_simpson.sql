ALTER TABLE "users_companies" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users_hardware" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users_software" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;