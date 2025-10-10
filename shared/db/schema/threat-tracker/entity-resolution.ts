import { pgTable, uuid, text, timestamp, real, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

// =====================================================
// ENTITY RESOLUTION CACHE TABLE
// =====================================================

export const entityResolutionCache = pgTable('entity_resolution_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  inputName: text('input_name').notNull(),
  entityType: text('entity_type').notNull(), // 'company', 'software', etc.
  resolvedId: text('resolved_id'), // null if new entity
  canonicalName: text('canonical_name').notNull(),
  confidence: real('confidence').notNull(),
  aliases: text('aliases').array().notNull().default(sql`ARRAY[]::text[]`),
  reasoning: text('reasoning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull() // Cache expiry (30 days)
}, (table) => ({
  lookupIdx: index('entity_resolution_lookup_idx').on(
    table.inputName,
    table.entityType
  ),
  expiryIdx: index('entity_resolution_expiry_idx').on(table.expiresAt)
}));

// =====================================================
// INSERT SCHEMAS FOR VALIDATION
// =====================================================

export const insertEntityResolutionCacheSchema = createInsertSchema(entityResolutionCache).omit({
  id: true,
  createdAt: true
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type EntityResolutionCache = typeof entityResolutionCache.$inferSelect;
export type NewEntityResolutionCache = typeof entityResolutionCache.$inferInsert;
