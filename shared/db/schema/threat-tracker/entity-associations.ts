import { pgTable, uuid, text, timestamp, jsonb, numeric, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { globalArticles } from '../global-tables';
import { software, hardware, companies, threatActors } from './entities';

// =====================================================
// ARTICLE ASSOCIATION TABLES
// =====================================================

export const articleSoftware = pgTable('article_software', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  softwareId: uuid('software_id').notNull().references(() => software.id),
  versionFrom: text('version_from'), // Start of version range affected (e.g., "2.14.0")
  versionTo: text('version_to'), // End of version range affected (e.g., "2.17.0")
  confidence: numeric('confidence', { precision: 3, scale: 2 }), // AI confidence 0.00-1.00
  context: text('context'), // Snippet where software was mentioned
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // Vulnerability details, patch info, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.softwareId] }),
    articleIdx: index('idx_article_software_article').on(table.articleId),
    softwareIdx: index('idx_article_software_software').on(table.softwareId)
  };
});

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

export const articleCves = pgTable('article_cves', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  cveId: text('cve_id').notNull(), // references cve_data.cve_id
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // CVSS scores mentioned, exploit details, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.cveId] })
  };
});

export const articleThreatActors = pgTable('article_threat_actors', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  threatActorId: uuid('threat_actor_id').notNull().references(() => threatActors.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'), // Snippet where actor was mentioned
  activityType: text('activity_type'), // 'attributed', 'suspected', 'mentioned'
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // Campaign info, TTPs mentioned, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.threatActorId] }),
    articleIdx: index('idx_article_threat_actors_article').on(table.articleId),
    actorIdx: index('idx_article_threat_actors_actor').on(table.threatActorId)
  };
});

// =====================================================
// RELATIONS
// =====================================================

export const articleSoftwareRelations = relations(articleSoftware, ({ one }) => ({
  article: one(globalArticles, {
    fields: [articleSoftware.articleId],
    references: [globalArticles.id]
  }),
  software: one(software, {
    fields: [articleSoftware.softwareId],
    references: [software.id]
  })
}));

export const articleHardwareRelations = relations(articleHardware, ({ one }) => ({
  article: one(globalArticles, {
    fields: [articleHardware.articleId],
    references: [globalArticles.id]
  }),
  hardware: one(hardware, {
    fields: [articleHardware.hardwareId],
    references: [hardware.id]
  })
}));

export const articleCompaniesRelations = relations(articleCompanies, ({ one }) => ({
  article: one(globalArticles, {
    fields: [articleCompanies.articleId],
    references: [globalArticles.id]
  }),
  company: one(companies, {
    fields: [articleCompanies.companyId],
    references: [companies.id]
  })
}));

export const articleCvesRelations = relations(articleCves, ({ one }) => ({
  article: one(globalArticles, {
    fields: [articleCves.articleId],
    references: [globalArticles.id]
  })
}));

export const articleThreatActorsRelations = relations(articleThreatActors, ({ one }) => ({
  article: one(globalArticles, {
    fields: [articleThreatActors.articleId],
    references: [globalArticles.id]
  }),
  threatActor: one(threatActors, {
    fields: [articleThreatActors.threatActorId],
    references: [threatActors.id]
  })
}));

// =====================================================
// INSERT SCHEMAS FOR VALIDATION
// =====================================================

export const insertArticleSoftwareSchema = createInsertSchema(articleSoftware).omit({
  extractedAt: true
});

export const insertArticleHardwareSchema = createInsertSchema(articleHardware).omit({
  extractedAt: true
});

export const insertArticleCompaniesSchema = createInsertSchema(articleCompanies).omit({
  extractedAt: true
});

export const insertArticleCvesSchema = createInsertSchema(articleCves).omit({
  extractedAt: true
});

export const insertArticleThreatActorsSchema = createInsertSchema(articleThreatActors).omit({
  extractedAt: true
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type ArticleSoftware = typeof articleSoftware.$inferSelect;
export type NewArticleSoftware = typeof articleSoftware.$inferInsert;

export type ArticleHardware = typeof articleHardware.$inferSelect;
export type NewArticleHardware = typeof articleHardware.$inferInsert;

export type ArticleCompanies = typeof articleCompanies.$inferSelect;
export type NewArticleCompanies = typeof articleCompanies.$inferInsert;

export type ArticleCves = typeof articleCves.$inferSelect;
export type NewArticleCves = typeof articleCves.$inferInsert;

export type ArticleThreatActors = typeof articleThreatActors.$inferSelect;
export type NewArticleThreatActors = typeof articleThreatActors.$inferInsert;
