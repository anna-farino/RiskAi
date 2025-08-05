ALTER TABLE "keywords" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "threat_keywords" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "keywords-rls" ON "keywords" AS PERMISSIVE FOR ALL TO public WITH CHECK (user_id::text = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "rls-reports" ON "reports" AS PERMISSIVE FOR ALL TO public WITH CHECK (user_id::text = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "rls-threat-keywords" ON "threat_keywords" AS PERMISSIVE FOR ALL TO public WITH CHECK (user_id::text = current_setting('app.current_user_id', true));