// New Drizzle Schema Definitions for Re-Architecture
// These schemas should be used to generate migration files

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, unique, primaryKey, index, numeric } from 'drizzle-orm/pg-core';
import { relations, sql, and, eq, isNull, ilike } from 'drizzle-orm';

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
// ENTITY TABLES FOR THREAT INTELLIGENCE
// =====================================================

// Companies table (replaces vendors/clients)
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  type: text('type'), // 'vendor', 'client', 'both', 'other'
  industry: text('industry'),
  description: text('description'),
  website: text('website'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    normalizedIdx: index('companies_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_companies_name').on(table.name)
  };
});

// Software table
export const software = pgTable('software', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  companyId: uuid('company_id').references(() => companies.id),
  category: text('category'), // 'os', 'application', 'library', 'framework', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'),
  discoveredFrom: uuid('discovered_from'),
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    unq: unique().on(table.normalizedName, table.companyId),
    normalizedIdx: index('software_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_software_name').on(table.name)
  };
});

// Hardware table
export const hardware = pgTable('hardware', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  model: text('model'),
  manufacturer: text('manufacturer'),
  category: text('category'), // 'router', 'iot', 'server', 'workstation', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'),
  discoveredFrom: uuid('discovered_from'),
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    unq: unique().on(table.normalizedName, table.model, table.manufacturer),
    normalizedIdx: index('hardware_normalized_idx').on(table.normalizedName)
  };
});

// Threat actors table
export const threatActors = pgTable('threat_actors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  aliases: text('aliases').array(),
  type: text('type'), // 'apt', 'ransomware', 'hacktivist', 'criminal', 'nation-state'
  origin: text('origin'),
  firstSeen: timestamp('first_seen'),
  description: text('description'),
  tactics: text('tactics').array(),
  targets: text('targets').array(),
  createdAt: timestamp('created_at').defaultNow(),
  discoveredFrom: uuid('discovered_from'),
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    normalizedIdx: index('threat_actors_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_threat_actors_name').on(table.name),
    aliasesIdx: index('idx_threat_actors_aliases').on(table.aliases)
  };
});

// CVE data table (if needed for reference)
export const cveData = pgTable('cve_data', {
  cveId: text('cve_id').primaryKey(),
  description: text('description'),
  cvssScore: numeric('cvss_score', { precision: 3, scale: 1 }),
  cvssVector: text('cvss_vector'),
  severity: text('severity'),
  publishedDate: timestamp('published_date'),
  lastModified: timestamp('last_modified'),
  metadata: jsonb('metadata')
});

// =====================================================
// JUNCTION TABLES FOR ARTICLE-ENTITY RELATIONSHIPS
// =====================================================

// Article-Software junction table
export const articleSoftware = pgTable('article_software', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  softwareId: uuid('software_id').notNull().references(() => software.id),
  versionFrom: text('version_from'),
  versionTo: text('version_to'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.softwareId] }),
    articleIdx: index('idx_article_software_article').on(table.articleId),
    softwareIdx: index('idx_article_software_software').on(table.softwareId)
  };
});

// Article-Hardware junction table
export const articleHardware = pgTable('article_hardware', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.hardwareId] }),
    articleIdx: index('idx_article_hardware_article').on(table.articleId),
    hardwareIdx: index('idx_article_hardware_hardware').on(table.hardwareId)
  };
});

// Article-Companies junction table
export const articleCompanies = pgTable('article_companies', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  mentionType: text('mention_type'), // 'affected', 'vendor', 'client', 'mentioned'
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.companyId] }),
    articleIdx: index('idx_article_companies_article').on(table.articleId),
    companyIdx: index('idx_article_companies_company').on(table.companyId)
  };
});

// Article-CVEs junction table
export const articleCves = pgTable('article_cves', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  cveId: text('cve_id').notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.cveId] })
  };
});

// Article-Threat Actors junction table
export const articleThreatActors = pgTable('article_threat_actors', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  threatActorId: uuid('threat_actor_id').notNull().references(() => threatActors.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  activityType: text('activity_type'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.threatActorId] }),
    articleIdx: index('idx_article_threat_actors_article').on(table.articleId),
    threatActorIdx: index('idx_article_threat_actors_threat_actor').on(table.threatActorId)
  };
});

// =====================================================
// USER TECHNOLOGY STACK TABLES
// =====================================================

// User-Software junction table
export const usersSoftware = pgTable('users_software', {
  userId: uuid('user_id').notNull(),
  softwareId: uuid('software_id').notNull().references(() => software.id),
  version: text('version'),
  priority: text('priority'), // 'critical', 'high', 'medium', 'low'
  isActive: boolean('is_active').default(true),
  addedAt: timestamp('added_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.softwareId] }),
    userIdx: index('idx_users_software_user').on(table.userId),
    softwareIdx: index('idx_users_software_software').on(table.softwareId)
  };
});

