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
import {
  globalArticles,
  globalSources,
  userSourcePreferences,
} from "@shared/db/schema/global-tables";
import { articleRelevanceScores } from "@shared/db/schema/threat-tracker/relevance-scoring";
import {
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleCves,
  articleThreatActors,
} from "@shared/db/schema/threat-tracker/entity-associations";
import {
  usersSoftware,
  usersHardware,
  usersCompanies,
} from "@shared/db/schema/threat-tracker/user-associations";
import {
  software,
  hardware,
  companies,
  threatActors,
} from "@shared/db/schema/threat-tracker/entities";
import { db, pool } from "backend/db/db";
import {
  eq,
  and,
  isNull,
  sql,
  SQL,
  desc,
  inArray,
  gte,
  lte,
  or,
  ilike,
  exists,
} from "drizzle-orm";
import {
  envelopeDecryptAndRotate,
  envelopeEncrypt,
} from "backend/utils/encryption-new";

// Helper function to execute SQL with parameters
async function executeRawSql<T>(
  sqlStr: string,
  params: any[] = [],
): Promise<T[]> {
  try {
    // Direct execution with the pool instead of through drizzle
    // Use query object format for compatibility with both PgPool and NeonPool
    const result = await pool.query({
      text: sqlStr,
      values: params
    } as any);
    return (result as any).rows as T[];
  } catch (error) {
    console.error("SQL execution error:", error);
    return [];
  }
}

