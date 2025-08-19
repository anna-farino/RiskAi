import { pgTable, text, serial, timestamp, pgPolicy } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const dbHealthCheck = pgTable("db_health_check", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  checkName: text("check_name").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  pgPolicy("db_health_check_rls", {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`user_id::text = current_setting('app.current_user_id', true)`,
    withCheck: sql`user_id::text = current_setting('app.current_user_id', true)`,
  }),
]);

export const insertDbHealthCheckSchema = createInsertSchema(dbHealthCheck);
export type DbHealthCheck = typeof dbHealthCheck.$inferSelect;
export type InsertDbHealthCheck = z.infer<typeof insertDbHealthCheckSchema>;