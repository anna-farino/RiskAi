import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// Define the scraped articles table
export const scrapedArticles = pgTable("scraped_articles", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  title: varchar("title").notNull(),
  threatName: varchar("threat_name").notNull(),
  summary: text("summary").notNull(),
  impacts: text("impacts").notNull(),
  osConnection: text("os_connection").notNull(),
  source: varchar("source").notNull(),
  originalUrl: varchar("original_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
});

// Define a relationship between users and scraped articles
export const scrapedArticlesRelations = relations(scrapedArticles, ({ one }) => ({
  user: one(users, {
    fields: [scrapedArticles.userId],
    references: [users.id],
  }),
}));

// Define the insert schema for new scraped articles
export const insertScrapedArticleSchema = createInsertSchema(scrapedArticles)
  .omit({
    id: true,
    createdAt: true,
  });

// Export types
export type ScrapedArticle = typeof scrapedArticles.$inferSelect;
export type InsertScrapedArticle = z.infer<typeof insertScrapedArticleSchema>;