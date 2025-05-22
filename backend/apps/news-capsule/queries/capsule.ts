import { db } from "backend/db/db";
import { 
  capsuleArticles,
} from "@shared/db/schema/news-capsule";
import { eq, and, desc } from "drizzle-orm";
import { User } from "@shared/db/schema/user";

export const storage = {
  // Article management
  getArticles: async (userId: string) => {
    return db
      .select()
      .from(capsuleArticles)
      .where(and(
        eq(capsuleArticles.userId, userId),
        eq(capsuleArticles.markedForDeletion, false)
      ))
      .orderBy(desc(capsuleArticles.createdAt));
  },

  getArticle: async (id: string) => {
    const result = await db
      .select()
      .from(capsuleArticles)
      .where(eq(capsuleArticles.id, id));
    return result[0] || null;
  },

  createArticle: async (articleData: any) => {
    const result = await db
      .insert(capsuleArticles)
      .values(articleData)
      .returning();
    return result[0];
  },

  updateArticle: async (id: string, data: Partial<typeof capsuleArticles.$inferInsert>) => {
    const result = await db
      .update(capsuleArticles)
      .set(data)
      .where(eq(capsuleArticles.id, id))
      .returning();
    return result[0];
  },

  deleteArticle: async (id: string) => {
    // Soft delete by marking for deletion
    return db
      .update(capsuleArticles)
      .set({ markedForDeletion: true })
      .where(eq(capsuleArticles.id, id));
  },

  markArticleForReporting: async (id: string, marked: boolean) => {
    return db
      .update(capsuleArticles)
      .set({ markedForReporting: marked })
      .where(eq(capsuleArticles.id, id));
  },

  // Get articles marked for reporting
  getArticlesForReporting: async (userId: string) => {
    return db
      .select()
      .from(capsuleArticles)
      .where(and(
        eq(capsuleArticles.userId, userId),
        eq(capsuleArticles.markedForReporting, true),
        eq(capsuleArticles.markedForDeletion, false)
      ))
      .orderBy(desc(capsuleArticles.createdAt));
  },

  // Hard delete all articles (for "Clear All" functionality)
  clearAllArticles: async (userId: string) => {
    return db
      .update(capsuleArticles)
      .set({ markedForDeletion: true })
      .where(eq(capsuleArticles.userId, userId));
  }
};