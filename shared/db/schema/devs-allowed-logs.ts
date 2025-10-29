import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from 'drizzle-orm';
import { users } from "./user";

/**
 * Developer permissions for accessing live server logs
 * Only developers with userId in this table can view real-time logs via WebSocket
 * This table is only effective when NODE_ENV=staging
 */
export const devsAllowedLogs = pgTable("devs_allowed_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id), // References users.id
  email: text("email").notNull(), // Kept for display/audit purposes (not unique anymore)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by_user_id").notNull().references(() => users.id), // User ID of who added this
  notes: text("notes") // Optional notes about why this dev was granted access
});

// Relations
export const devsAllowedLogsRelations = relations(devsAllowedLogs, ({ one }) => ({
  user: one(users, {
    fields: [devsAllowedLogs.userId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [devsAllowedLogs.createdBy],
    references: [users.id],
  })
}));

// Zod schema for validation
export const insertDevAllowedLogsSchema = createInsertSchema(devsAllowedLogs).omit({
  id: true,
  createdAt: true
});

// TypeScript types
export type DevAllowedLogs = typeof devsAllowedLogs.$inferSelect;
export type InsertDevAllowedLogs = typeof insertDevAllowedLogsSchema._type;

/**
 * Utility function to check if an email is allowed to view logs
 * This will be used in the WebSocket middleware
 */
export const isDevAllowedLogs = async (email: string): Promise<boolean> => {
  // This function will be implemented in the backend service layer
  // Here we just define the type signature for now
  return false;
};