// Helper function to get user's enabled sources from user_source_preferences
async function getUserEnabledSources(
  userId: string,
  appContext: "news_radar" | "threat_tracker",
): Promise<string[]> {
  try {
    const enabledSources = await db
      .select({ sourceId: userSourcePreferences.sourceId })
      .from(userSourcePreferences)
      .where(
        and(
          eq(userSourcePreferences.userId, userId),
          eq(userSourcePreferences.appContext, appContext),
          eq(userSourcePreferences.isEnabled, true),
        ),
      );

    return enabledSources.map((s) => s.sourceId);
  } catch (error) {
    console.error("Error getting user enabled sources:", error);
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
  createKeyword(
    keyword: InsertThreatKeyword,
    userId?: string,
  ): Promise<ThreatKeyword>;
  updateKeyword(
    id: string,
    keyword: Partial<ThreatKeyword>,
    userId?: string,
  ): Promise<ThreatKeyword>;
  deleteKeyword(id: string, userId?: string): Promise<void>;

  // Articles
  getArticle(id: string, userId?: string): Promise<ThreatArticle | undefined>;
  getArticleByUrl(
    url: string,
    userId: string,
  ): Promise<ThreatArticle | undefined>;
  getArticles(options?: {
    search?: string;
    keywordIds?: string[];
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    limit?: number;
    page?: number;
    sortBy?: string;
    entityFilter?: {
      type: 'software' | 'hardware' | 'vendor' | 'client';
      name: string;
    };
  }): Promise<ThreatArticle[]>;
  createArticle(article: {
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
    threatSeverityScore?: number;
    threatMetadata?: any;
    threatLevel?: string;
    entitiesExtracted?: boolean;
    detectedKeywords?: any;
    markedForCapsule?: boolean;
  }): Promise<ThreatArticle>;
  updateArticle(
    id: string,
    article: Partial<ThreatArticle>,
  ): Promise<ThreatArticle>;
  deleteArticle(id: string, userId?: string): Promise<void>;
  deleteAllArticles(userId?: string): Promise<boolean>;
  toggleArticleForCapsule(id: string, marked: boolean): Promise<boolean>;
  getArticlesMarkedForCapsule(userId?: string): Promise<ThreatArticle[]>;
  getSourceArticleCount(id: string): Promise<number>;

  // Settings
  getSetting(key: string, userId?: string): Promise<ThreatSetting | undefined>;
  upsertSetting(
    key: string,
    value: any,
    userId?: string,
  ): Promise<ThreatSetting>;
  getAllAutoScrapeSettings(): Promise<ThreatSetting[]>;

  // Threat Actors
  getThreatActors(): Promise<any[]>;
  getThreatActor(id: string): Promise<any | undefined>;
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
        if (category)
          userConditions.push(eq(threatKeywords.category, category));

        userKeywords = await withUserContext(userId, async (db) =>
          db
            .select()
            .from(threatKeywords)
            .where(and(...userConditions)),
        );
      }

      const decryptedDefaultKeywords = defaultKeywords.map((keyword) => ({
        ...keyword,
        term: keyword.term,
      }));

      const decryptedUserKeywords = await Promise.all(
        userKeywords.map(async (keyword) => ({
          ...keyword,
          term: await envelopeDecryptAndRotate(
            threatKeywords,
            keyword.id,
            "term",
            userId!,
          ),
        })),
      );

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

      const results = await withUserContext(userId, async (db) =>
        db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.id, id))
          .limit(1),
      );

      if (results.length > 0) {
        const keyword = results[0];
        return {
          ...keyword,
          term: await envelopeDecryptAndRotate(
            threatKeywords,
            keyword.id,
            "term",
            userId,
          ),
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
        userKeywords = await withUserContext(userId, async (db) =>
          db
            .select()
            .from(threatKeywords)
            .where(
              and(
                eq(threatKeywords.category, category),
                eq(threatKeywords.userId, userId),
                eq(threatKeywords.isDefault, false),
              ),
            ),
        );
      }

      // Decrypt terms for both default and user keywords
      const decryptedDefaultKeywords = defaultKeywords.map((keyword) => ({
        ...keyword,
        term: keyword.term, // Default keywords are not encrypted
      }));

      const decryptedUserKeywords = userId
        ? await Promise.all(
            userKeywords.map(async (keyword) => ({
              ...keyword,
              term: await envelopeDecryptAndRotate(
                threatKeywords,
                keyword.id,
                "term",
                userId,
              ),
            })),
          )
        : [];

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

      // Encrypt the term before saving
      const encryptedTerm = await envelopeEncrypt(keyword.term!);
      const termValue =
        typeof encryptedTerm === "string"
          ? encryptedTerm
          : Buffer.from(encryptedTerm.blob).toString("base64");

      // Ensure isDefault is set to false for user keywords
      const keywordToCreate: {
        active?: boolean;
        userId?: string;
        isDefault?: boolean;
        term: string;
        category: "threat" | "vendor" | "client" | "hardware";
        wrappedDekTerm?: string;
        keyIdTerm?: string;
      } = {
        ...keyword,
        term: termValue,
        category: keyword.category!,
        isDefault: keyword.isDefault || false,
      };

      // Add encryption metadata if envelope encryption was used
      if (typeof encryptedTerm !== "string") {
        keywordToCreate.wrappedDekTerm = Buffer.from(
          encryptedTerm.wrapped_dek,
        ).toString("base64");
        keywordToCreate.keyIdTerm = encryptedTerm.key_id;
      }

      const [result] = await withUserContext(
        userId || keyword.userId,
        async (db) =>
          db.insert(threatKeywords).values(keywordToCreate).returning(),
      );

      // Return with original plaintext term for API consistency
      return {
        ...result,
        term: keyword.term!, // Return the original plaintext term since we know it
      };
    } catch (error) {
      console.error("Error creating threat keyword:", error);
      throw error;
    }
  },

  updateKeyword: async (
    id: string,
    keyword: Partial<ThreatKeyword>,
    userId?: string,
  ) => {
    try {
      if (!userId) {
        throw new Error("User ID is required for updateKeyword");
      }

      // First check if this is a default keyword using withUserContext
      const existingKeyword = await withUserContext(userId, async (db) =>
        db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.id, id))
          .limit(1),
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
        const encryptedTerm = await envelopeEncrypt(updateData.term);
        if (typeof encryptedTerm === "string") {
          updateData.term = encryptedTerm;
        } else {
          updateData.term = Buffer.from(encryptedTerm.blob).toString("base64");
          (updateData as any).wrappedDekTerm = Buffer.from(
            encryptedTerm.wrapped_dek,
          ).toString("base64");
          (updateData as any).keyIdTerm = encryptedTerm.key_id;
        }
      }

      const [result] = await withUserContext(userId, async (db) =>
        db
          .update(threatKeywords)
          .set(updateData)
          .where(eq(threatKeywords.id, id))
          .returning(),
      );

      // Return with decrypted term for API consistency
      return {
        ...result,
        term:
          keyword.term ||
          (await envelopeDecryptAndRotate(
            threatKeywords,
            result.id,
            "term",
            userId,
          )),
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
      const existingKeyword = await withUserContext(userId, async (db) =>
        db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.id, id))
          .limit(1),
      );

      if (existingKeyword.length === 0) {
        throw new Error("Keyword not found");
      }

      if (existingKeyword[0].isDefault === true) {
        throw new Error("Cannot delete default keywords");
      }

      await withUserContext(userId, async (db) =>
        db.delete(threatKeywords).where(eq(threatKeywords.id, id)),
      );
    } catch (error) {
      console.error("Error deleting threat keyword:", error);
      throw error;
    }
  },

  // ARTICLES
  getArticles: async (options: {
    search?: string;
    keywordIds?: string[];
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    limit?: number;
    page?: number;
    sortBy?: string;
    entityFilter?: {
      type: 'software' | 'hardware' | 'vendor' | 'client';
      name: string;
    };
  } = {}) => {
    try {
      const { search, keywordIds, startDate, endDate, userId, limit, page, sortBy = 'relevance', entityFilter } =
        options;
      
      // SECURITY: userId is required for authorization scoping
      if (!userId) {
        throw new Error("userId is required for article queries");
      }
      
      // Defensive caps for limit and page (belt-and-suspenders with router validation)
      const pageNum = Math.max(1, page || 1);
      const pageSize = Math.min(100, Math.max(1, limit || 50));

      // Step 1: Get user's enabled sources
      const sourceIds = await getUserEnabledSources(userId, "threat_tracker");
      if (sourceIds.length === 0) {
        return [];
      }

      // Step 2: Check if user has Technology Stack entities configured
      const [hasSoftware, hasHardware, hasCompanies] = await Promise.all([
        db.select({ id: usersSoftware.softwareId })
          .from(usersSoftware)
          .where(and(
            eq(usersSoftware.userId, userId),
            eq(usersSoftware.isActive, true)
          ))
          .limit(1),
        db.select({ id: usersHardware.hardwareId })
          .from(usersHardware)
          .where(and(
            eq(usersHardware.userId, userId),
            eq(usersHardware.isActive, true)
          ))
          .limit(1),
        db.select({ id: usersCompanies.companyId })
          .from(usersCompanies)
          .where(and(
            eq(usersCompanies.userId, userId),
            eq(usersCompanies.isActive, true)
          ))
          .limit(1)
      ]);

      const hasTechStack = hasSoftware.length > 0 || hasHardware.length > 0 || hasCompanies.length > 0;
      
      // REQUIRE tech stack to be configured - no articles without it
      if (!hasTechStack) {
        return []; // Return empty array if no tech stack configured
      }

      // Step 3: Get active threat keywords for cross-referencing
      const userKeywords = await storage.getKeywords(undefined, userId);
      const threatTerms = userKeywords
        .filter((k) => k.active !== false && k.category === 'threat')
        .map((k) => k.term.toLowerCase());

      // Build WHERE clause based on search parameters
      const conditions = [];

      // Filter by user's enabled sources
      conditions.push(inArray(globalArticles.sourceId, sourceIds));
      
      // Only cybersecurity articles
      conditions.push(eq(globalArticles.isCybersecurity, true));

      // Add search term filter (only if no entity filter)
      if (search && search.trim().length > 0 && !entityFilter) {
        const searchTerm = search.trim();

        // For short terms (< 5 characters), use exact word boundary matching
        // For longer terms, use partial matching
        let searchCondition;
        if (searchTerm.length < 5) {
          // Exact word matching using regex word boundaries
          searchCondition = sql`(
            ${globalArticles.title} ~* ${`\\y${searchTerm}\\y`} OR 
            ${globalArticles.content} ~* ${`\\y${searchTerm}\\y`}
          )`;
        } else {
          // Partial matching for longer terms
          searchCondition = sql`(
            ${globalArticles.title} ILIKE ${"%" + searchTerm + "%"} OR 
            ${globalArticles.content} ILIKE ${"%" + searchTerm + "%"}
          )`;
        }
        conditions.push(searchCondition);
      }

      // Technology Stack entity filtering
      const entityConditions = [];
      
      // If entity filter is provided, filter by specific entity
      if (entityFilter && entityFilter.type && entityFilter.name) {
        const { type, name } = entityFilter;
        const trimmedName = name.trim();
        let entityFound = false;
        
        if (type === 'software') {
          // Find the specific software entity (case-insensitive) that the user has in their tech stack
          const softwareEntity = await db.select({ id: software.id })
            .from(software)
            .innerJoin(usersSoftware, eq(usersSoftware.softwareId, software.id))
            .where(and(
              sql`LOWER(${software.name}) = LOWER(${trimmedName})`,
              eq(usersSoftware.userId, userId),
              eq(usersSoftware.isActive, true)
            ))
            .limit(1);
          
          if (softwareEntity.length > 0) {
            entityFound = true;
            entityConditions.push(sql`
              EXISTS (
                SELECT 1 FROM ${articleSoftware} AS art_sw
                WHERE art_sw.article_id = ${globalArticles.id}
                  AND art_sw.software_id = ${softwareEntity[0].id}
              )
            `);
          }
        } else if (type === 'hardware') {
          // Find the specific hardware entity (case-insensitive) that the user has in their tech stack
          const hardwareEntity = await db.select({ id: hardware.id })
            .from(hardware)
            .innerJoin(usersHardware, eq(usersHardware.hardwareId, hardware.id))
            .where(and(
              sql`LOWER(${hardware.name}) = LOWER(${trimmedName})`,
              eq(usersHardware.userId, userId),
              eq(usersHardware.isActive, true)
            ))
            .limit(1);
          
          if (hardwareEntity.length > 0) {
            entityFound = true;
            entityConditions.push(sql`
              EXISTS (
                SELECT 1 FROM ${articleHardware} AS art_hw
                WHERE art_hw.article_id = ${globalArticles.id}
                  AND art_hw.hardware_id = ${hardwareEntity[0].id}
              )
            `);
          }
        } else if (type === 'vendor' || type === 'client') {
          // Find the specific company entity (case-insensitive) that the user has in their tech stack
          const companyEntity = await db.select({ id: companies.id })
            .from(companies)
            .innerJoin(usersCompanies, eq(usersCompanies.companyId, companies.id))
            .where(and(
              sql`LOWER(${companies.name}) = LOWER(${trimmedName})`,
              eq(usersCompanies.userId, userId),
              eq(usersCompanies.isActive, true)
              // No relationship type check - show ALL articles for the entity regardless of vendor/client type
            ))
            .limit(1);
          
          if (companyEntity.length > 0) {
            entityFound = true;
            entityConditions.push(sql`
              EXISTS (
                SELECT 1 FROM ${articleCompanies} AS art_co
                WHERE art_co.article_id = ${globalArticles.id}
                  AND art_co.company_id = ${companyEntity[0].id}
              )
            `);
          }
        }
        
        // If entity filter was provided but entity not found, return empty
        if (!entityFound) {
          return [];
        }
      } else {
        // No entity filter - use broad tech stack filtering (all user's active entities)
        // Software match
        if (hasSoftware.length > 0) {
          entityConditions.push(sql`
            EXISTS (
              SELECT 1 FROM ${articleSoftware} AS art_sw
              INNER JOIN ${usersSoftware} AS user_sw 
                ON art_sw.software_id = user_sw.software_id
              WHERE art_sw.article_id = ${globalArticles.id}
                AND user_sw.user_id = ${userId}
                AND user_sw.is_active = true
            )
          `);
        }
        
        // Hardware match
        if (hasHardware.length > 0) {
          entityConditions.push(sql`
            EXISTS (
              SELECT 1 FROM ${articleHardware} AS art_hw
              INNER JOIN ${usersHardware} AS user_hw 
                ON art_hw.hardware_id = user_hw.hardware_id
              WHERE art_hw.article_id = ${globalArticles.id}
                AND user_hw.user_id = ${userId}
                AND user_hw.is_active = true
            )
          `);
        }
        
        // Company match (vendors and clients)
        if (hasCompanies.length > 0) {
          entityConditions.push(sql`
            EXISTS (
              SELECT 1 FROM ${articleCompanies} AS art_co
              INNER JOIN ${usersCompanies} AS user_co 
                ON art_co.company_id = user_co.company_id
              WHERE art_co.article_id = ${globalArticles.id}
                AND user_co.user_id = ${userId}
                AND user_co.is_active = true
            )
          `);
        }
      }
      
      // Articles must match at least one tech stack entity (or the specific filtered entity)
      if (entityConditions.length > 0) {
        conditions.push(sql`(${sql.join(entityConditions, sql` OR `)})`);
      }

      // Optional: Add threat indicator filter only if specifically requested
      // For now, we show ALL articles matching tech stack, not just those with threat indicators
      // This ensures the count matches the displayed articles

      // Add date range filters - use COALESCE of publishDate and scrapedAt for filtering
      // This ensures we capture all articles even if publishDate is null (most articles only have scrapedAt)
      if (startDate) {
        conditions.push(sql`COALESCE(${globalArticles.publishDate}, ${globalArticles.scrapedAt}) >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`COALESCE(${globalArticles.publishDate}, ${globalArticles.scrapedAt}) <= ${endDate}`);
      }

      // Build the query with relevance scores (but NOT matched entities - those come from entity association tables)
      const baseQuery = db.select({
        article: globalArticles,
        relevanceScore: articleRelevanceScores.relevanceScore,
        relevanceMetadata: articleRelevanceScores.metadata,
      })
      .from(globalArticles)
      .leftJoin(
        articleRelevanceScores,
        and(
          eq(articleRelevanceScores.articleId, globalArticles.id),
          eq(articleRelevanceScores.userId, userId)
        )
      );

      // Determine sort order
      let orderByClause;
      if (sortBy === 'relevance') {
        // Sort by relevance score (nulls last), then by date
        orderByClause = [
          desc(sql`COALESCE(${articleRelevanceScores.relevanceScore}, 0)`),
          desc(sql`COALESCE(${globalArticles.publishDate}, ${globalArticles.scrapedAt})`)
        ];
      } else {
        // Date sorting
        orderByClause = [
          desc(sql`COALESCE(${globalArticles.publishDate}, ${globalArticles.scrapedAt})`),
          desc(globalArticles.scrapedAt)
        ];
      }

      // Apply conditions and build complete query
      const finalQuery =
        conditions.length > 0
          ? baseQuery
              .where(and(...conditions))
              .orderBy(...orderByClause)
              .limit(pageSize)
              .offset((pageNum - 1) * pageSize)
          : baseQuery
              .orderBy(...orderByClause)
              .limit(pageSize)
              .offset((pageNum - 1) * pageSize);

      // Execute the query
      const result = await finalQuery.execute();
      
      // Collect all article IDs
      const allArticleIds = Array.from(new Set(result.map(row => row.article.id)));
      
      // First, fetch article entity associations
      const [articleSoftwareMap, articleCompanyMap, articleHardwareMap] = await Promise.all([
        // Fetch software entity IDs for each article
        allArticleIds.length > 0
          ? db.select({ 
              articleId: articleSoftware.articleId,
              softwareId: articleSoftware.softwareId 
            })
              .from(articleSoftware)
              .where(inArray(articleSoftware.articleId, allArticleIds))
              .then(rows => {
                const map = new Map<string, string[]>();
                rows.forEach(row => {
                  if (!map.has(row.articleId)) {
                    map.set(row.articleId, []);
                  }
                  map.get(row.articleId)!.push(row.softwareId);
                });
                return map;
              })
          : new Map<string, string[]>(),
        
        // Fetch company entity IDs for each article
        allArticleIds.length > 0
          ? db.select({ 
              articleId: articleCompanies.articleId,
              companyId: articleCompanies.companyId 
            })
              .from(articleCompanies)
              .where(inArray(articleCompanies.articleId, allArticleIds))
              .then(rows => {
                const map = new Map<string, string[]>();
                rows.forEach(row => {
                  if (!map.has(row.articleId)) {
                    map.set(row.articleId, []);
                  }
                  map.get(row.articleId)!.push(row.companyId);
                });
                return map;
              })
          : new Map<string, string[]>(),
        
        // Fetch hardware entity IDs for each article
        allArticleIds.length > 0
          ? db.select({ 
              articleId: articleHardware.articleId,
              hardwareId: articleHardware.hardwareId 
            })
              .from(articleHardware)
              .where(inArray(articleHardware.articleId, allArticleIds))
              .then(rows => {
                const map = new Map<string, string[]>();
                rows.forEach(row => {
                  if (!map.has(row.articleId)) {
                    map.set(row.articleId, []);
                  }
                  map.get(row.articleId)!.push(row.hardwareId);
                });
                return map;
              })
          : new Map<string, string[]>(),
      ]);
      
      // Fetch user's tech stack entity IDs to filter displayed entities
      const [userSoftwareIds, userHardwareIds, userCompanyIds] = await Promise.all([
        db.select({ softwareId: usersSoftware.softwareId })
          .from(usersSoftware)
          .where(and(
            eq(usersSoftware.userId, userId),
            eq(usersSoftware.isActive, true)
          ))
          .then(rows => new Set(rows.map(r => r.softwareId))),
        db.select({ hardwareId: usersHardware.hardwareId })
          .from(usersHardware)
          .where(and(
            eq(usersHardware.userId, userId),
            eq(usersHardware.isActive, true)
          ))
          .then(rows => new Set(rows.map(r => r.hardwareId))),
        db.select({ companyId: usersCompanies.companyId })
          .from(usersCompanies)
          .where(and(
            eq(usersCompanies.userId, userId),
            eq(usersCompanies.isActive, true)
          ))
          .then(rows => new Set(rows.map(r => r.companyId)))
      ]);
      
      // Collect all unique entity IDs from the article entity maps
      const allSoftwareIds = new Set<string>();
      const allCompanyIds = new Set<string>();
      const allHardwareIds = new Set<string>();
      
      articleSoftwareMap.forEach(ids => ids.forEach(id => allSoftwareIds.add(id)));
      articleCompanyMap.forEach(ids => ids.forEach(id => allCompanyIds.add(id)));
      articleHardwareMap.forEach(ids => ids.forEach(id => allHardwareIds.add(id)));
      
      // Now fetch entity names and threat data in parallel
      const [softwareMap, companyMap, hardwareMap, threatActorsMap, cvesMap, threatKeywordsMap] = await Promise.all([
        // Fetch software names and malware status from metadata
        allSoftwareIds.size > 0 
          ? db.select({ id: software.id, name: software.name, metadata: software.metadata })
              .from(software)
              .where(inArray(software.id, Array.from(allSoftwareIds)))
              .then(rows => new Map(rows.map(r => [r.id, { 
                name: r.name, 
                isMalware: (r.metadata as any)?.isMalware || false 
              }])))
          : new Map<string, { name: string | null; isMalware: boolean }>(),
        
        // Fetch company names  
        allCompanyIds.size > 0
          ? db.select({ id: companies.id, name: companies.name })
              .from(companies)
              .where(inArray(companies.id, Array.from(allCompanyIds)))
              .then(rows => new Map(rows.map(r => [r.id, r.name])))
          : new Map<string, string | null>(),
          
        // Fetch hardware names
        allHardwareIds.size > 0
          ? db.select({ id: hardware.id, name: hardware.name })
              .from(hardware)
              .where(inArray(hardware.id, Array.from(allHardwareIds)))
              .then(rows => new Map(rows.map(r => [r.id, r.name])))
          : new Map<string, string | null>(),
          
        // Fetch threat actors for articles
        allArticleIds.length > 0
          ? db.select({ 
              articleId: articleThreatActors.articleId,
              actorName: threatActors.name 
            })
              .from(articleThreatActors)
              .innerJoin(threatActors, eq(articleThreatActors.threatActorId, threatActors.id))
              .where(inArray(articleThreatActors.articleId, Array.from(allArticleIds)))
              .then(rows => {
                const map = new Map<string, string[]>();
                rows.forEach(row => {
                  if (!map.has(row.articleId)) {
                    map.set(row.articleId, []);
                  }
                  map.get(row.articleId)!.push(row.actorName);
                });
                return map;
              })
          : new Map<string, string[]>(),
          
        // Fetch CVEs for articles
        allArticleIds.length > 0
          ? db.select({ 
              articleId: articleCves.articleId,
              cveId: articleCves.cveId 
            })
              .from(articleCves)
              .where(inArray(articleCves.articleId, Array.from(allArticleIds)))
              .then(rows => {
                const map = new Map<string, string[]>();
                rows.forEach(row => {
                  if (!map.has(row.articleId)) {
                    map.set(row.articleId, []);
                  }
                  map.get(row.articleId)!.push(row.cveId);
                });
                return map;
              })
          : new Map<string, string[]>(),
          
        // Process threat keywords for each article
        allArticleIds.length > 0 && threatTerms.length > 0
          ? Promise.all(Array.from(allArticleIds).map(async (articleId) => {
              const [article] = await db.select()
                .from(globalArticles)
                .where(eq(globalArticles.id, articleId))
                .limit(1);
                
              const contentLower = ((article?.content || '') + ' ' + (article?.title || '')).toLowerCase();
              const matched: string[] = [];
              
              for (const term of threatTerms) {
                if (contentLower.includes(term)) {
                  matched.push(term);
                }
              }
              
              return { articleId, keywords: matched };
            }))
            .then(results => {
              const map = new Map<string, string[]>();
              results.forEach(r => map.set(r.articleId, r.keywords));
              return map;
            })
          : new Map<string, string[]>()
      ]);

      // Map global articles to ThreatArticle format for compatibility
      const mappedArticles = result.map((row) => {
        // Get actual article entities from association tables
        const articleSoftwareIds = articleSoftwareMap.get(row.article.id) || [];
        const articleCompanyIds = articleCompanyMap.get(row.article.id) || [];
        const articleHardwareIds = articleHardwareMap.get(row.article.id) || [];
        
        // Filter entities to only show those in BOTH the article AND user's tech stack
        const matchedSoftwareIds = articleSoftwareIds.filter(id => userSoftwareIds.has(id));
        const matchedCompanyIds = articleCompanyIds.filter(id => userCompanyIds.has(id));
        const matchedHardwareIds = articleHardwareIds.filter(id => userHardwareIds.has(id));
        
        return {
          id: row.article.id,
          sourceId: row.article.sourceId,
          title: row.article.title,
          content: row.article.content,
          url: row.article.url,
          author: row.article.author || null,
          publishDate: row.article.publishDate,
          summary: row.article.summary || null,
          relevanceScore: row.relevanceScore || null,
          relevanceMetadata: row.relevanceMetadata || null,
          securityScore: row.article.securityScore ? String(row.article.securityScore) : null,
          threatSeverityScore: row.article.threatSeverityScore || null,
          threatLevel: row.article.threatLevel || null,
          threatMetadata: row.article.threatMetadata || null,
          detectedKeywords: row.article.detectedKeywords || {},
          scrapeDate: row.article.scrapedAt || new Date(),
          userId: userId || null,
          markedForCapsule: false,
          // Display only entities that match user's tech stack, separate malware
          matchedSoftware: matchedSoftwareIds
            .map(id => {
              const softwareInfo = softwareMap.get(id);
              return softwareInfo && !softwareInfo.isMalware ? softwareInfo.name : null;
            })
            .filter(name => name != null) as string[],
          matchedMalware: matchedSoftwareIds
            .map(id => {
              const softwareInfo = softwareMap.get(id);
              return softwareInfo && softwareInfo.isMalware ? softwareInfo.name : null;
            })
            .filter(name => name != null) as string[],
          matchedCompanies: matchedCompanyIds
            .map(id => companyMap.get(id))
            .filter(name => name != null) as string[],
          matchedHardware: matchedHardwareIds
            .map(id => hardwareMap.get(id))
            .filter(name => name != null) as string[],
          matchedKeywords: [], // Keywords are user-specific, not article-specific
          // Add threat-related data
          matchedThreatActors: threatActorsMap.get(row.article.id) || [],
          matchedCves: cvesMap.get(row.article.id) || [],
          matchedThreatKeywords: threatKeywordsMap.get(row.article.id) || [],
        };
      });

      // Filter articles to require BOTH tech stack AND threat elements
      const filteredArticles = mappedArticles.filter(article => {
        // Check for tech stack matches
        const hasTechStackMatch = 
          article.matchedSoftware.length > 0 || 
          article.matchedCompanies.length > 0 || 
          article.matchedHardware.length > 0;
        
        // Check for threat element matches
        const hasThreatMatch = 
          article.matchedThreatActors.length > 0 ||
          article.matchedCves.length > 0 ||
          article.matchedThreatKeywords.length > 0;
        
        // Require BOTH tech stack AND threat elements
        return hasTechStackMatch && hasThreatMatch;
      });

      return filteredArticles as ThreatArticle[];
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
        .where(
          and(eq(threatArticles.url, url), eq(threatArticles.userId, userId)),
        )
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
    threatSeverityScore?: number;
    threatMetadata?: any;
    threatLevel?: string;
    entitiesExtracted?: boolean;
    detectedKeywords?: any;
    markedForCapsule?: boolean;
  }) => {
    try {
      // For global scraping (no userId), insert into global_articles table
      if (!article.userId) {
        // Import global_articles table
        const { globalArticles } = await import(
          "@shared/db/schema/global-tables"
        );

        const [created] = await db
          .insert(globalArticles)
          .values({
            sourceId: article.sourceId,
            title: article.title,
            content: article.content,
            url: article.url,
            author: article.author,
            publishDate: article.publishDate,
            summary: article.summary,
            detectedKeywords: article.detectedKeywords,
            securityScore: article.securityScore
              ? parseInt(article.securityScore)
              : null,
            threatSeverityScore: article.threatSeverityScore ? article.threatSeverityScore.toString() : null,
            threatMetadata: article.threatMetadata || null,
            threatLevel: article.threatLevel || null,
            entitiesExtracted: article.entitiesExtracted || false,
            isCybersecurity: true, // Threat tracker articles are always cybersecurity
            scrapedAt: new Date(),
          })
          .returning();

        // Map back to ThreatArticle type for compatibility
        return {
          ...created,
          userId: null,
          relevanceScore: article.relevanceScore,
          markedForCapsule: article.markedForCapsule || false,
          scrapeDate: created.scrapedAt,
          securityScore: created.securityScore
            ? created.securityScore.toString()
            : null,
        } as ThreatArticle;
      }

      // For user-specific articles, use the old table
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
      await db.delete(threatArticles).where(eq(threatArticles.userId, userId));
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

  // THREAT ACTORS
  getThreatActors: async () => {
    try {
      const { threatActors } = await import('@shared/db/schema/threat-tracker/entities');
      
      const actors = await db
        .select()
        .from(threatActors)
        .orderBy(desc(threatActors.createdAt));
      
      return actors;
    } catch (error) {
      console.error("Error fetching threat actors:", error);
      return [];
    }
  },

  getThreatActor: async (id: string) => {
    try {
      const { threatActors } = await import('@shared/db/schema/threat-tracker/entities');
      
      const results = await db
        .select()
        .from(threatActors)
        .where(eq(threatActors.id, id))
        .limit(1);
      
      return results[0];
    } catch (error) {
      console.error("Error fetching threat actor:", error);
      return undefined;
    }
  },
};
