CREATE INDEX "idx_companies_name_lower" ON "companies" USING btree (LOWER("name"));--> statement-breakpoint
CREATE INDEX "idx_companies_type" ON "companies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_hardware_name_lower" ON "hardware" USING btree (LOWER("name"));--> statement-breakpoint
CREATE INDEX "idx_software_name_lower" ON "software" USING btree (LOWER("name"));--> statement-breakpoint
CREATE INDEX "idx_software_name_company" ON "software" USING btree (LOWER("name"),"company_id");--> statement-breakpoint
CREATE INDEX "idx_users_companies_lookup" ON "users_companies" USING btree ("user_id","company_id","relationship_type");--> statement-breakpoint
CREATE INDEX "idx_users_companies_active" ON "users_companies" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_users_hardware_lookup" ON "users_hardware" USING btree ("user_id","hardware_id");--> statement-breakpoint
CREATE INDEX "idx_users_hardware_active" ON "users_hardware" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_users_software_lookup" ON "users_software" USING btree ("user_id","software_id");--> statement-breakpoint
CREATE INDEX "idx_users_software_active" ON "users_software" USING btree ("user_id","is_active");