// User-Hardware junction table
export const usersHardware = pgTable('users_hardware', {
  userId: uuid('user_id').notNull(),
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  priority: text('priority'),
  isActive: boolean('is_active').default(true),
  addedAt: timestamp('added_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.hardwareId] }),
    userIdx: index('idx_users_hardware_user').on(table.userId),
    hardwareIdx: index('idx_users_hardware_hardware').on(table.hardwareId)
  };
});

// User-Companies junction table
export const usersCompanies = pgTable('users_companies', {
  userId: uuid('user_id').notNull(),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  relationshipType: text('relationship_type'), // 'vendor', 'client', 'partner'
  priority: text('priority'),
  isActive: boolean('is_active').default(true),
  addedAt: timestamp('added_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.companyId] }),
    userIdx: index('idx_users_companies_user').on(table.userId),
    companyIdx: index('idx_users_companies_company').on(table.companyId)
  };
});

// =====================================================
// THREAT SCORING TABLES
// =====================================================

// Article severity metadata
export const articleSeverityMetadata = pgTable('article_severity_metadata', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id).primaryKey(),
  threatSeverityScore: integer('threat_severity_score'), // 0-100
  threatLevel: text('threat_level'), // 'low', 'medium', 'high', 'critical'
  cveScores: jsonb('cve_scores'),
  exploitabilityScore: integer('exploitability_score'),
  impactScore: integer('impact_score'),
  threatActorInvolvement: jsonb('threat_actor_involvement'),
  entitiesExtracted: boolean('entities_extracted').default(false),
  calculatedAt: timestamp('calculated_at').defaultNow(),
  metadata: jsonb('metadata')
});

// User-specific article relevance scores
export const articleRelevanceScore = pgTable('article_relevance_score', {
  userId: uuid('user_id').notNull(),
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  relevanceScore: integer('relevance_score'), // 0-100
  relevanceLevel: text('relevance_level'), // 'low', 'medium', 'high', 'critical'
  matchedEntities: jsonb('matched_entities'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  calculatedAt: timestamp('calculated_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.articleId] }),
    userIdx: index('idx_article_relevance_user').on(table.userId),
    articleIdx: index('idx_article_relevance_article').on(table.articleId),
    scoreIdx: index('idx_article_relevance_score').on(table.relevanceScore)
  };
});

// Entity resolution cache
export const entityResolutionCache = pgTable('entity_resolution_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityText: text('entity_text').notNull(),
  entityType: text('entity_type').notNull(),
  resolvedTo: jsonb('resolved_to'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at')
}, (table) => {
  return {
    entityIdx: index('idx_entity_resolution_text').on(table.entityText, table.entityType)
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

// Entity types
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Software = typeof software.$inferSelect;
export type NewSoftware = typeof software.$inferInsert;

export type Hardware = typeof hardware.$inferSelect;
export type NewHardware = typeof hardware.$inferInsert;

export type ThreatActor = typeof threatActors.$inferSelect;
export type NewThreatActor = typeof threatActors.$inferInsert;

export type CVEData = typeof cveData.$inferSelect;
export type NewCVEData = typeof cveData.$inferInsert;

// Junction table types
export type ArticleSoftware = typeof articleSoftware.$inferSelect;
export type NewArticleSoftware = typeof articleSoftware.$inferInsert;

export type ArticleHardware = typeof articleHardware.$inferSelect;
export type NewArticleHardware = typeof articleHardware.$inferInsert;

export type ArticleCompany = typeof articleCompanies.$inferSelect;
export type NewArticleCompany = typeof articleCompanies.$inferInsert;

export type ArticleCVE = typeof articleCves.$inferSelect;
export type NewArticleCVE = typeof articleCves.$inferInsert;

export type ArticleThreatActor = typeof articleThreatActors.$inferSelect;
export type NewArticleThreatActor = typeof articleThreatActors.$inferInsert;

// User tech stack types
export type UserSoftware = typeof usersSoftware.$inferSelect;
export type NewUserSoftware = typeof usersSoftware.$inferInsert;

export type UserHardware = typeof usersHardware.$inferSelect;
export type NewUserHardware = typeof usersHardware.$inferInsert;

export type UserCompany = typeof usersCompanies.$inferSelect;
export type NewUserCompany = typeof usersCompanies.$inferInsert;

// Scoring types
export type ArticleSeverityMetadata = typeof articleSeverityMetadata.$inferSelect;
export type NewArticleSeverityMetadata = typeof articleSeverityMetadata.$inferInsert;

export type ArticleRelevanceScore = typeof articleRelevanceScore.$inferSelect;
export type NewArticleRelevanceScore = typeof articleRelevanceScore.$inferInsert;

export type EntityResolutionCache = typeof entityResolutionCache.$inferSelect;
export type NewEntityResolutionCache = typeof entityResolutionCache.$inferInsert;
