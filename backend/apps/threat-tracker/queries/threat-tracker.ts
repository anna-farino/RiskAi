import type { 
  ThreatSource, 
  InsertThreatSource, 
  ThreatKeyword, 
  InsertThreatKeyword, 
  ThreatArticle, 
  InsertThreatArticle, 
  ThreatSetting, 
} from "@shared/db/schema/threat-tracker/index";
import { 
  threatSources, 
  threatKeywords, 
  threatArticles, 
  threatSettings, 
} from "@shared/db/schema/threat-tracker/index";
import { db, pool } from "backend/db/db";
import { eq, and, isNull, sql, SQL, desc } from "drizzle-orm";

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
  getSources(userId?: string): Promise<ThreatSource[]>;
  getSource(id: string): Promise<ThreatSource | undefined>;
  getAutoScrapeSources(userId?: string): Promise<ThreatSource[]>;
  createSource(source: InsertThreatSource): Promise<ThreatSource>;
  updateSource(id: string, source: Partial<ThreatSource>): Promise<ThreatSource>;
  deleteSource(id: string): Promise<void>;

  // Keywords 
  getKeywords(category?: string, userId?: string): Promise<ThreatKeyword[]>;
  getKeyword(id: string): Promise<ThreatKeyword | undefined>;
  getKeywordsByCategory(category: string, userId?: string): Promise<ThreatKeyword[]>;
  createKeyword(keyword: InsertThreatKeyword): Promise<ThreatKeyword>;
  updateKeyword(id: string, keyword: Partial<ThreatKeyword>): Promise<ThreatKeyword>;
  deleteKeyword(id: string): Promise<void>;

  // Articles
  getArticles(
    options?: {
      search?: string;
      keywordIds?: string[];
      startDate?: Date;
      endDate?: Date;
      userId?: string;
    }
  ): Promise<ThreatArticle[]>;
  getArticle(id: string): Promise<ThreatArticle | undefined>;
  createArticle(article: InsertThreatArticle): Promise<ThreatArticle>;
  updateArticle(id: string, article: Partial<ThreatArticle>): Promise<ThreatArticle>;
  deleteArticle(id: string): Promise<void>;
  deleteAllArticles(userId?: string): Promise<boolean>;
  toggleArticleForCapsule(id: string, marked: boolean): Promise<boolean>;
  getArticlesMarkedForCapsule(userId?: string): Promise<ThreatArticle[]>;

  // Settings
  getSetting(key: string, userId?: string): Promise<ThreatSetting | undefined>;
  upsertSetting(key: string, value: any, userId?: string): Promise<ThreatSetting>;
}

