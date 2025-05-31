import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../user";

export const capsuleArticles = pgTable("capsule_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  threatName: text("threat_name").notNull(),
  vulnerabilityId: text("vulnerability_id").default("Unspecified").notNull(),
  summary: text("summary").notNull(),
  impacts: text("impacts").notNull(),
  attackVector: text("attack_vector").default("Unknown attack vector").notNull(),
  microsoftConnection: text("microsoft_connection").notNull(),
  sourcePublication: text("source_publication").notNull(),
  originalUrl: text("original_url").notNull(),
  targetOS: text("target_os").default("Unspecified").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  markedForReporting: boolean("marked_for_reporting").default(true).notNull(),
  markedForDeletion: boolean("marked_for_deletion").default(false).notNull(),
  sourceApp: text("source_app").default("manual").notNull(), // Track which app sent this article
  userId: uuid("user_id").notNull().references(() => users.id),
});

const fullInsert = createInsertSchema(capsuleArticles);

// pick only the keys you actually insert
export const insertCapsuleArticleSchema = z.object({
  title: z.string(),
  threatName: z.string(),
  vulnerabilityId: z.string().default("Unspecified"),
  summary: z.string(),
  impacts: z.string(),
  attackVector: z.string().default("Unknown attack vector"),
  microsoftConnection: z.string(),
  sourcePublication: z.string(),
  originalUrl: z.string(),
  targetOS: z.string().default("Unspecified"),
  markedForReporting: z.boolean().default(true),
  markedForDeletion: z.boolean().default(false),
  sourceApp: z.string().default("manual"),
  userId: z.string().uuid(),
});

export type InsertCapsuleArticle = z.infer<typeof insertCapsuleArticleSchema>;
export type CapsuleArticle = typeof capsuleArticles.$inferSelect;

