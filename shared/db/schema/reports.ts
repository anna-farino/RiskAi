import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./user";
import { capsuleArticles } from "./news-capsule";


export const reports = pgTable('reports', {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

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

