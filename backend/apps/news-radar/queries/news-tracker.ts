import { withUserContext } from "backend/db/with-user-context";
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
  settings,
  articles, 
} from "@shared/db/schema/news-tracker/index";
import { db, pool } from "backend/db/db";
import { eq, and, isNull, sql, SQL, gte, lte, or, ilike, desc } from "drizzle-orm";
import { Request } from "express";
import { userInfo } from "os";

// Helper function to execute SQL with parameters
async function executeRawSql<T>(sqlStr: string, params: any[] = []): Promise<T[]> {
  try {
    // Direct execution with the pool instead of through drizzle
    const result = await pool.query(sqlStr, params);
    return result.rows as T[];
  } catch (error) {
    console.error("SQL execution error:", error);
    return [];
  }
}

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
  getKeywordTermsById(ids: string[]): Promise<string[]>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: string, keyword: Partial<Keyword>): Promise<Keyword>;
  deleteKeyword(id: string): Promise<void>;

  // Articles
  getArticles(
    req: Request,
    userId?: string, 
    filters?: { 
      search?: string, 
      keywordIds?: string[],
      startDate?: Date,
      endDate?: Date
    },
  ): Promise<Article[]>;
  getArticle(id: string, userId: string): Promise<Article | undefined>;
  getArticleByUrl(url: string, userId: string): Promise<Article | undefined>;
  createArticle(article: InsertArticle, userId: string): Promise<Article>;
  deleteArticle(id: string, userId: string): Promise<void>;
  deleteAllArticles(userId: string): Promise<number>; // Returns count of deleted articles

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
      .values(source as Required<InsertSource>)
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
    const [keyword] = await db
      .select()
      .from(keywords)
      .where(eq(keywords.id, id));
    return keyword;
  }

  async getKeywordTermsById(ids: string[]): Promise<string[]> {
    if (!ids || ids.length === 0) return [];

    try {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const sqlStr = `SELECT term FROM keywords WHERE id IN (${placeholders})`;

      // Use raw SQL query to get terms for the given IDs
      const results = await executeRawSql<{ term: string }>(sqlStr, ids);
      return results.map(row => row.term);
    } catch (error) {
      console.error("Error getting keyword terms by IDs:", error);
      return [];
    }
  }

  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const [created] = await db
      .insert(keywords)
      .values(keyword as Required<InsertKeyword>)
      .returning();
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
  async getArticles(
    req: Request,
    userId?: string, 
    filters?: { 
      search?: string, 
      keywordIds?: string[],
      startDate?: Date,
      endDate?: Date
    },
  ): Promise<Article[]> {
    const searchTerm = filters?.search?.trim() ?? null;
    const startDate  = filters?.startDate   ?? null;
    const endDate    = filters?.endDate     ?? null;

    const rows = await withUserContext(
      userId,
      async (db) => db
        .select({
          id: articles.id,
          sourceId: articles.sourceId,
          title: articles.title,
          content: articles.content,
          url: articles.url,
          author: articles.author,
          publishDate: articles.publishDate,
          summary: articles.summary,
          relevanceScore: articles.relevanceScore,
          detectedKeywords: articles.detectedKeywords,
          userId: articles.userId,
          sourceName: sources.name,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
        .where(
          and(
            eq(articles.userId, userId),
            searchTerm
              ? or(
                  ilike(articles.title, `%${searchTerm}%`),
                  ilike(articles.content, `%${searchTerm}%`)
                )
              : sql`TRUE`,
            startDate
              ? gte(articles.publishDate, startDate)
              : sql`TRUE`,
            endDate
              ? lte(articles.publishDate, endDate)
              : sql`TRUE`,
          )
        )
        .orderBy(desc(articles.publishDate))
    )

    return rows;
  }


  async getArticle(id: string, userId: string): Promise<Article | undefined> {
    const data = await withUserContext(
      userId,
      async (db) => db
        .select()
        .from(articles)
        .where(eq(articles.id,id))
        .limit(1)
    )
    return data.length > 0 ? data[0] : undefined;
  }

  async getArticleByUrl(url: string, userId: string): Promise<Article | undefined> {
    const data = await withUserContext(
      userId,
      async (db) => db
        .select()
        .from(articles)
        .where(eq(articles.url,url))
        .limit(1)
    )
    return data.length > 0 ? data[0] : undefined;
  }

  async createArticle(article: InsertArticle, userId: string): Promise<Article> {
    const [created] = await withUserContext(
      userId,
      async (db) => db
      .insert(articles)
      .values(article as Required<InsertArticle>)
      .returning() )
    return created;
  }

  async deleteArticle(id: string,userId: string): Promise<void> {
    withUserContext(
      userId,
      async (db) => db
        .delete(articles)
        .where(eq(articles.id,id))
    )
  }

  async deleteAllArticles(userId: string): Promise<number> {
    const result = await withUserContext(
      userId,
      async (db) => db
        .delete(articles)
        .where(eq(articles.userId,userId))
        .returning()
    )
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
      // Update existing setting with proper user-specific WHERE clause
      let whereCondition;
      if (userId !== undefined) {
        whereCondition = and(
          eq(settings.key, key),
          eq(settings.userId, userId)
        );
      } else {
        whereCondition = and(
          eq(settings.key, key),
          isNull(settings.userId)
        );
      }

      const [updated] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(whereCondition)
        .returning()
        .execute();
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