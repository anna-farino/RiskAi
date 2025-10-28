// New Drizzle Schema Definitions for Re-Architecture
// These schemas should be used to generate migration files

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, numeric, unique, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

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

  // Enhanced threat scoring fields
  threatMetadata: jsonb('threat_metadata'), // Detailed scoring components
  threatSeverityScore: numeric('threat_severity_score', { precision: 4, scale: 2 }), // User-independent severity
  threatLevel: text('threat_level'), // 'low', 'medium', 'high', 'critical' - based on severity only

  // Attack vectors remain in main table (not entity-based)
  attackVectors: text('attack_vectors').array(),

  // Analysis tracking
  lastThreatAnalysis: timestamp('last_threat_analysis'),
  threatAnalysisVersion: text('threat_analysis_version'),
  entitiesExtracted: boolean('entities_extracted').default(false), // Track if entity extraction completed

  // Metadata
  scrapedAt: timestamp('scraped_at').defaultNow(),
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  analysisVersion: text('analysis_version'), // Track AI model version used

  // Legacy fields for compatibility
  detectedKeywords: jsonb('detected_keywords') // Maintained but populated differently
}, (table) => {
  return {
    // Add indexes for new threat scoring fields
    severityIdx: index('idx_articles_severity').on(table.threatSeverityScore),
    threatLevelIdx: index('idx_articles_threat_level').on(table.threatLevel)
  };
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

// =====================================================
// ZOD VALIDATION SCHEMAS
// =====================================================

// Insert schema for global sources (admin use)
export const insertGlobalSourceSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  priority: z.number().int().min(0).max(100).default(50),
  scrapingConfig: z.any().optional(),
  addedBy: z.string().uuid().optional(),
});

// Update schema for global sources (partial)
export const updateGlobalSourceSchema = z.object({
  url: z.string().url('Must be a valid URL').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  scrapingConfig: z.any().optional(),
}).strict();

export type InsertGlobalSource = z.infer<typeof insertGlobalSourceSchema>;
export type UpdateGlobalSource = z.infer<typeof updateGlobalSourceSchema>;
