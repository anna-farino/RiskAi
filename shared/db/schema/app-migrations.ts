import { pgTable, serial, varchar, timestamp, text, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Migration status enum
export const migrationStatusEnum = pgEnum("migration_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

// App migrations table to track one-time migrations
export const appMigrations = pgTable("app_migrations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(), // Unique migration name
  status: migrationStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  retries: integer("retries").notNull().default(0),
  errorMessage: text("error_message"),
  result: text("result"), // JSON string of migration results/stats
});

// Types
export type AppMigration = typeof appMigrations.$inferSelect;
export type InsertAppMigration = typeof appMigrations.$inferInsert;

// Schemas
export const insertAppMigrationSchema = createInsertSchema(appMigrations);
export type InsertAppMigrationInput = z.infer<typeof insertAppMigrationSchema>;