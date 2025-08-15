CREATE TABLE "auth0_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"auth0_id" text NOT NULL,
	CONSTRAINT "auth0_ids_auth0_id_unique" UNIQUE("auth0_id")
);
--> statement-breakpoint
ALTER TABLE "auth0_ids" ADD CONSTRAINT "auth0_ids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
