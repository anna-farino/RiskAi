import { pgTable, text, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../user";

// Source websites to scrape for threats
export const threatSources = pgTable("threat_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  includeInAutoScrape: boolean("includeinautoscrape").notNull().default(true),
  scrapingConfig: jsonb("scraping_config"),
  lastScraped: timestamp("last_scraped"),
  userId: uuid("user_id").references(() => users.id),
  isDefault: boolean("is_default").notNull().default(false),
});

// Different keyword categories for threats
export const threatKeywords = pgTable("threat_keywords", {
  id: uuid("id").defaultRandom().primaryKey(),
  term: text("term").notNull(),
  category: text("category").notNull(), // 'threat', 'vendor', 'client', or 'hardware'
  active: boolean("active").notNull().default(true),
  userId: uuid("user_id").references(() => users.id),
  isDefault: boolean("is_default").notNull().default(false),
});

// Identified threats from articles
export const threatArticles = pgTable("threat_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => threatSources.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url").notNull(),
  author: text("author"),
  publishDate: timestamp("publish_date"),
  summary: text("summary"),
  relevanceScore: text("relevance_score"),
  securityScore: text("security_score"),
  // Detected keywords will be stored as JSON with category information
  detectedKeywords: jsonb("detected_keywords"), // { threats: [], vendors: [], clients: [], hardware: [] }
  scrapeDate: timestamp("scrape_date").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
  // Flag for sending to News Capsule
  markedForCapsule: boolean("marked_for_capsule").default(false),
});

// Additional settings for the Threat Tracker
export const threatSettings = pgTable("threat_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  userId: uuid("user_id").references(() => users.id),
});

// Schema for inserting a new threat source
export const insertThreatSourceSchema = createInsertSchema(threatSources)
  .omit({ id: true });

// Type for inserting a new threat source
export type InsertThreatSource = z.infer<typeof insertThreatSourceSchema>;
// Type for a threat source record
export type ThreatSource = typeof threatSources.$inferSelect;

// Schema for inserting a new threat keyword
export const insertThreatKeywordSchema = createInsertSchema(threatKeywords)
  .omit({ id: true });

// Type for inserting a new threat keyword
export type InsertThreatKeyword = z.infer<typeof insertThreatKeywordSchema>;
// Type for a threat keyword record
export type ThreatKeyword = typeof threatKeywords.$inferSelect;

// Schema for inserting a new threat article
export const insertThreatArticleSchema = createInsertSchema(threatArticles)
  .omit({ id: true, scrapeDate: true });

// Type for inserting a new threat article
export type InsertThreatArticle = z.infer<typeof insertThreatArticleSchema>;
// Type for a threat article record
export type ThreatArticle = typeof threatArticles.$inferSelect;

// Schema for inserting a new threat setting
export const insertThreatSettingSchema = createInsertSchema(threatSettings)
  .omit({ id: true });

// Type for inserting a new threat setting
export type InsertThreatSetting = z.infer<typeof insertThreatSettingSchema>;
// Type for a threat setting record
export type ThreatSetting = typeof threatSettings.$inferSelect;
