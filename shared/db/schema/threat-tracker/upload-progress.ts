import {
  pgTable,
  varchar,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Progress status enum
export const uploadStatusEnum = pgEnum("upload_status", [
  "initializing",
  "validating",
  "parsing",
  "extracting",
  "importing",
  "completed",
  "failed",
]);

// Progress metadata type
export type ProgressMetadata = {
  filename: string;
  fileSize: number;
  totalRows?: number;
  processedRows?: number;
  extractedEntities?: number;
  importedEntities?: number;
  failedRows?: Array<{
    row: number;
    reason: string;
  }>;
  warnings?: string[];
  startTime: number;
  lastUpdate: number;
};

// Upload progress tracking table
export const uploadProgress = pgTable("threat_tracker_upload_progress", {
  id: varchar("id").primaryKey().default("gen_random_uuid()"),
  userId: integer("user_id").notNull(),
  status: uploadStatusEnum("status").notNull().default("initializing"),
  phase: varchar("phase").notNull().default("starting"),
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  metadata: jsonb("metadata").$type<ProgressMetadata>(),
  error: varchar("error"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Zod schemas for validation
export const insertUploadProgressSchema = createInsertSchema(uploadProgress);
export type InsertUploadProgress = z.infer<typeof insertUploadProgressSchema>;
export type UploadProgress = typeof uploadProgress.$inferSelect;