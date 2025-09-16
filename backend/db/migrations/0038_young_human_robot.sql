CREATE TABLE "devs_allowed_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"notes" text,
	CONSTRAINT "devs_allowed_logs_email_unique" UNIQUE("email")
);
