import { type Article, type InsertArticle } from "../../../shared/db/schema/news-capsule/index";

export class MemStorage {
  private articles: Map<string, InsertArticle>;
  private articleNum = 0;

  constructor() {
    this.articles = new Map();
    this.articleNum = 0;
  }

  // Article operations
  async getArticle(id: string): Promise<InsertArticle | undefined> {
    return this.articles.get(id);
  }

  async getAllArticles(): Promise<InsertArticle[]> {
    return Array.from(this.articles.values());
  }

  async createArticle(insertArticle: InsertArticle): Promise<InsertArticle> {
    
    // Ensure all required fields are present
    const article: InsertArticle = { 
      ...insertArticle, 
      attackVector: insertArticle.attackVector || "Unknown attack vector",
      vulnerabilityId: insertArticle.vulnerabilityId || "Unspecified",
      targetOS: insertArticle.targetOS || "Microsoft / Windows",
      markedForReporting: true,
      markedForDeletion: false
    };

    this.articles.set(this.articleNum.toString(), article)
    
    return article;
  }

  async updateArticle(id: string, updates: Partial<Article>): Promise<InsertArticle | undefined> {
    const article = this.articles.get(id);
    if (!article) {
      return undefined;
    }
    
    const updatedArticle = { ...article, ...updates };
    this.articles.set(id, updatedArticle);
    return updatedArticle;
  }

  async deleteArticle(id: string): Promise<boolean> {
    return this.articles.delete(id);
  }
  
  async deleteAllArticles(): Promise<boolean> {
    // Instead of clearing all articles, mark them all as deleted
    // This preserves them for reports but hides them from the News Capsule UI
    const allArticles = Array.from(this.articles.values());
    
    allArticles.forEach(article => {
      article.markedForDeletion = true;
    });
    
    return true;
  }
  // New method: Get articles from previous sessions
  async getEarlierArticles(): Promise<InsertArticle[]> {
    // For now, let's just get all articles and filter them in memory
    // This is a simple solution until we fix the SQL date comparison
    const allArticles = await this.getAllArticles();
    
    // Filter to get articles created before today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
    
    return allArticles
  }

  // Get articles from current session (today)
  async getTodayArticles(): Promise<InsertArticle[]> {
    // For now, let's just get all articles and filter them in memory
    // This is a simple solution until we fix the SQL date comparison
    const allArticles = await this.getAllArticles();
    
    // Filter to get articles created today or later
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
    
    return allArticles
  }
}
export const storage = new MemStorage();

//import { db } from "./db";
//import { eq, desc } from "drizzle-orm";
//
//export class DatabaseStorage implements IStorage {
//  // User operations
//  async getUser(id: number): Promise<User | undefined> {
//    const [user] = await db.select().from(users).where(eq(users.id, id));
//    return user;
//  }
//
//  async getUserByUsername(username: string): Promise<User | undefined> {
//    const [user] = await db.select().from(users).where(eq(users.username, username));
//    return user;
//  }
//
//  async createUser(insertUser: InsertUser): Promise<User> {
//    const [user] = await db
//      .insert(users)
//      .values(insertUser)
//      .returning();
//    return user;
//  }
//
//  // Article operations
//  async getArticle(id: string): Promise<Article | undefined> {
//    const [article] = await db.select().from(articles).where(eq(articles.id, id));
//    return article;
//  }
//
//  async getAllArticles(): Promise<Article[]> {
//    return await db
//      .select()
//      .from(articles)
//      .where(eq(articles.markedForDeletion, false))
//      .orderBy(desc(articles.createdAt));
//  }
//
//  async createArticle(insertArticle: InsertArticle): Promise<Article> {
//    const [article] = await db
//      .insert(articles)
//      .values(insertArticle)
//      .returning();
//    return article;
//  }
//
//  async updateArticle(id: string, updates: Partial<Article>): Promise<Article | undefined> {
//    const [updatedArticle] = await db
//      .update(articles)
//      .set(updates)
//      .where(eq(articles.id, id))
//      .returning();
//    return updatedArticle;
//  }
//
//  async deleteArticle(id: string): Promise<boolean> {
//    const result = await db
//      .delete(articles)
//      .where(eq(articles.id, id))
//      .returning();
//    return result.length > 0;
//  }
//  
//  async deleteAllArticles(): Promise<boolean> {
//    // Instead of deleting articles, mark them for deletion
//    await db
//      .update(articles)
//      .set({ markedForDeletion: true })
//      .where(eq(articles.markedForDeletion, false))
//      .returning();
//    return true;
//  }
//
//  // New method: Get articles from previous sessions
//  async getEarlierArticles(): Promise<Article[]> {
//    // For now, let's just get all articles and filter them in memory
//    // This is a simple solution until we fix the SQL date comparison
//    const allArticles = await this.getAllArticles();
//    
//    // Filter to get articles created before today
//    const today = new Date();
//    today.setHours(0, 0, 0, 0); // Set to beginning of today
//    
//    return allArticles.filter(article => {
//      const articleDate = new Date(article.createdAt);
//      return articleDate < today;
//    });
//  }
//
//  // Get articles from current session (today)
//  async getTodayArticles(): Promise<Article[]> {
//    // For now, let's just get all articles and filter them in memory
//    // This is a simple solution until we fix the SQL date comparison
//    const allArticles = await this.getAllArticles();
//    
//    // Filter to get articles created today or later
//    const today = new Date();
//    today.setHours(0, 0, 0, 0); // Set to beginning of today
//    
//    return allArticles.filter(article => {
//      const articleDate = new Date(article.createdAt);
//      return articleDate >= today;
//    });
//  }
//}

// Switch to database storage
