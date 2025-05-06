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
import { db, pool } from "backend/db/db";
import { eq, and, isNull, sql, SQL } from "drizzle-orm";

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
  getArticles(userId?: string, filters?: { 
    search?: string, 
    keywordIds?: string[],
    startDate?: Date,
    endDate?: Date
  }): Promise<Article[]>;
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
    const [keyword] = await db.select().from(keywords).where(eq(keywords.id, id));
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
    userId?: string, 
    filters?: { 
      search?: string, 
      keywordIds?: string[],
      startDate?: Date,
      endDate?: Date
    }
  ): Promise<Article[]> {
    // Build SQL parts separately
    let sqlParts = ["SELECT * FROM articles WHERE 1=1"];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Add user filter
    if (userId) {
      sqlParts.push(`AND user_id = $${paramIndex++}`);
      params.push(userId);
    }
    
    // Apply search filter if provided (case insensitive search in title and content)
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      sqlParts.push(`AND (title ILIKE $${paramIndex++} OR content ILIKE $${paramIndex++})`);
      params.push(searchTerm, searchTerm);
    }
    
    // Apply date range filter
    if (filters?.startDate) {
      sqlParts.push(`AND publish_date >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      sqlParts.push(`AND publish_date <= $${paramIndex++}`);
      params.push(filters.endDate);
    }
    
    // Apply keyword filter if provided
    if (filters?.keywordIds && filters.keywordIds.length > 0) {
      // First, get the keyword terms for the given IDs
      const keywordTerms = await this.getKeywordTermsById(filters.keywordIds);
      console.log("Found keyword terms for filtering:", keywordTerms);
      
      if (keywordTerms.length > 0) {
        // Build conditions for each keyword term
        const keywordConditions = keywordTerms.map((term: string) => {
          // Add condition to check if JSON array contains the term (convert to text to ensure case-insensitive match)
          const condition = `EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(detected_keywords) 
            WHERE value ILIKE $${paramIndex++}
          )`;
          params.push(`%${term}%`);
          return condition;
        });
        
        // Combine all keyword conditions with OR
        sqlParts.push(`AND (${keywordConditions.join(' OR ')})`);
      }
    }
    
    // Combine all SQL parts
    const finalSql = sqlParts.join(' ');
    
    // Use helper function to execute the query
    return await executeRawSql<Article>(finalSql, params);
  }

  async getArticle(id: string): Promise<Article | undefined> {
    // Use helper function to execute the query
    const articles = await executeRawSql<Article>('SELECT * FROM articles WHERE id = $1 LIMIT 1', [id]);
    return articles.length > 0 ? articles[0] : undefined;
  }

  async getArticleByUrl(url: string, userId?: string): Promise<Article | undefined> {
    // Build query string
    let sqlStr = "SELECT * FROM articles WHERE url = $1";
    const params: any[] = [url];
    
    if (userId) {
      sqlStr += " AND user_id = $2";
      params.push(userId);
    }
    
    sqlStr += " LIMIT 1";
    
    // Use helper function to execute the query
    const articles = await executeRawSql<Article>(sqlStr, params);
    return articles.length > 0 ? articles[0] : undefined;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [created] = await db
      .insert(articles)
      .values(article as Required<InsertArticle>)
      .returning();
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
