import { pgTable, text, boolean, timestamp, jsonb, uuid, pgPolicy } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../user";
import { sql } from "drizzle-orm";

// Source websites to scrape for threats
export const threatSources = pgTable("threat_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
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
  // Encryption metadata fields for envelope encryption
  wrappedDekTerm: text("wrapped_dek_term"),
  keyIdTerm: text("key_id_term"),
}, (_t) => [
    pgPolicy('rls-threat-keywords', {
      for: 'all',
      using: sql`(
        user_id::text = current_setting('app.current_user_id', true)
        OR is_default = true
      `,
      withCheck: sql`user_id::text = current_setting('app.current_user_id', true)`
    })
]);

// Identified threats from articles
export const threatArticles = pgTable("threat_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => threatSources.id, { onDelete: "set null"}),
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
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
});

// Type for a threat source record
export type ThreatSource = typeof threatSources.$inferSelect;

// Type for a threat keyword record
export type ThreatKeyword = typeof threatKeywords.$inferSelect;

// Type for a threat article record
export type ThreatArticle = typeof threatArticles.$inferSelect;

// Schema for inserting a new threat setting
export const insertThreatSettingSchema = createInsertSchema(threatSettings)
  .omit({ id: true });

// Type for inserting a new threat setting
export type InsertThreatSetting = z.infer<typeof insertThreatSettingSchema>;
// Type for a threat setting record
export type ThreatSetting = typeof threatSettings.$inferSelect;


export const insertThreatArticleSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  sourceId: z.string().uuid().optional(),
  author: z.string().nullable().optional(),
  publishDate: z.date().optional(),
  summary: z.string().nullable().optional(),
  relevanceScore: z.string().nullable().optional(),
  securityScore: z.string().nullable().optional(),
  detectedKeywords: z.any().optional(),
  userId: z.string().uuid().optional(),
  markedForCapsule: z.boolean().optional(),
});
export type InsertThreatArticle = z.infer<typeof insertThreatArticleSchema>;

export const insertThreatSourceSchema = z.object({
  url: z.string().url(),
  name: z.string(),
  active: z.boolean().optional(), // defaults to true in DB
  includeInAutoScrape: z.boolean().optional(), // defaults to true in DB
  scrapingConfig: z.any().optional(), // you can replace `any` with a specific schema if you want
  lastScraped: z.date().optional(),
  userId: z.string().uuid().optional(),
  isDefault: z.boolean().optional(), // defaults to false in DB
});

export type InsertThreatSource = z.infer<typeof insertThreatSourceSchema>;


export const insertThreatKeywordSchema = z.object({
  term: z.string(),                         // required
  category: z.enum(['threat', 'vendor', 'client', 'hardware']), // required
  active: z.boolean().optional(),           // has default in DB
  userId: z.string().uuid().optional(),     // optional (null for defaults)
  isDefault: z.boolean().optional(),        // has default in DB
});

export type InsertThreatKeyword = z.infer<typeof insertThreatKeywordSchema>;

