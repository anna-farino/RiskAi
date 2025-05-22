import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "./user";

export const scrapedArticles = pgTable("scraped_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  threatName: text("threat_name").notNull(),
  summary: text("summary").notNull(),
  impacts: text("impacts").notNull(),
  osConnection: text("os_connection").notNull(),
  source: text("source").notNull(),
  originalUrl: text("original_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
});

// Create a manual insert schema to avoid issues with drizzle-zod's createInsertSchema
export const insertScrapedArticleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string(),
  threatName: z.string(),
  summary: z.string(),
  impacts: z.string(),
  osConnection: z.string(),
  source: z.string(),
  originalUrl: z.string(),
  createdAt: z.date().optional(),
  userId: z.string().uuid(),
});

export type InsertScrapedArticle = z.infer<typeof insertScrapedArticleSchema>;
export type ScrapedArticle = typeof scrapedArticles.$inferSelect;