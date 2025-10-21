import { pgTable, uuid, text, boolean, timestamp, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

// =====================================================
// COMPANIES TABLE (replaces vendors and clients)
// =====================================================
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(), // For deduplication
  type: text('type'), // 'vendor', 'client', 'both', 'other'
  industry: text('industry'),
  description: text('description'),
  website: text('website'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found (if AI-discovered)
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // Additional flexible data
}, (table) => {
  return {
    normalizedIdx: index('companies_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_companies_name').on(table.name)
  };
});

// =====================================================
// SOFTWARE TABLE
// =====================================================
export const software = pgTable('software', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(), // For deduplication
  // Version removed - now tracked in junction tables
  companyId: uuid('company_id').references(() => companies.id),
  category: text('category'), // 'os', 'application', 'library', 'framework', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  isMalware: boolean('is_malware').default(false), // Flag to identify malicious software
  metadata: jsonb('metadata') // CPE, additional identifiers, etc.
}, (table) => {
  return {
    unq: unique().on(table.normalizedName, table.companyId),
    normalizedIdx: index('software_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_software_name').on(table.name)
  };
});

// =====================================================
// HARDWARE TABLE
// =====================================================
export const hardware = pgTable('hardware', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(), // For deduplication
  model: text('model'),
  manufacturer: text('manufacturer'),
  category: text('category'), // 'router', 'iot', 'server', 'workstation', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    unq: unique().on(table.normalizedName, table.model, table.manufacturer),
    normalizedIdx: index('hardware_normalized_idx').on(table.normalizedName)
  };
});

// =====================================================
// THREAT ACTORS TABLE (AI-discovered only)
// =====================================================
export const threatActors = pgTable('threat_actors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(), // For deduplication
  aliases: text('aliases').array(), // Alternative names
  type: text('type'), // 'apt', 'ransomware', 'hacktivist', 'criminal', 'nation-state'
  origin: text('origin'), // Country/region of origin if known
  firstSeen: timestamp('first_seen'),
  description: text('description'),
  tactics: text('tactics').array(), // MITRE ATT&CK tactics
  targets: text('targets').array(), // Common target industries/countries
  createdAt: timestamp('created_at').defaultNow(),
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // Additional threat intelligence
}, (table) => {
  return {
    normalizedIdx: index('threat_actors_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_threat_actors_name').on(table.name),
    aliasesIdx: index('idx_threat_actors_aliases').on(table.aliases) // GIN index for array search
  };
});

// =====================================================
// RELATIONS
// =====================================================

export const companiesRelations = relations(companies, ({ many, one }) => ({
  software: many(software),
  createdByUser: one(companies, {
    fields: [companies.createdBy],
    references: [companies.id]
  })
}));

export const softwareRelations = relations(software, ({ one }) => ({
  company: one(companies, {
    fields: [software.companyId],
    references: [companies.id]
  })
}));

export const hardwareRelations = relations(hardware, ({ one }) => ({
  // No relations yet - will be added by association files
}));

export const threatActorsRelations = relations(threatActors, ({ one }) => ({
  // No relations yet - will be added by association files
}));

// =====================================================
// INSERT SCHEMAS FOR VALIDATION
// =====================================================

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true
});

export const insertSoftwareSchema = createInsertSchema(software).omit({
  id: true,
  createdAt: true
});

export const insertHardwareSchema = createInsertSchema(hardware).omit({
  id: true,
  createdAt: true
});

export const insertThreatActorSchema = createInsertSchema(threatActors).omit({
  id: true,
  createdAt: true
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Software = typeof software.$inferSelect;
export type NewSoftware = typeof software.$inferInsert;

export type Hardware = typeof hardware.$inferSelect;
export type NewHardware = typeof hardware.$inferInsert;

export type ThreatActor = typeof threatActors.$inferSelect;
export type NewThreatActor = typeof threatActors.$inferInsert;
