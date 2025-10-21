CREATE TABLE "stripe_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"stripe_customer_id" text NOT NULL,
	"email" text NOT NULL,
	"metadata" jsonb,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "check_one_entity" CHECK ((
        ("stripe_customers"."user_id" IS NOT NULL AND "stripe_customers"."organization_id" IS NULL) OR
        ("stripe_customers"."user_id" IS NULL AND "stripe_customers"."organization_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"processing_error" text,
	"retry_count" integer DEFAULT 0,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "subs_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME TO "subs_organization";--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_current_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "subs_organization" DROP CONSTRAINT "subscriptions_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "subs_organization" DROP CONSTRAINT "subscriptions_tier_id_subscription_tiers_id_fk";
--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subs_user" ADD CONSTRAINT "subs_user_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subs_user" ADD CONSTRAINT "subs_user_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_current_subscription_id_subs_organization_id_fk" FOREIGN KEY ("current_subscription_id") REFERENCES "public"."subs_organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subs_organization" ADD CONSTRAINT "subs_organization_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subs_organization" ADD CONSTRAINT "subs_organization_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;