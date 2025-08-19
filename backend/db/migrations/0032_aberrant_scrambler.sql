CREATE TABLE "db_health_check" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"check_name" text NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "db_health_check" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "db_health_check_rls" ON "db_health_check" AS PERMISSIVE FOR ALL TO public USING (user_id::text = current_setting('app.current_user_id', true)) WITH CHECK (user_id::text = current_setting('app.current_user_id', true));