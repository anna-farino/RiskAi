import { pgTable, primaryKey, timestamp, uuid, text, pgPolicy } from "drizzle-orm/pg-core";
import { users } from "./user";
import { capsuleArticles } from "./news-capsule";
import { sql } from "drizzle-orm";


export const reports = pgTable('reports', {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  topic: text("topic"),
  createdAt: timestamp("created_at").defaultNow().notNull()
},(_t) => [
  pgPolicy('rls-reports', {
    for: 'all',
    withCheck: sql`user_id::text = current_setting('app.current_user_id', true)`
  })
])

export const capsuleArticlesInReports = pgTable('capsule_articles_in_reports', 
  {
    articleId: uuid("article_id")
      .references(()=>capsuleArticles.id)
      .notNull(),
    reportId: uuid("report_id")
      .references(()=>reports.id, { onDelete: 'cascade'})
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.reportId ]})
  ]
)

export type Report = typeof reports.$inferSelect;