export const storage: IStorage = {
  // SOURCES
  getSources: async (userId?: string) => {
    try {
      const conditions = [];
      if (userId) conditions.push(eq(threatSources.userId, userId));
      
      return await db
        .select()
        .from(threatSources)
        .where(
          conditions.length ? and(...conditions) : undefined
        );
    } catch (error) {
      console.error("Error fetching threat sources:", error);
      return [];
    }
  },

  getSource: async (id: string) => {
    try {
      const results = await db
        .select()
        .from(threatSources)
        .where(eq(threatSources.id, id));
      return results[0];
    } catch (error) {
      console.error("Error fetching threat source:", error);
      return undefined;
    }
  },

  getAutoScrapeSources: async (userId?: string) => {
    try {
      const conditions = [eq(threatSources.active, true), eq(threatSources.includeInAutoScrape, true)];
      if (userId) conditions.push(eq(threatSources.userId, userId));
      
      return await db
        .select()
        .from(threatSources)
        .where(and(...conditions));
    } catch (error) {
      console.error("Error fetching auto-scrape threat sources:", error);
      return [];
    }
  },

  createSource: async (source: InsertThreatSource) => {
    try {
      const results = await db
        .insert(threatSources)
        .values(source)
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error creating threat source:", error);
      throw error;
    }
  },

  updateSource: async (id: string, source: Partial<ThreatSource>) => {
    try {
      const results = await db
        .update(threatSources)
        .set(source)
        .where(eq(threatSources.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error updating threat source:", error);
      throw error;
    }
  },

  deleteSource: async (id: string) => {
    try {
      await db
        .delete(threatSources)
        .where(eq(threatSources.id, id));
    } catch (error) {
      console.error("Error deleting threat source:", error);
      throw error;
    }
  },

  // KEYWORDS
  getKeywords: async (category?: string, userId?: string) => {
    try {
      const conditions = [];
      if (category) conditions.push(eq(threatKeywords.category, category));
      if (userId) conditions.push(eq(threatKeywords.userId, userId));
      
      return await db
        .select()
        .from(threatKeywords)
        .where(
          conditions.length ? and(...conditions) : undefined
        );
    } catch (error) {
      console.error("Error fetching threat keywords:", error);
      return [];
    }
  },

  getKeyword: async (id: string) => {
    try {
      const results = await db
        .select()
        .from(threatKeywords)
        .where(eq(threatKeywords.id, id));
      return results[0];
    } catch (error) {
      console.error("Error fetching threat keyword:", error);
      return undefined;
    }
  },

  getKeywordsByCategory: async (category: string, userId?: string) => {
    try {
      const conditions = [eq(threatKeywords.category, category)];
      if (userId) conditions.push(eq(threatKeywords.userId, userId));
      
      return await db
        .select()
        .from(threatKeywords)
        .where(and(...conditions));
    } catch (error) {
      console.error(`Error fetching ${category} keywords:`, error);
      return [];
    }
  },

  createKeyword: async (keyword: InsertThreatKeyword) => {
    try {
      const results = await db
        .insert(threatKeywords)
        .values(keyword)
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error creating threat keyword:", error);
      throw error;
    }
  },

  updateKeyword: async (id: string, keyword: Partial<ThreatKeyword>) => {
    try {
      const results = await db
        .update(threatKeywords)
        .set(keyword)
        .where(eq(threatKeywords.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error updating threat keyword:", error);
      throw error;
    }
  },

  deleteKeyword: async (id: string) => {
    try {
      await db
        .delete(threatKeywords)
        .where(eq(threatKeywords.id, id));
    } catch (error) {
      console.error("Error deleting threat keyword:", error);
      throw error;
    }
  },

  // ARTICLES
  getArticles: async (options = {}) => {
    try {
      const { search, keywordIds, startDate, endDate, userId } = options;
      let query = db.select().from(threatArticles);

      // Build WHERE clause based on search parameters
      const conditions = [];
      
      // Add user filter if specified
      if (userId) {
        conditions.push(eq(threatArticles.userId, userId));
      }

      // Add search term filter
      if (search) {
        // Using ilike for case-insensitive search with PostgreSQL
        const searchCondition = sql`(${threatArticles.title} ILIKE ${'%' + search + '%'} OR ${threatArticles.content} ILIKE ${'%' + search + '%'})`;
        conditions.push(searchCondition);
      }

      // Add keyword filter (this is more complex as we need to search in JSON)
      if (keywordIds && keywordIds.length > 0) {
        // Get the keywords terms for these IDs
        const keywordResults = await db
          .select()
          .from(threatKeywords)
          .where(sql`${threatKeywords.id} = ANY(${keywordIds})`);

        if (keywordResults.length) {
          // This is a complex condition because we're searching inside JSON arrays
          // We'll use raw SQL for this
          const keywordTerms = keywordResults.map(k => k.term);
          
          // Create a condition that checks if any of the keyword terms are in any of the JSON arrays
          const keywordCondition = sql`
            ${threatArticles.detectedKeywords}->>'threats' ? ANY(${keywordTerms}) OR
            ${threatArticles.detectedKeywords}->>'vendors' ? ANY(${keywordTerms}) OR
            ${threatArticles.detectedKeywords}->>'clients' ? ANY(${keywordTerms}) OR
            ${threatArticles.detectedKeywords}->>'hardware' ? ANY(${keywordTerms})
          `;
          conditions.push(keywordCondition);
        }
      }

      // Add date range filters
      if (startDate) {
        conditions.push(sql`${threatArticles.scrapeDate} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${threatArticles.scrapeDate} <= ${endDate}`);
      }

      // Apply conditions if any exist
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Order by most recent
      query = query.orderBy(desc(threatArticles.scrapeDate));

      // Execute the query
      return await query;
    } catch (error) {
      console.error("Error fetching threat articles:", error);
      return [];
    }
  },

  getArticle: async (id: string) => {
    try {
      const results = await db
        .select()
        .from(threatArticles)
        .where(eq(threatArticles.id, id));
      return results[0];
    } catch (error) {
      console.error("Error fetching threat article:", error);
      return undefined;
    }
  },

  createArticle: async (article: InsertThreatArticle) => {
    try {
      const results = await db
        .insert(threatArticles)
        .values(article)
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error creating threat article:", error);
      throw error;
    }
  },

  updateArticle: async (id: string, article: Partial<ThreatArticle>) => {
    try {
      const results = await db
        .update(threatArticles)
        .set(article)
        .where(eq(threatArticles.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error updating threat article:", error);
      throw error;
    }
  },

  deleteArticle: async (id: string) => {
    try {
      await db
        .delete(threatArticles)
        .where(eq(threatArticles.id, id));
    } catch (error) {
      console.error("Error deleting threat article:", error);
      throw error;
    }
  },

  deleteAllArticles: async (userId?: string) => {
    try {
      if (userId) {
        await db
          .delete(threatArticles)
          .where(eq(threatArticles.userId, userId));
      } else {
        await db.delete(threatArticles);
      }
      return true;
    } catch (error) {
      console.error("Error deleting all threat articles:", error);
      return false;
    }
  },

  toggleArticleForCapsule: async (id: string, marked: boolean) => {
    try {
      await db
        .update(threatArticles)
        .set({ markedForCapsule: marked })
        .where(eq(threatArticles.id, id));
      return true;
    } catch (error) {
      console.error("Error toggling article for capsule:", error);
      return false;
    }
  },

  getArticlesMarkedForCapsule: async (userId?: string) => {
    try {
      const conditions = [eq(threatArticles.markedForCapsule, true)];
      if (userId) conditions.push(eq(threatArticles.userId, userId));
      
      return await db
        .select()
        .from(threatArticles)
        .where(and(...conditions))
        .orderBy(desc(threatArticles.scrapeDate));
    } catch (error) {
      console.error("Error fetching threat articles marked for capsule:", error);
      return [];
    }
  },

  // SETTINGS
  getSetting: async (key: string, userId?: string) => {
    try {
      const conditions = [eq(threatSettings.key, key)];
      if (userId) conditions.push(eq(threatSettings.userId, userId));
      
      const results = await db
        .select()
        .from(threatSettings)
        .where(and(...conditions));
      return results[0];
    } catch (error) {
      console.error("Error fetching threat setting:", error);
      return undefined;
    }
  },

  upsertSetting: async (key: string, value: any, userId?: string) => {
    try {
      // Check if the setting exists
      const existingSetting = await storage.getSetting(key, userId);
      
      if (existingSetting) {
        // Update existing setting
        const results = await db
          .update(threatSettings)
          .set({ value })
          .where(eq(threatSettings.id, existingSetting.id))
          .returning();
        return results[0];
      } else {
        // Create new setting
        const settingData = {
          key,
          value,
          userId: userId || null
        };
        
        const results = await db
          .insert(threatSettings)
          .values(settingData)
          .returning();
        return results[0];
      }
    } catch (error) {
      console.error("Error upserting threat setting:", error);
      throw error;
    }
  },
};