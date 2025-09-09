import { pgTable, uuid, timestamp, text, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * Scheduler Metadata Table
 * Stores the state of the global scheduler across server restarts
 */
export const schedulerMetadata = pgTable('scheduler_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  schedulerName: text('scheduler_name').notNull().unique(), // 'global_scraper'
  lastSuccessfulRun: timestamp('last_successful_run'),
  lastAttemptedRun: timestamp('last_attempted_run'),
  consecutiveFailures: integer('consecutive_failures').default(0),
  isRunning: boolean('is_running').default(false),
  nextScheduledRun: timestamp('next_scheduled_run'),
  metadata: text('metadata'), // JSON string for additional data
  updatedAt: timestamp('updated_at').defaultNow()
});

export type SchedulerMetadata = typeof schedulerMetadata.$inferSelect;