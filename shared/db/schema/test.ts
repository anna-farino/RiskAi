import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Define the replit_test table schema
export const replitTest = pgTable("replit_test", {
  x: integer("x"),
});

// Create insert schema for validation
export const insertReplitTestSchema = createInsertSchema(replitTest);

// Export types
export type ReplitTest = typeof replitTest.$inferSelect;
export type InsertReplitTest = typeof insertReplitTestSchema._type;