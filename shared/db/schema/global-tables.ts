// New Drizzle Schema Definitions for Re-Architecture
// These schemas should be used to generate migration files

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, unique, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Import existing users table (reference only - already exists)
// import { users } from './existing/users';

// =====================================================
// GLOBAL ARTICLES TABLE
// =====================================================
export const globalArticles = pgTable('global_articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => globalSources.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  url: text('url').notNull().unique(),
  author: text('author'),
  publishDate: timestamp('publish_date'),
  summary: text('summary'),
  
  // AI Analysis Fields (New)
  isCybersecurity: boolean('is_cybersecurity').default(false),
  securityScore: integer('security_score'), // 0-100, only for cybersecurity articles
  threatCategories: jsonb('threat_categories'), // {malware: true, ransomware: false, etc}
  
  // Metadata
  scrapedAt: timestamp('scraped_at').defaultNow(),
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  analysisVersion: text('analysis_version'), // Track AI model version used
  
  // Legacy fields for compatibility
  detectedKeywords: jsonb('detected_keywords') // Maintained but populated differently
});

// =====================================================
// GLOBAL SOURCES TABLE
// =====================================================
export const globalSources = pgTable('global_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  url: text('url').notNull().unique(),
  name: text('name').notNull(),
  category: text('category'), // 'news', 'tech', 'security', etc
  
  // Global status
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false),
  priority: integer('priority').default(50), // Scraping priority
  
  // Scraping configuration
  scrapingConfig: jsonb('scraping_config'),
  lastScraped: timestamp('last_scraped'),
  lastSuccessfulScrape: timestamp('last_successful_scrape'),
  consecutiveFailures: integer('consecutive_failures').default(0),
  
  // Metadata
  addedAt: timestamp('added_at').defaultNow(),
  addedBy: uuid('added_by') // References users.id - admin who added it
});

// =====================================================
// USER SOURCE PREFERENCES TABLE
// =====================================================
export const userSourcePreferences = pgTable('user_source_preferences', {
  userId: uuid('user_id').notNull(), // References users.id
  sourceId: uuid('source_id').notNull().references(() => globalSources.id),
  appContext: text('app_context').notNull(), // 'news_radar' or 'threat_tracker'
  isEnabled: boolean('is_enabled').default(true),
  enabledAt: timestamp('enabled_at').defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.sourceId, table.appContext] })
  };
});

// =====================================================
// USER KEYWORDS TABLE (Modified for new usage)
// =====================================================
export const userKeywords = pgTable('user_keywords', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // References users.id
  appContext: text('app_context').notNull(), // 'news_radar' or 'threat_tracker'
  term: text('term').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  
}, (table) => {
  return {
    unq: unique().on(table.userId, table.appContext, table.term)
  };
});

// =====================================================
// RELATIONS
// =====================================================

// Global Articles Relations
export const globalArticlesRelations = relations(globalArticles, ({ one }) => ({
  source: one(globalSources, {
    fields: [globalArticles.sourceId],
    references: [globalSources.id]
  })
}));

// Global Sources Relations
export const globalSourcesRelations = relations(globalSources, ({ many }) => ({
  articles: many(globalArticles),
  userPreferences: many(userSourcePreferences)
}));

// User Source Preferences Relations
export const userSourcePreferencesRelations = relations(userSourcePreferences, ({ one }) => ({
  source: one(globalSources, {
    fields: [userSourcePreferences.sourceId],
    references: [globalSources.id]
  })
  // user relation would be defined in users schema file
}));

// =====================================================
// TYPE EXPORTS FOR USE IN APPLICATION
// =====================================================

export type GlobalArticle = typeof globalArticles.$inferSelect;
export type NewGlobalArticle = typeof globalArticles.$inferInsert;

export type GlobalSource = typeof globalSources.$inferSelect;
export type NewGlobalSource = typeof globalSources.$inferInsert;

export type UserSourcePreference = typeof userSourcePreferences.$inferSelect;
export type NewUserSourcePreference = typeof userSourcePreferences.$inferInsert;

export type UserKeyword = typeof userKeywords.$inferSelect;
export type NewUserKeyword = typeof userKeywords.$inferInsert;
