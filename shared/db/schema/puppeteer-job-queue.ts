import { pgTable, uuid, timestamp, text, jsonb } from 'drizzle-orm/pg-core';
import { users } from './user';

// Job status: queued, running, done, failed
export const puppeteerJobQueue = pgTable('puppeteer_job_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
  status: text('status').notNull(), // Use: 'queued', 'running', 'done', 'failed'
  userId: uuid('user_id').references(() => users.id),
  sourceApp: text('source_app'), // 'news-radar', 'threat-tracker', etc.
  url: text('url').notNull(), // direct URL of the job
  inputData: jsonb('input_data').notNull(), // JSON describing url/config
  outputData: jsonb('output_data'), // JSON results or error data
  runAt: timestamp('run_at'), // optional, for delayed jobs/future use
});

export type PuppeteerJobQueue = typeof puppeteerJobQueue.$inferSelect;
