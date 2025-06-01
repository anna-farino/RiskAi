import type {
  ThreatSource,
  InsertThreatSource,
  ThreatKeyword,
  InsertThreatKeyword,
  ThreatArticle,
  InsertThreatArticle,
  ThreatSetting,
} from "shared/db/schema/threat-tracker/index";
import {
  threatSources,
  threatKeywords,
  threatArticles,
  threatSettings,
} from "@shared/db/schema/threat-tracker/index";
import { db, pool } from "backend/db/db";
import { eq, and, isNull, sql, SQL, desc, inArray } from "drizzle-orm";

// Helper function to execute SQL with parameters
async function executeRawSql<T>(
  sqlStr: string,
  params: any[] = [],
): Promise<T[]> {
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
  updateSource(
    id: string,
    source: Partial<ThreatSource>,
  ): Promise<ThreatSource>;
  deleteSource(id: string): Promise<void>;

  // Keywords
  getKeywords(category?: string, userId?: string): Promise<ThreatKeyword[]>;
  getKeyword(id: string): Promise<ThreatKeyword | undefined>;
  getKeywordsByCategory(
    category: string,
    userId?: string,
  ): Promise<ThreatKeyword[]>;
  createKeyword(keyword: InsertThreatKeyword): Promise<ThreatKeyword>;
  updateKeyword(
    id: string,
    keyword: Partial<ThreatKeyword>,
  ): Promise<ThreatKeyword>;
  deleteKeyword(id: string): Promise<void>;

  // Articles
  getArticle(id: string, userId?: string): Promise<ThreatArticle | undefined>;
  getArticles(options?: {
    search?: string;
    keywordIds?: string[];
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): Promise<ThreatArticle[]>;
  getArticleByUrl(url: string, userId: string): Promise<ThreatArticle | undefined>;
  createArticle(article: InsertThreatArticle): Promise<ThreatArticle>;
  updateArticle(
    id: string,
    article: Partial<ThreatArticle>,
  ): Promise<ThreatArticle>;
  deleteArticle(id: string, userId?: string): Promise<void>;
  deleteAllArticles(userId?: string): Promise<boolean>;
  toggleArticleForCapsule(id: string, marked: boolean): Promise<boolean>;
  getArticlesMarkedForCapsule(userId?: string): Promise<ThreatArticle[]>;

  // Settings
  getSetting(key: string, userId?: string): Promise<ThreatSetting | undefined>;
  upsertSetting(
    key: string,
    value: any,
    userId?: string,
  ): Promise<ThreatSetting>;
}

export const storage: IStorage = {
  // SOURCES
  getSources: async (userId?: string) => {
    try {
      const conditions = [];
      if (userId) conditions.push(eq(threatSources.userId, userId));

      const query = db.select().from(threatSources);

      const finalQuery = conditions.length
        ? query.where(and(...conditions))
        : query;

      return await finalQuery.execute();
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
        .where(eq(threatSources.id, id))
        .execute();
      return results[0];
    } catch (error) {
      console.error("Error fetching threat source:", error);
      return undefined;
    }
  },

  getAutoScrapeSources: async (userId?: string) => {
    try {
      const conditions = [
        eq(threatSources.active, true),
        eq(threatSources.includeInAutoScrape, true),
      ];
      if (userId) conditions.push(eq(threatSources.userId, userId));

      return await db
        .select()
        .from(threatSources)
        .where(and(...conditions))
        .execute();
    } catch (error) {
      console.error("Error fetching auto-scrape threat sources:", error);
      return [];
    }
  },

  createSource: async (source: InsertThreatSource) => {
    try {
      if (!source.name || !source.url) {
        throw new Error("Source must have a name and URL");
      }

      const results = await db.insert(threatSources).values(source).returning();
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
      await db.delete(threatSources).where(eq(threatSources.id, id));
    } catch (error) {
      console.error("Error deleting threat source:", error);
      throw error;
    }
  },

  // KEYWORDS
  getKeywords: async (category?: string, userId?: string) => {
    try {
      // Get default keywords (isDefault = true, userId = null)
      const defaultConditions = [
        eq(threatKeywords.isDefault, true),
        isNull(threatKeywords.userId),
      ];
      if (category)
        defaultConditions.push(eq(threatKeywords.category, category));

      const defaultKeywords = await db
        .select()
        .from(threatKeywords)
        .where(and(...defaultConditions))
        .execute();

      // Get user-specific keywords if userId is provided
      let userKeywords: ThreatKeyword[] = [];
      if (userId) {
        const userConditions = [
          eq(threatKeywords.userId, userId),
          eq(threatKeywords.isDefault, false),
        ];
        if (category)
          userConditions.push(eq(threatKeywords.category, category));

        userKeywords = await db
          .select()
          .from(threatKeywords)
          .where(and(...userConditions))
          .execute();
      }

      // Combine and return both default and user keywords
      return [...defaultKeywords, ...userKeywords];
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
        .where(eq(threatKeywords.id, id))
        .execute();
      return results[0];
    } catch (error) {
      console.error("Error fetching threat keyword:", error);
      return undefined;
    }
  },

  getKeywordsByCategory: async (category: string, userId?: string) => {
    try {
      // Get default keywords for this category
      const defaultConditions = [
        eq(threatKeywords.category, category),
        eq(threatKeywords.isDefault, true),
        isNull(threatKeywords.userId),
      ];

      const defaultKeywords = await db
        .select()
        .from(threatKeywords)
        .where(and(...defaultConditions))
        .execute();

      // Get user-specific keywords for this category if userId is provided
      let userKeywords: ThreatKeyword[] = [];
      if (userId) {
        const userConditions = [
          eq(threatKeywords.category, category),
          eq(threatKeywords.userId, userId),
          eq(threatKeywords.isDefault, false),
        ];

        userKeywords = await db
          .select()
          .from(threatKeywords)
          .where(and(...userConditions))
          .execute();
      }

      // Combine and return both default and user keywords
      return [...defaultKeywords, ...userKeywords];
    } catch (error) {
      console.error(`Error fetching ${category} keywords:`, error);
      return [];
    }
  },

  createKeyword: async (keyword: InsertThreatKeyword) => {
    try {
      if (!keyword.term || !keyword.category) {
        throw new Error("Keyword must have a term and category");
      }

      // Prevent creation of default keywords by regular users
      if (keyword.isDefault === true) {
        throw new Error("Cannot create default keywords through this endpoint");
      }

      // Ensure isDefault is set to false for user keywords
      const keywordToCreate: InsertThreatKeyword = {
        ...keyword,
        isDefault: false,
      };

      const results = await db
        .insert(threatKeywords)
        .values(keywordToCreate)
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error creating threat keyword:", error);
      throw error;
    }
  },

  updateKeyword: async (id: string, keyword: Partial<ThreatKeyword>) => {
    try {
      // First check if this is a default keyword
      const existingKeyword = await db
        .select()
        .from(threatKeywords)
        .where(eq(threatKeywords.id, id))
        .execute();

      if (existingKeyword.length === 0) {
        throw new Error("Keyword not found");
      }

      if (existingKeyword[0].isDefault === true) {
        throw new Error("Cannot modify default keywords");
      }

      // Prevent changing isDefault flag through this endpoint
      const updateData = { ...keyword };
      delete updateData.isDefault;

      const results = await db
        .update(threatKeywords)
        .set(updateData)
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
      // First check if this is a default keyword
      const existingKeyword = await db
        .select()
        .from(threatKeywords)
        .where(eq(threatKeywords.id, id))
        .execute();

      if (existingKeyword.length === 0) {
        throw new Error("Keyword not found");
      }

      if (existingKeyword[0].isDefault === true) {
        throw new Error("Cannot delete default keywords");
      }

      await db.delete(threatKeywords).where(eq(threatKeywords.id, id));
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
      if (search && search.trim().length > 0) {
        const searchTerm = search.trim();

        // For short terms (< 5 characters), use exact word boundary matching
        // For longer terms, use partial matching
        let searchCondition;
        if (searchTerm.length < 5) {
          // Exact word matching using regex word boundaries
          searchCondition = sql`(
            ${threatArticles.title} ~* ${`\\y${searchTerm}\\y`} OR 
            ${threatArticles.content} ~* ${`\\y${searchTerm}\\y`} OR
            ${threatArticles.detectedKeywords}->>'threats' ~* ${`\\y${searchTerm}\\y`} OR
            ${threatArticles.detectedKeywords}->>'vendors' ~* ${`\\y${searchTerm}\\y`} OR
            ${threatArticles.detectedKeywords}->>'clients' ~* ${`\\y${searchTerm}\\y`} OR
            ${threatArticles.detectedKeywords}->>'hardware' ~* ${`\\y${searchTerm}\\y`}
          )`;
        } else {
          // Partial matching for longer terms
          searchCondition = sql`(
            ${threatArticles.title} ILIKE ${"%" + searchTerm + "%"} OR 
            ${threatArticles.content} ILIKE ${"%" + searchTerm + "%"} OR
            ${threatArticles.detectedKeywords}->>'threats' ILIKE ${"%" + searchTerm + "%"} OR
            ${threatArticles.detectedKeywords}->>'vendors' ILIKE ${"%" + searchTerm + "%"} OR
            ${threatArticles.detectedKeywords}->>'clients' ILIKE ${"%" + searchTerm + "%"} OR
            ${threatArticles.detectedKeywords}->>'hardware' ILIKE ${"%" + searchTerm + "%"}
          )`;
        }
        conditions.push(searchCondition);
      }

      // Add keyword filter using detected keywords JSON
      if (keywordIds && keywordIds.length > 0) {
        // Get the keywords terms for these IDs
        const keywordResults = await db
          .select()
          .from(threatKeywords)
          .where(inArray(threatKeywords.id, keywordIds));

        if (keywordResults.length) {
          const keywordTerms = keywordResults.map((k) => k.term.toLowerCase());

          // Search within the detectedKeywords JSON structure
          const keywordConditions = keywordTerms.map((term) => {
            return sql`(
              ${threatArticles.detectedKeywords}->>'threats' ILIKE ${"%" + term + "%"} OR
              ${threatArticles.detectedKeywords}->>'vendors' ILIKE ${"%" + term + "%"} OR
              ${threatArticles.detectedKeywords}->>'clients' ILIKE ${"%" + term + "%"} OR
              ${threatArticles.detectedKeywords}->>'hardware' ILIKE ${"%" + term + "%"}
            )`;
          });

          // Combine all keyword conditions with OR (matches any selected keyword)
          const combinedKeywordCondition = sql`(${sql.join(keywordConditions, sql` OR `)})`;
          conditions.push(combinedKeywordCondition);
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
        (query as any) = query.where(and(...conditions));
      }

      // Order by most recent
      const orderedQuery = query.orderBy(desc(threatArticles.scrapeDate));

      // Execute the query
      const result = await orderedQuery.execute();
      return result;
    } catch (error) {
      console.error("Error fetching threat articles:", error);
      return [];
    }
  },

  getArticle: async (id: string, userId?: string) => {
    try {
      const conditions = [eq(threatArticles.id, id)];
      if (userId) {
        conditions.push(eq(threatArticles.userId, userId));
      }

      const results = await db
        .select()
        .from(threatArticles)
        .where(and(...conditions))
        .execute();
      return results[0];
    } catch (error) {
      console.error("Error fetching threat article:", error);
      return undefined;
    }
  },

  getArticleByUrl: async (url: string, userId: string) => {
    try {
      const conditions = [
        eq(threatArticles.url, url),
        eq(threatArticles.userId, userId)
      ];

      const results = await db
        .select()
        .from(threatArticles)
        .where(and(...conditions))
        .execute();
      return results[0];
    } catch (error) {
      console.error("Error fetching threat article by URL:", error);
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

  deleteArticle: async (id: string, userId?: string) => {
    try {
      const conditions = [eq(threatArticles.id, id)];

      // If userId is provided, only delete the article if it belongs to that user
      if (userId) {
        conditions.push(eq(threatArticles.userId, userId));
      }

      await db.delete(threatArticles).where(and(...conditions));
    } catch (error) {
      console.error("Error deleting threat article:", error);
      throw error;
    }
  },

  deleteAllArticles: async (userId?: string) => {
    try {
      if (userId) {
        // Only delete articles for this specific user
        await db
          .delete(threatArticles)
          .where(eq(threatArticles.userId, userId));
        return true;
      } else {
        // If no userId is provided, we shouldn't delete anything
        // This protects against accidentally deleting all users' articles
        console.error(
          "Attempted to delete all articles without specifying userId",
        );
        return false;
      }
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
      console.error(
        "Error fetching threat articles marked for capsule:",
        error,
      );
      return [];
    }
  },

  // SETTINGS
  getSetting: async (key: string, userId?: string) => {
    try {
      // Create user-specific key to work around unique constraint
      const actualKey = userId ? `${key}_user_${userId}` : key;
      
      const results = await db
        .select()
        .from(threatSettings)
        .where(eq(threatSettings.key, actualKey));
      return results[0];
    } catch (error) {
      console.error("Error fetching threat setting:", error);
      return undefined;
    }
  },

  upsertSetting: async (key: string, value: any, userId?: string) => {
    try {
      // Create user-specific key to work around unique constraint
      const actualKey = userId ? `${key}_user_${userId}` : key;
      
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
        // Create new setting with user-specific key
        const settingData = {
          key: actualKey,
          value,
          userId: userId || null,
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
