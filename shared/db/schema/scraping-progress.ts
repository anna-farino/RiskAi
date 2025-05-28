import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./user";

// Progress tracking for scraping jobs
export const scrapingJobs = pgTable("scraping_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // 'threat-tracker' or 'news-radar'
  status: text("status").notNull().default('starting'), // 'starting', 'running', 'completed', 'error'
  currentSource: text("current_source"),
  currentSourceId: uuid("current_source_id"),
  currentArticleUrl: text("current_article_url"),
  currentArticleTitle: text("current_article_title"),
  isDetectingStructure: boolean("is_detecting_structure").default(false),
  isBypassingBotProtection: boolean("is_bypassing_bot_protection").default(false),
  totalSources: integer("total_sources").default(0),
  processedSources: integer("processed_sources").default(0),
  totalArticles: integer("total_articles").default(0),
  processedArticles: integer("processed_articles").default(0),
  addedArticles: integer("added_articles").default(0),
  skippedArticles: integer("skipped_articles").default(0),
  errors: jsonb("errors").$type<string[]>().default([]),
  startedAt: timestamp("started_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  userId: uuid("user_id").references(() => users.id),
});

export const insertScrapingJobSchema = createInsertSchema(scrapingJobs)
  .pick({
    type: true,
    status: true,
    currentSource: true,
    currentSourceId: true,
    currentArticleUrl: true,
    currentArticleTitle: true,
    isDetectingStructure: true,
    isBypassingBotProtection: true,
    totalSources: true,
    processedSources: true,
    totalArticles: true,
    processedArticles: true,
    addedArticles: true,
    skippedArticles: true,
    errors: true,
    userId: true,
  });

export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;

// Progress event types for real-time updates
export type ProgressEvent = {
  jobId: string;
  type: 'threat-tracker' | 'news-radar';
  event: 'job_started' | 'source_started' | 'structure_detection' | 'bot_bypass' | 'article_processing' | 'article_added' | 'article_skipped' | 'source_completed' | 'job_completed' | 'error';
  data: {
    sourceName?: string;
    sourceId?: string;
    articleUrl?: string;
    articleTitle?: string;
    isDetectingStructure?: boolean;
    isBypassingBotProtection?: boolean;
    totalSources?: number;
    processedSources?: number;
    totalArticles?: number;
    processedArticles?: number;
    addedArticles?: number;
    skippedArticles?: number;
    error?: string;
    status?: string;
  };
};