import { db } from "backend/db/db";
import { capsuleArticles } from "@shared/db/schema/news-capsule";
import { eq } from "drizzle-orm";
import { log } from "backend/utils/log";

interface ArticleData {
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  userId: string;
}

export const storage = {
  // Create a new article
  async createArticle(articleData: ArticleData) {
    try {
      const [newArticle] = await db
        .insert(capsuleArticles)
        .values(articleData)
        .returning();
      
      return newArticle;
    } catch (error) {
      log(`Error creating article: ${error}`, "capsule-storage");
      throw error;
    }
  },
  
  // Get all articles for a user
  async getArticles(userId: string) {
    try {
      const articles = await db
        .select()
        .from(capsuleArticles)
        .where(eq(capsuleArticles.userId, userId))
        .orderBy(capsuleArticles.createdAt);
      
      return articles;
    } catch (error) {
      log(`Error getting articles: ${error}`, "capsule-storage");
      throw error;
    }
  },
  
  // Get a specific article by ID
  async getArticleById(articleId: string) {
    try {
      const [article] = await db
        .select()
        .from(capsuleArticles)
        .where(eq(capsuleArticles.id, articleId));
      
      return article;
    } catch (error) {
      log(`Error getting article by ID: ${error}`, "capsule-storage");
      throw error;
    }
  },
  
  // Delete an article
  async deleteArticle(articleId: string) {
    try {
      await db
        .delete(capsuleArticles)
        .where(eq(capsuleArticles.id, articleId));
      
      return true;
    } catch (error) {
      log(`Error deleting article: ${error}`, "capsule-storage");
      throw error;
    }
  }
};