CREATE TABLE "stripe_operations_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"request_payload" jsonb,
	"webhook_received" boolean DEFAULT false,
	"webhook_timestamp" timestamp,
	"webhook_event_id" text,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"verification_timestamp" timestamp,
	"verification_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_operations_log" ADD CONSTRAINT "stripe_operations_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;