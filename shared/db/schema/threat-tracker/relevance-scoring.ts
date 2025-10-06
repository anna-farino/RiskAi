import { pgTable, uuid, text, timestamp, jsonb, numeric, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { globalArticles } from '../global-tables';
import { users } from '../user';

// =====================================================
// USER-SPECIFIC RELEVANCE SCORING TABLE
// =====================================================

export const articleRelevanceScores = pgTable('article_relevance_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => globalArticles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Relevance scoring components
  relevanceScore: numeric('relevance_score', { precision: 4, scale: 2 }), // 0.00-100.00
  softwareScore: numeric('software_score', { precision: 4, scale: 2 }), // Component score
  clientScore: numeric('client_score', { precision: 4, scale: 2 }), // Component score
  vendorScore: numeric('vendor_score', { precision: 4, scale: 2 }), // Component score
  hardwareScore: numeric('hardware_score', { precision: 4, scale: 2 }), // Component score
  keywordScore: numeric('keyword_score', { precision: 4, scale: 2 }), // Component score

  // Metadata for debugging and analysis
  matchedSoftware: text('matched_software').array(), // Software IDs that matched
  matchedCompanies: text('matched_companies').array(), // Company IDs that matched
  matchedHardware: text('matched_hardware').array(), // Hardware IDs that matched
  matchedKeywords: text('matched_keywords').array(), // Keywords that matched

  // Tracking
  calculatedAt: timestamp('calculated_at').defaultNow(),
  calculationVersion: text('calculation_version').default('1.0'),
  metadata: jsonb('metadata') // Additional scoring details
}, (table) => {
  return {
    // Unique constraint: one score per user-article combination
    unq: unique().on(table.articleId, table.userId),
    // Indexes for efficient queries
    userArticleIdx: index('idx_relevance_user_article').on(table.userId, table.articleId),
    articleScoreIdx: index('idx_relevance_article_score').on(table.articleId, table.relevanceScore),
    userScoreIdx: index('idx_relevance_user_score').on(table.userId, table.relevanceScore),
    articleDateIdx: index('article_date_idx').on(table.articleId, table.calculatedAt)
  };
});

// =====================================================
// RELATIONS
// =====================================================

export const articleRelevanceScoresRelations = relations(articleRelevanceScores, ({ one }) => ({
  article: one(globalArticles, {
    fields: [articleRelevanceScores.articleId],
    references: [globalArticles.id]
  }),
  user: one(users, {
    fields: [articleRelevanceScores.userId],
    references: [users.id]
  })
}));

// =====================================================
// INSERT SCHEMAS FOR VALIDATION
// =====================================================

export const insertArticleRelevanceScoresSchema = createInsertSchema(articleRelevanceScores).omit({
  id: true,
  calculatedAt: true
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type ArticleRelevanceScores = typeof articleRelevanceScores.$inferSelect;
export type NewArticleRelevanceScores = typeof articleRelevanceScores.$inferInsert;
