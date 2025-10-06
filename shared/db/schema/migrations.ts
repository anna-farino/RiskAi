import { pgTable, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

export const migrations = pgTable('migrations', {
  id: varchar('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  success: boolean('success').notNull().default(true),
  error: text('error'),
});

export type Migration = typeof migrations.$inferSelect;
export type InsertMigration = typeof migrations.$inferInsert;