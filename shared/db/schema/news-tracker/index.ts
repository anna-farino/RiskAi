import { pgTable, text, serial, integer, boolean, timestamp, jsonb, interval, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../user";


export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  includeInAutoScrape: boolean("includeinautoscrape").notNull().default(true),
  scrapingConfig: jsonb("scraping_config"),
  lastScraped: timestamp("last_scraped"),
  userId: uuid("user_id").references(() => users.id),
});

export const keywords = pgTable("keywords", {
  id: uuid("id").defaultRandom().primaryKey(),
  term: text("term").notNull(),
  active: boolean("active").notNull().default(true),
  userId: uuid("user_id").references(() => users.id),
});

export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url").notNull(),
  author: text("author"),
  publishDate: timestamp("publish_date"),
  summary: text("summary"),
  relevanceScore: integer("relevance_score"),
  detectedKeywords: jsonb("detected_keywords"),
  userId: uuid("user_id").references(() => users.id),
});

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
});


export const insertSourceSchema = z.object({
  url: z.string(),
  name: z.string(),
  userId: z.string().optional(),
});

export const insertKeywordSchema = z.object({
  term: z.string(),
  userId: z.string().optional(),
});

export const insertArticleSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  author: z.string().optional(),
  publishDate: z.date().optional(),
  summary: z.string().optional(),
  relevanceScore: z.number().optional(),
  detectedKeywords: z.array(z.any()).optional(),
  userId: z.string().optional(),
})

export const insertSettingSchema = createInsertSchema(settings)
  .pick({
    key: true,
    value: true,
    userId: true,
  })


export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

