import { withUserContext } from "backend/db/with-user-context";
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
import { eq, and, isNull, sql, SQL, desc, inArray } from "drizzle-orm";
import { encrypt, decrypt } from "backend/utils/encryption";

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
  getSources(userId: string): Promise<ThreatSource[]>;
  getDefaultSources(userId: string): Promise<ThreatSource[]>;
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
  getKeyword(id: string, userId?: string): Promise<ThreatKeyword | undefined>;
  getKeywordsByCategory(
    category: string,
    userId?: string,
  ): Promise<ThreatKeyword[]>;
  createKeyword(keyword: InsertThreatKeyword, userId?: string): Promise<ThreatKeyword>;
  updateKeyword(
    id: string,
    keyword: Partial<ThreatKeyword>,
    userId?: string,
  ): Promise<ThreatKeyword>;
  deleteKeyword(id: string, userId?: string): Promise<void>;

  // Articles
  getArticle(id: string, userId?: string): Promise<ThreatArticle | undefined>;
  getArticleByUrl(url: string, userId: string): Promise<ThreatArticle | undefined>;
  getArticles(options?: {
    search?: string;
    keywordIds?: string[];
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    limit?: number;
    page?: number;
  }): Promise<ThreatArticle[]>;
  createArticle(article: InsertThreatArticle): Promise<ThreatArticle>;
  updateArticle(
    id: string,
    article: Partial<ThreatArticle>,
  ): Promise<ThreatArticle>;
  deleteArticle(id: string, userId?: string): Promise<void>;
  deleteAllArticles(userId?: string): Promise<boolean>;
  toggleArticleForCapsule(id: string, marked: boolean): Promise<boolean>;
  getArticlesMarkedForCapsule(userId?: string): Promise<ThreatArticle[]>;
  getSourceArticleCount(id: string): Promise<number>

  // Settings
  getSetting(key: string, userId?: string): Promise<ThreatSetting | undefined>;
  upsertSetting(
    key: string,
    value: any,
    userId?: string,
  ): Promise<ThreatSetting>;
  getAllAutoScrapeSettings(): Promise<ThreatSetting[]>;
}

