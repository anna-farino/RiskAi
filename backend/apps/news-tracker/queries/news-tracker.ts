import type { 
  Source, 
  InsertSource, 
  Keyword, 
  InsertKeyword, 
  Article, 
  InsertArticle, 
  Setting, 
} from "@shared/db/schema/news-tracker/index";
import { 
  sources, 
  keywords, 
  articles, 
  settings, 
} from "@shared/db/schema/news-tracker/index";
import { db } from "backend/db/db";
import { eq, and, isNull } from "drizzle-orm";

export interface IStorage {
  // Sources
  getSources(userId?: string): Promise<Source[]>;
  getSource(id: string): Promise<Source | undefined>;
  getAutoScrapeSources(userId?: string): Promise<Source[]>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: string, source: Partial<Source>): Promise<Source>;
  deleteSource(id: string): Promise<void>;

  // Keywords
  getKeywords(userId?: string): Promise<Keyword[]>;
  getKeyword(id: string): Promise<Keyword | undefined>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: string, keyword: Partial<Keyword>): Promise<Keyword>;
  deleteKeyword(id: string): Promise<void>;

  // Articles
  getArticles(userId?: string): Promise<Article[]>;
  getArticle(id: string): Promise<Article | undefined>;
  getArticleByUrl(url: string): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;
  deleteArticle(id: string): Promise<void>;
  deleteAllArticles(userId?: string): Promise<number>; // Returns count of deleted articles
  
  // Settings
  getSetting(key: string, userId?: string): Promise<Setting | undefined>;
  setSetting(key: string, value: any, userId?: string): Promise<Setting>;
}

export class DatabaseStorage implements IStorage {

  // Sources
  async getSources(userId?: string): Promise<Source[]> {
    if (userId) {
      return await db.select()
        .from(sources)
        .where(eq(sources.userId, userId));
    } else {
      return await db.select().from(sources);
    }
  }

  async getSource(id: string): Promise<Source | undefined> {
    const [source] = await db.select().from(sources).where(eq(sources.id, id));
    return source;
  }
  
  async getAutoScrapeSources(userId?: string): Promise<Source[]> {
    let query = db.select()
      .from(sources)
      .where(
        and(
          eq(sources.active, true),
          eq(sources.includeInAutoScrape, true)
        )
      );
    
    if (userId) {
      query = db.select()
        .from(sources)
        .where(
          and(
            eq(sources.active, true),
            eq(sources.includeInAutoScrape, true),
            eq(sources.userId, userId)
          )
        );
    }
    
    return await query;
  }

  async createSource(source: InsertSource): Promise<Source> {
    const [created] = await db
      .insert(sources)
      .values(source)
      .returning();

    return created;
  }

  async updateSource(id: string, source: Partial<Source>): Promise<Source> {
    const [updated] = await db
      .update(sources)
      .set(source)
      .where(eq(sources.id, id))
      .returning();
    return updated;
  }

  async deleteSource(id: string): Promise<void> {
    await db.delete(sources).where(eq(sources.id, id));
  }

  // Keywords
  async getKeywords(userId?: string): Promise<Keyword[]> {
    if (userId) {
      return await db.select()
        .from(keywords)
        .where(eq(keywords.userId, userId));
    } else {
      return await db.select().from(keywords);
    }
  }
  
  async getKeyword(id: string): Promise<Keyword | undefined> {
    const [keyword] = await db.select().from(keywords).where(eq(keywords.id, id));
    return keyword;
  }

  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const [created] = await db.insert(keywords).values(keyword).returning();
    return created;
  }

  async updateKeyword(id: string, keyword: Partial<Keyword>): Promise<Keyword> {
    const [updated] = await db
      .update(keywords)
      .set(keyword)
      .where(eq(keywords.id, id))
      .returning();
    return updated;
  }

  async deleteKeyword(id: string): Promise<void> {
    await db.delete(keywords).where(eq(keywords.id, id));
  }

  // Articles
  async getArticles(userId?: string): Promise<Article[]> {
    if (userId) {
      return await db.select()
        .from(articles)
        .where(eq(articles.userId, userId));
    } else {
      return await db.select().from(articles);
    }
  }

  async getArticle(id: string): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.id, id));
    return article;
  }

  async getArticleByUrl(url: string, userId?: string): Promise<Article | undefined> {
    let query = db
      .select()
      .from(articles)
      .where(eq(articles.url, url));
    
    if (userId) {
      query = db
        .select()
        .from(articles)
        .where(and(
          eq(articles.url, url),
          eq(articles.userId, userId)
        ))
    }
    
    const [article] = await query;
    return article;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [created] = await db.insert(articles).values(article).returning();
    return created;
  }

  async deleteArticle(id: string): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  async deleteAllArticles(userId?: string): Promise<number> {
    let query;
    if (!userId) {
      query = db
        .delete(articles);
    } else {
      query = db
        .delete(articles)
        .where(eq(articles.userId, userId))
    }
    
    const result = await query.returning({ id: articles.id });
    return result.length;
  }
  
  // Settings
  async getSetting(key: string, userId?: string): Promise<Setting | undefined> {
    let query = db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    
    if (userId !== undefined) {
      query = db
        .select()
        .from(settings)
        .where(and(
          eq(settings.key, key),
          eq(settings.userId, userId)
        ))
    } else {
      // When userId is not specified, get global settings (null userId)
      query = db
        .select()
        .from(settings)
        .where(and(
          eq(settings.key, key),
          isNull(settings.userId)
        ))
    }
    
    const [setting] = await query;
    return setting;
  }
  
  async setSetting(key: string, value: any, userId?: string): Promise<Setting> {
    // Check if setting exists
    const existing = await this.getSetting(key, userId);
    
    if (existing) {
      // Update existing setting
      const [updated] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      // Create new setting
      const [created] = await db
        .insert(settings)
        .values({ key, value, userId })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
