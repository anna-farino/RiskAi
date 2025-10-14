import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { users } from '../user';
import { software, hardware, companies } from './entities';

// =====================================================
// USER ASSOCIATION TABLES
// =====================================================

export const usersSoftware = pgTable('users_software', {
  userId: uuid('user_id').notNull().references(() => users.id), // references users.id
  softwareId: uuid('software_id').notNull().references(() => software.id),
  version: text('version'), // Specific version user is running
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  metadata: jsonb('metadata') // User-specific notes, deployment info, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.softwareId] }),
    userIdx: index('idx_users_software_user').on(table.userId)
  };
});

export const usersHardware = pgTable('users_hardware', {
  userId: uuid('user_id').notNull().references(() => users.id), // references users.id
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  quantity: integer('quantity').default(1),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.hardwareId] }),
    userIdx: index('idx_users_hardware_user').on(table.userId)
  };
});

export const usersCompanies = pgTable('users_companies', {
  userId: uuid('user_id').notNull().references(() => users.id), // references users.id
  companyId: uuid('company_id').notNull().references(() => companies.id),
  relationshipType: text('relationship_type'), // 'vendor', 'client', 'partner', etc.
  source: text('source').default('manual'), // 'manual', 'auto-software', 'auto-hardware'
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.companyId] }),
    userIdx: index('idx_users_companies_user').on(table.userId)
  };
});

// =====================================================
// RELATIONS
// =====================================================

export const usersSoftwareRelations = relations(usersSoftware, ({ one }) => ({
  user: one(users, {
    fields: [usersSoftware.userId],
    references: [users.id]
  }),
  software: one(software, {
    fields: [usersSoftware.softwareId],
    references: [software.id]
  })
}));

export const usersHardwareRelations = relations(usersHardware, ({ one }) => ({
  user: one(users, {
    fields: [usersHardware.userId],
    references: [users.id]
  }),
  hardware: one(hardware, {
    fields: [usersHardware.hardwareId],
    references: [hardware.id]
  })
}));

export const usersCompaniesRelations = relations(usersCompanies, ({ one }) => ({
  user: one(users, {
    fields: [usersCompanies.userId],
    references: [users.id]
  }),
  company: one(companies, {
    fields: [usersCompanies.companyId],
    references: [companies.id]
  })
}));

// =====================================================
// INSERT SCHEMAS FOR VALIDATION
// =====================================================

export const insertUsersSoftwareSchema = createInsertSchema(usersSoftware).omit({
  addedAt: true
});

export const insertUsersHardwareSchema = createInsertSchema(usersHardware).omit({
  addedAt: true
});

export const insertUsersCompaniesSchema = createInsertSchema(usersCompanies).omit({
  addedAt: true
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type UsersSoftware = typeof usersSoftware.$inferSelect;
export type NewUsersSoftware = typeof usersSoftware.$inferInsert;

export type UsersHardware = typeof usersHardware.$inferSelect;
export type NewUsersHardware = typeof usersHardware.$inferInsert;

export type UsersCompanies = typeof usersCompanies.$inferSelect;
export type NewUsersCompanies = typeof usersCompanies.$inferInsert;