export const storage: IStorage = {
  // SOURCES
  getSources: async (userId: string) => {
    try {
      console.log("[🔎 SOURCES] userId", userId);

      const query = db
        .select({
          id: threatSources.id,
          url: threatSources.url,
          name: threatSources.name,
          includeInAutoScrape: threatSources.includeInAutoScrape,
          scrapingConfig: threatSources.scrapingConfig,
          lastScraped: threatSources.lastScraped,
          userId: threatSources.userId,
          isDefault: threatSources.isDefault,
        })
        .from(threatSources)
        .where(eq(threatSources.userId, userId));

      return await query.execute();
    } catch (error) {
      console.error("Error fetching threat sources:", error);
      return [];
    }
  },

  getDefaultSources: async (userId: string) => {
    try {
      console.log("[🔎 DEFAULT SOURCES] userId", userId);

      const query = db
        .select({
          id: threatSources.id,
          url: threatSources.url,
          name: threatSources.name,
          includeInAutoScrape: threatSources.includeInAutoScrape,
          scrapingConfig: threatSources.scrapingConfig,
          lastScraped: threatSources.lastScraped,
          userId: threatSources.userId,
          isDefault: threatSources.isDefault,
        })
        .from(threatSources)
        .where(eq(threatSources.isDefault, true));

      return await query.execute();
    } catch (error) {
      console.error("Error fetching threat sources:", error);
      return [];
    }
  },

  getSource: async (id: string) => {
    try {
      const results = await db
        .select({
          id: threatSources.id,
          url: threatSources.url,
          name: threatSources.name,
          includeInAutoScrape: threatSources.includeInAutoScrape,
          scrapingConfig: threatSources.scrapingConfig,
          lastScraped: threatSources.lastScraped,
          userId: threatSources.userId,
          isDefault: threatSources.isDefault,
        })
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
      // Get default sources (available to all users when they scrape)
      const defaultSources = await db
        .select({
          id: threatSources.id,
          url: threatSources.url,
          name: threatSources.name,
          includeInAutoScrape: threatSources.includeInAutoScrape,
          scrapingConfig: threatSources.scrapingConfig,
          lastScraped: threatSources.lastScraped,
          userId: threatSources.userId,
          isDefault: threatSources.isDefault,
        })
        .from(threatSources)
        .where(
          and(
            eq(threatSources.isDefault, true),
            isNull(threatSources.userId),
            eq(threatSources.includeInAutoScrape, true),
          ),
        )
        .execute();

      let userSources: ThreatSource[] = [];
      if (userId) {
        userSources = await db
          .select({
            id: threatSources.id,
            url: threatSources.url,
            name: threatSources.name,
            includeInAutoScrape: threatSources.includeInAutoScrape,
            scrapingConfig: threatSources.scrapingConfig,
            lastScraped: threatSources.lastScraped,
            userId: threatSources.userId,
            isDefault: threatSources.isDefault,
          })
          .from(threatSources)
          .where(
            and(
              eq(threatSources.userId, userId),
              eq(threatSources.includeInAutoScrape, true),
            ),
          )
          .execute();
      }

      // Combine default and user sources
      return [...defaultSources, ...userSources];
    } catch (error) {
      console.error("Error fetching auto-scrape threat sources:", error);
      return [];
    }
  },

  createSource: async (source: {
    url: string;
    name: string;
    includeInAutoScrape?: boolean;
    scrapingConfig?: any;
    lastScraped?: Date;
    userId?: string;
    isDefault?: boolean;
}) => {
    try {
      if (!source.name || !source.url) {
        throw new Error("Source must have a name and URL");
      }

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
      // First check if this is a default source
      const source = await db
        .select({
          id: threatSources.id,
          url: threatSources.url,
          name: threatSources.name,
          includeInAutoScrape: threatSources.includeInAutoScrape,
          scrapingConfig: threatSources.scrapingConfig,
          lastScraped: threatSources.lastScraped,
          userId: threatSources.userId,
          isDefault: threatSources.isDefault,
        })
        .from(threatSources)
        .where(eq(threatSources.id, id))
        .execute();

      if (source.length > 0 && source[0].isDefault) {
        throw new Error("Cannot delete default sources");
      }

      // Check if there are associated threat articles
      const associatedArticles = await db
        .select({ count: sql<number>`count(*)` })
        .from(threatArticles)
        .where(eq(threatArticles.sourceId, id))
        .execute();

      const articleCount = associatedArticles[0]?.count || 0;

      if (articleCount > 0) {
        // Return special error object with article count for frontend handling
        const error = new Error(`ARTICLES_EXIST`);
        (error as any).articleCount = articleCount;
        throw error;
      }

      // Delete associated articles if requested
      if (articleCount > 0) {
        await db.delete(threatArticles).where(eq(threatArticles.sourceId, id));
      }

      // Delete the source
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
        if (category) userConditions.push(eq(threatKeywords.category, category));

        userKeywords = await withUserContext(
          userId,
          async (db) => db
            .select()
            .from(threatKeywords)
            .where(and(...userConditions))
        );
      }

      const decryptedDefaultKeywords = defaultKeywords.map(keyword => ({
        ...keyword,
        term: keyword.term
      }));

      const decryptedUserKeywords = userKeywords.map(keyword => ({
        ...keyword,
        term: decrypt(keyword.term)
      }));

      // Combine default and user keywords
      return [...decryptedDefaultKeywords, ...decryptedUserKeywords];
    } catch (error) {
      console.error("Error fetching threat keywords:", error);
      return [];
    }
  },

  getKeyword: async (id: string, userId?: string) => {
    try {
      if (!userId) {
        throw new Error("User ID is required for getKeyword");
      }
      
      const results = await withUserContext(
        userId,
        async (db) => db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.id, id))
          .limit(1)
      );
      
      if (results.length > 0) {
        const keyword = results[0];
        return {
          ...keyword,
          term: decrypt(keyword.term)
        };
      }
      return undefined;
    } catch (error) {
      console.error("Error fetching threat keyword:", error);
      throw error;
    }
  },

  getKeywordsByCategory: async (category: string, userId?: string) => {
    try {
      // Get default keywords for this category
      const defaultKeywords = await db
        .select()
        .from(threatKeywords)
        .where(
          and(
            eq(threatKeywords.category, category),
            eq(threatKeywords.isDefault, true),
            isNull(threatKeywords.userId),
          ),
        )
        .execute();

      // Get user-specific keywords if userId is provided
      let userKeywords: ThreatKeyword[] = [];
      if (userId) {
        userKeywords = await db
          .select()
          .from(threatKeywords)
          .where(
            and(
              eq(threatKeywords.category, category),
              eq(threatKeywords.userId, userId),
              eq(threatKeywords.isDefault, false),
            ),
          )
          .execute();
      }

      // Decrypt terms for both default and user keywords
      const decryptedDefaultKeywords = defaultKeywords.map(keyword => ({
        ...keyword,
        term: decrypt(keyword.term)
      }));

      const decryptedUserKeywords = userKeywords.map(keyword => ({
        ...keyword,
        term: decrypt(keyword.term)
      }));

      // Combine default and user keywords
      return [...decryptedDefaultKeywords, ...decryptedUserKeywords];
    } catch (error) {
      console.error("Error fetching threat keywords by category:", error);
      return [];
    }
  },

  createKeyword: async (keyword: InsertThreatKeyword, userId?: string) => {
    try {
      if (!userId && !keyword.userId) {
        throw new Error("User ID is required for createKeyword");
      }
      
      if (!keyword.term || !keyword.category) {
        throw new Error("Keyword must have a term and category");
      }

      // Prevent creation of default keywords by regular users
      if (keyword.isDefault === true) {
        throw new Error("Cannot create default keywords through this endpoint");
      }

      // Ensure isDefault is set to false for user keywords
      const keywordToCreate: {
          active?: boolean;
          userId?: string;
          isDefault?: boolean;
          term: string;
          category: "threat" | "vendor" | "client" | "hardware";
      } = {
        ...keyword,
        term: encrypt(keyword.term!), // Encrypt the term before saving
        category: keyword.category!,
        isDefault: keyword.isDefault || false,
      };

      const [result] = await withUserContext(
        userId || keyword.userId,
        async (db) => db
          .insert(threatKeywords)
          .values(keywordToCreate)
          .returning()
      );
      
      // Return with decrypted term for API consistency
      return {
        ...result,
        term: decrypt(result.term)
      };
    } catch (error) {
      console.error("Error creating threat keyword:", error);
      throw error;
    }
  },

  updateKeyword: async (id: string, keyword: Partial<ThreatKeyword>, userId?: string) => {
    try {
      if (!userId) {
        throw new Error("User ID is required for updateKeyword");
      }

      // First check if this is a default keyword using withUserContext
      const existingKeyword = await withUserContext(
        userId,
        async (db) => db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.id, id))
          .limit(1)
      );

      if (existingKeyword.length === 0) {
        throw new Error("Keyword not found");
      }

      if (existingKeyword[0].isDefault === true) {
        throw new Error("Cannot modify default keywords");
      }

      // Prevent changing isDefault flag through this endpoint
      const updateData = { ...keyword };
      delete (updateData as any).isDefault;
      
      // Encrypt the term if it's being updated
      if (updateData.term) {
        updateData.term = encrypt(updateData.term);
      }

      const [result] = await withUserContext(
        userId,
        async (db) => db
          .update(threatKeywords)
          .set(updateData)
          .where(eq(threatKeywords.id, id))
          .returning()
      );
      
      // Return with decrypted term for API consistency
      return {
        ...result,
        term: decrypt(result.term)
      };
    } catch (error) {
      console.error("Error updating threat keyword:", error);
      throw error;
    }
  },

  deleteKeyword: async (id: string, userId?: string) => {
    try {
      if (!userId) {
        throw new Error("User ID is required for deleteKeyword");
      }

      // First check if this is a default keyword using withUserContext
      const existingKeyword = await withUserContext(
        userId,
        async (db) => db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.id, id))
          .limit(1)
      );

      if (existingKeyword.length === 0) {
        throw new Error("Keyword not found");
      }

      if (existingKeyword[0].isDefault === true) {
        throw new Error("Cannot delete default keywords");
      }

      await withUserContext(
        userId,
        async (db) => db.delete(threatKeywords).where(eq(threatKeywords.id, id))
      );
    } catch (error) {
      console.error("Error deleting threat keyword:", error);
      throw error;
    }
  },

  // ARTICLES
  getArticles: async (options = {}) => {
    try {
      const { search, keywordIds, startDate, endDate, userId, limit, page } = options;
      const pageNum = page || 1;
      const pageSize = limit || 50;

      // Phase 3: Query-time filtering from global article pool
      // Step 1: Get user's enabled sources (all user sources for now)
      const userSources = await storage.getSources(userId);
      const defaultSources = await storage.getDefaultSources(userId);
      const allSources = [...userSources, ...defaultSources];
      const sourceIds = allSources.map(s => s.id);

      // Step 2: Get user's active keywords for filtering
      const userKeywords = await storage.getKeywords(undefined, userId);
      const activeKeywords = userKeywords
        .filter(k => k.active !== false)
        .map(k => k.term.toLowerCase());

      // Build WHERE clause based on search parameters
      const conditions = [];

      // Filter by user's sources only (no userId filter on articles)
      if (sourceIds.length > 0) {
        conditions.push(inArray(threatArticles.sourceId, sourceIds));
      } else {
        // If user has no sources, return empty results
        return [];
      }

      // Phase 2.2: Filter for cybersecurity articles only
      // Check if detectedKeywords contains "_cyber:true"
      conditions.push(
        sql`${threatArticles.detectedKeywords}->>'_cyber' = 'true'`
      );

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

      // Add date range filters - use publishDate for filtering
      if (startDate) {
        conditions.push(sql`${threatArticles.publishDate} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${threatArticles.publishDate} <= ${endDate}`);
      }

      // Build the query for global articles with proper chaining
      const baseQuery = db.select().from(threatArticles);
      
      // Apply conditions and build complete query
      const finalQuery = conditions.length > 0 
        ? baseQuery
            .where(and(...conditions))
            .orderBy(
              desc(sql`COALESCE(${threatArticles.publishDate}, ${threatArticles.scrapeDate})`),
              desc(threatArticles.scrapeDate)
            )
            .limit(pageSize)
            .offset((pageNum - 1) * pageSize)
        : baseQuery
            .orderBy(
              desc(sql`COALESCE(${threatArticles.publishDate}, ${threatArticles.scrapeDate})`),
              desc(threatArticles.scrapeDate)
            )
            .limit(pageSize)
            .offset((pageNum - 1) * pageSize);

      // Execute the query
      const result = await finalQuery.execute();

      // Step 3: Apply keyword filtering (in memory for now)
      if (activeKeywords.length > 0) {
        return result.filter(article => {
          const searchText = `${article.title} ${article.content}`.toLowerCase();
          const detectedKeywordsText = JSON.stringify(article.detectedKeywords || {}).toLowerCase();
          return activeKeywords.some(keyword => 
            searchText.includes(keyword) || detectedKeywordsText.includes(keyword)
          );
        });
      }

      return result;
    } catch (error) {
      console.error("Error fetching threat articles:", error);
      return [];
    }
  },

  getArticle: async (id: string, userId?: string) => {
    try {
      const conditions = [eq(threatArticles.id, id)];
      // CRITICAL FIX: Always filter by user when provided
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
      const results = await db
        .select()
        .from(threatArticles)
        .where(and(
          eq(threatArticles.url, url),
          eq(threatArticles.userId, userId)
        ))
        .limit(1)
        .execute();
      return results[0];
    } catch (error) {
      console.error("Error fetching threat article by URL:", error);
      return undefined;
    }
  },

  createArticle: async (article: {
      url: string;
      userId?: string;
      sourceId?: string;
      title: string;
      content: string;
      author?: string;
      publishDate?: Date;
      summary?: string;
      relevanceScore?: string;
      securityScore?: string;
      detectedKeywords?: any;
      markedForCapsule?: boolean;
  }) => {
    try {
      // CRITICAL FIX: Ensure userId is always provided when creating articles
      if (!article.userId) {
        throw new Error("Article must be associated with a user");
      }

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

      // CRITICAL FIX: Always require userId for deletion to prevent cross-user deletions
      if (userId) {
        conditions.push(eq(threatArticles.userId, userId));
      } else {
        throw new Error("User ID required for article deletion");
      }

      await db.delete(threatArticles).where(and(...conditions));
    } catch (error) {
      console.error("Error deleting threat article:", error);
      throw error;
    }
  },

  deleteAllArticles: async (userId?: string) => {
    try {
      // CRITICAL FIX: Always require userId to prevent global deletions
      if (!userId) {
        console.error(
          "Attempted to delete all articles without specifying userId",
        );
        return false;
      }

      // Only delete articles for this specific user
      await db
        .delete(threatArticles)
        .where(eq(threatArticles.userId, userId));
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
      // CRITICAL FIX: Always filter by user when provided
      if (userId) {
        conditions.push(eq(threatArticles.userId, userId));
      }

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
      const conditions = [eq(threatSettings.key, key)];
      // CRITICAL FIX: Always filter by user when provided for user-specific settings
      if (userId) {
        conditions.push(eq(threatSettings.userId, userId));
      } else {
        // For global settings, ensure userId is null
        conditions.push(isNull(threatSettings.userId));
      }

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

  getAllAutoScrapeSettings: async () => {
    try {
      const results = await db
        .select()
        .from(threatSettings)
        .where(eq(threatSettings.key, "auto-scrape"));
      return results;
    } catch (error) {
      console.error("Error fetching all auto-scrape settings:", error);
      return [];
    }
  },

  getSourceArticleCount: async (id: string) => {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(threatArticles)
        .where(eq(threatArticles.sourceId, id))
        .execute();
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting source article count:", error);
      return 0;
    }
  },
};
