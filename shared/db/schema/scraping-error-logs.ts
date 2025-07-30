import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './user';

export const appTypeEnum = pgEnum('app_type', [
  'news-radar',
  'threat-tracker',
  'news-capsule',
]);

export const errorTypeEnum = pgEnum('error_type', [
  'network',
  'parsing',
  'ai',
  'puppeteer',
  'timeout',
  'auth',
  'unknown',
]);

export const scrapingErrorLogs = pgTable('scraping_error_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sourceId: text('source_id'),
  sourceUrl: text('source_url').notNull(),
  appType: appTypeEnum('app_type').notNull(),
  articleUrl: text('article_url'),
  errorType: errorTypeEnum('error_type').notNull(),
  errorMessage: text('error_message').notNull(),
  errorDetails: jsonb('error_details'),
  scrapingMethod: text('scraping_method').notNull(), // 'http' or 'puppeteer'
  extractionStep: text('extraction_step').notNull(), // 'source-scraping' etc.
  timestamp: timestamp('timestamp', { withTimezone: false }).notNull(),
  retryCount: integer('retry_count').default(0),
});

// Zod schemas
export const insertScrapingErrorLogSchema = createInsertSchema(scrapingErrorLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type ScrapingErrorLog = typeof scrapingErrorLogs.$inferSelect;
export type InsertScrapingErrorLog = z.infer<typeof insertScrapingErrorLogSchema>;

// Type aliases for enums
export type AppType = 'news-radar' | 'threat-tracker' | 'news-capsule';
export type ErrorType = 'network' | 'parsing' | 'ai' | 'puppeteer' | 'timeout' | 'auth' | 'unknown';
export type ScrapingMethod = 'http' | 'puppeteer';
export type ExtractionStep = 'source-scraping' | 'article-scraping' | 'structure-detection' | 'content-extraction';
