import { db } from 'backend/db/db';
import { withUserContext } from 'backend/db/with-user-context';
import {
  globalArticles,
  globalSources,
  userSourcePreferences,
  type GlobalArticle,
  type GlobalSource
} from '@shared/db/schema/global-tables';
import { keywords, type Keyword } from '@shared/db/schema/news-tracker';
import { threatKeywords, type ThreatKeyword } from '@shared/db/schema/threat-tracker';
import { eq, and, or, inArray, sql, desc, ilike, isNull, lte } from 'drizzle-orm';
import { log } from 'backend/utils/log';
import { envelopeDecryptAndRotate } from 'backend/utils/encryption-new';
import { getUserTierLevel } from './utils/get-user-tier-level';

export type AppType = 'news-radar' | 'threat-tracker';

interface ArticleFilter {
  limit?: number;
  offset?: number;
  searchTerm?: string;
  sourceIds?: string[];
  startDate?: Date;
  endDate?: Date;
}

export class UnifiedStorageService {
  /**
   * Get articles from global_articles table with user filters applied
   */
  async getUserArticles(
    userId: string,
    appType: AppType,
    filter?: ArticleFilter & { keywordIds?: string[] }
  ): Promise<GlobalArticle[]> {
    try {
      log(`[UnifiedStorage] Getting articles for user ${userId}, app: ${appType}`, 'storage');

      // Step 1: Get user's enabled sources
      const enabledSources = await db
        .select({ sourceId: userSourcePreferences.sourceId })
        .from(userSourcePreferences)
        .where(
          and(
            eq(userSourcePreferences.userId, userId),
            eq(userSourcePreferences.appContext, appType === 'news-radar' ? 'news_radar' : 'threat_tracker'),
            eq(userSourcePreferences.isEnabled, true)
          )
        );

      if (enabledSources.length === 0) {
        log(`[UnifiedStorage] User has no enabled sources`, 'storage');
        return [];
      }

      const enabledSourceIds = enabledSources.map(s => s.sourceId);

      // Step 2: Build query conditions
      const conditions = [
        inArray(globalArticles.sourceId, enabledSourceIds)
      ];

      // For threat tracker, only show cybersecurity articles
      if (appType === 'threat-tracker') {
        conditions.push(eq(globalArticles.isCybersecurity, true));
      }

      // Apply additional filters
      if (filter?.searchTerm) {
        conditions.push(
          or(
            ilike(globalArticles.title, `%${filter.searchTerm}%`),
            ilike(globalArticles.content, `%${filter.searchTerm}%`)
          )
        );
      }

      if (filter?.startDate) {
        conditions.push(sql`${globalArticles.publishDate} >= ${filter.startDate}`);
      }

      if (filter?.endDate) {
        conditions.push(sql`${globalArticles.publishDate} <= ${filter.endDate}`);
      }

      // Step 3: Apply keyword filtering based on specific keywordIds or all active keywords
      let keywordsToFilter: any = [];
      
      if (filter?.keywordIds && filter.keywordIds.length > 0) {
        // Use specific keyword IDs sent from frontend
        
        if (appType === 'news-radar') {          
          // Use withUserContext to bypass RLS and get keywords
          const encryptedKeywords = await withUserContext(
            userId,
            async (contextDb) => contextDb
              .select({ 
                term: keywords.term, 
                id: keywords.id, 
                userId: keywords.userId,
                active: keywords.active 
              })
              .from(keywords)
              .where(
                and(
                  eq(keywords.userId, userId),
                  inArray(keywords.id, filter.keywordIds),
                  eq(keywords.active, true)
                )
              )
          );
          
          // Decrypt the keyword terms
          const decryptedKeywords = await Promise.all(
            encryptedKeywords.map(async (k) => ({
              ...k,
              term: await envelopeDecryptAndRotate(keywords, k.id, 'term', userId)
            }))
          );
          
          keywordsToFilter = decryptedKeywords.map(k => k.term);
        } else if (appType === 'threat-tracker') {
          // Threat Tracker: Handle NULL user_id values in threat_keywords table
          
          // Try with withUserContext first for user-specific keywords
          let userKeywordResults = [];
          try {
            const userKeywords = await withUserContext(
              userId,
              async (contextDb) => contextDb
                .select({ 
                  term: threatKeywords.term, 
                  id: threatKeywords.id,
                  category: threatKeywords.category,
                  userId: threatKeywords.userId,
                  active: threatKeywords.active,
                  isDefault: threatKeywords.isDefault
                })
                .from(threatKeywords)
                .where(
                  and(
                    eq(threatKeywords.userId, userId),
                    inArray(threatKeywords.id, filter.keywordIds),
                    eq(threatKeywords.active, true)
                  )
                )
            );
            
            // Decrypt user keywords
            userKeywordResults = await Promise.all(
              userKeywords.map(async (k) => ({
                ...k,
                term: await envelopeDecryptAndRotate(threatKeywords, k.id, 'term', userId)
              }))
            );
          } catch (error) {
            log(`[UnifiedStorage] Error fetching user threat keywords: ${error.message}`, 'storage');
          }
          
          // Also get default/global threat keywords (userId is NULL, isDefault = true)
          const defaultKeywords = await db
            .select({ 
              term: threatKeywords.term, 
              id: threatKeywords.id,
              category: threatKeywords.category,
              userId: threatKeywords.userId,
              active: threatKeywords.active,
              isDefault: threatKeywords.isDefault
            })
            .from(threatKeywords)
            .where(
              and(
                eq(threatKeywords.isDefault, true),
                isNull(threatKeywords.userId),
                inArray(threatKeywords.id, filter.keywordIds)
              )
            );
          
          // Combine both results - default keywords don't need decryption
          const allKeywords = [...userKeywordResults, ...defaultKeywords];
          
          // For Threat Tracker, store keywords with categories for cross-reference matching
          keywordsToFilter = allKeywords;
        }
      } else {
        // Fallback: Use all active keywords (existing behavior)
        keywordsToFilter = await this.getUserKeywords(userId, appType);
      }
      
      // Handle keyword filtering logic
      if (keywordsToFilter.length > 0) {
        
        if (appType === 'threat-tracker' && Array.isArray(keywordsToFilter) && keywordsToFilter[0]?.category) {
          // Threat Tracker: Cross-reference matching - need both threat AND entity keywords
          const threatKws = keywordsToFilter.filter(k => k.category === 'threat').map(k => k.term);
          const entityKws = keywordsToFilter.filter(k => ['vendor', 'client', 'hardware'].includes(k.category)).map(k => k.term);
          
          if (threatKws.length > 0 && entityKws.length > 0) {
            // Create conditions for threat keywords
            const threatConditions = threatKws.map(kw => 
              or(
                ilike(globalArticles.title, `%${kw}%`),
                ilike(globalArticles.content, `%${kw}%`)
              )
            );
            
            // Create conditions for entity keywords
            const entityConditions = entityKws.map(kw => 
              or(
                ilike(globalArticles.title, `%${kw}%`),
                ilike(globalArticles.content, `%${kw}%`)
              )
            );
            
            // Require at least one threat AND at least one entity
            conditions.push(
              and(
                or(...threatConditions),
                or(...entityConditions)
              )
            );
          } else {
            // If only one category is selected, show no results (requires both)
            conditions.push(sql`FALSE`);
          }
        } else {
          // News Radar or simple keyword list: OR matching
          const keywordTerms = Array.isArray(keywordsToFilter) && keywordsToFilter[0]?.term 
            ? keywordsToFilter.map(k => k.term)
            : keywordsToFilter;
            
          const keywordConditions = keywordTerms.map(kw => 
            or(
              ilike(globalArticles.title, `%${kw}%`),
              ilike(globalArticles.content, `%${kw}%`)
            )
          );
          
          // Add the keyword conditions to the main query conditions
          if (keywordConditions.length > 0) {
            conditions.push(or(...keywordConditions));
          }
        }
      } else if (filter?.keywordIds && filter.keywordIds.length > 0) {
        // Keywords were requested but none found - show warning but continue
      }

      // Step 4: Execute query with source name join
      
      const query = db
        .select({
          id: globalArticles.id,
          sourceId: globalArticles.sourceId,
          title: globalArticles.title,
          content: globalArticles.content,
          url: globalArticles.url,
          author: globalArticles.author,
          publishDate: globalArticles.publishDate,
          summary: globalArticles.summary,
          isCybersecurity: globalArticles.isCybersecurity,
          securityScore: globalArticles.securityScore,
          threatCategories: globalArticles.threatCategories,
          scrapedAt: globalArticles.scrapedAt,
          lastAnalyzedAt: globalArticles.lastAnalyzedAt,
          analysisVersion: globalArticles.analysisVersion,
          detectedKeywords: globalArticles.detectedKeywords,
          sourceName: globalSources.name,
        })
        .from(globalArticles)
        .leftJoin(globalSources, eq(globalArticles.sourceId, globalSources.id))
        .where(and(...conditions))
        .orderBy(desc(globalArticles.publishDate));

      // Apply pagination
      if (filter?.limit) {
        query.limit(filter.limit);
      }
      if (filter?.offset) {
        query.offset(filter.offset);
      }

      const articles = await query;
      
      // Add matched keywords to each article if keyword filtering was applied
      if (keywordsToFilter.length > 0) {
        const articlesWithMatchedKeywords = articles.map(article => {
          const matchedKeywords: string[] = [];
          
          // Extract keyword terms for matching
          const keywordTerms = Array.isArray(keywordsToFilter) && keywordsToFilter[0]?.term 
            ? keywordsToFilter.map(k => k.term)
            : keywordsToFilter;
          
          // Check which keywords match this article
          for (const keyword of keywordTerms) {
            const lowerKeyword = keyword.toLowerCase();
            const titleMatch = article.title?.toLowerCase().includes(lowerKeyword);
            const contentMatch = article.content?.toLowerCase().includes(lowerKeyword);
            
            if (titleMatch || contentMatch) {
              matchedKeywords.push(keyword);
            }
          }
          
          // Return article with matched keywords (override detectedKeywords for display)
          return {
            ...article,
            matchedKeywords, // Add new field with actual matched user keywords
            detectedKeywords: matchedKeywords // Override AI-generated keywords with matched user keywords for display
          };
        });
        
        log(`[UnifiedStorage] Retrieved ${articlesWithMatchedKeywords.length} articles for user`, 'storage');
        return articlesWithMatchedKeywords;
      }
      
      log(`[UnifiedStorage] Retrieved ${articles.length} articles for user`, 'storage');
      return articles;

    } catch (error: any) {
      log(`[UnifiedStorage] Error getting user articles: ${error.message}`, 'storage-error');
      throw error;
    }
  }

  /**
   * Get user's enabled sources from global pool
   */
  async getUserEnabledSources(userId: string, appType?: AppType): Promise<GlobalSource[]> {
    try {
      log(`[UnifiedStorage] Getting enabled sources for user ${userId}`, 'storage');

      const conditions = [eq(userSourcePreferences.userId, userId)];
      
      if (appType) {
        conditions.push(
          eq(userSourcePreferences.appContext, appType === 'news-radar' ? 'news_radar' : 'threat_tracker')
        );
      }

      // Get all global sources with user preference status
      const sourcesWithPrefs = await db
        .select({
          source: globalSources,
          isEnabled: userSourcePreferences.isEnabled
        })
        .from(globalSources)
        .leftJoin(
          userSourcePreferences,
          and(
            eq(userSourcePreferences.sourceId, globalSources.id),
            ...conditions
          )
        )
        .where(eq(globalSources.isActive, true));

      // Filter to only enabled sources
      const enabledSources = sourcesWithPrefs
        .filter(sp => sp.isEnabled === true)
        .map(sp => sp.source);

      log(`[UnifiedStorage] User has ${enabledSources.length} enabled sources`, 'storage');
      return enabledSources;

    } catch (error: any) {
      log(`[UnifiedStorage] Error getting enabled sources: ${error.message}`, 'storage-error');
      throw error;
    }
  }

  /**
   * Get all global sources with user's enabled status
   */
  async getAllSourcesWithStatus(userId: string, appType: AppType): Promise<(GlobalSource & { isEnabled: boolean })[]> {
    try {
      log(`[UnifiedStorage] Getting all sources with status for user ${userId}`, 'storage');

      const appContext = appType === 'news-radar' ? 'news_radar' : 'threat_tracker';

      const userTierLevel = await getUserTierLevel(userId)
      console.log("User tier level: ", userTierLevel)

      // Get all active global sources with user preference status
      const sourcesWithPrefs = await db
        .select({
          source: globalSources,
          isEnabled: userSourcePreferences.isEnabled
        })
        .from(globalSources)
        .leftJoin(
          userSourcePreferences,
          and(
            eq(userSourcePreferences.sourceId, globalSources.id),
            eq(userSourcePreferences.userId, userId),
            eq(userSourcePreferences.appContext, appContext)
          )
        )
        .where(and(
          eq(globalSources.isActive, true),
          lte(globalSources.requiredTierLevel,userTierLevel)
        ));

      // Map to include enabled status
      const sourcesWithStatus = sourcesWithPrefs.map(sp => ({
        ...sp.source,
        isEnabled: sp.isEnabled ?? false // Default to false if no preference exists
      }));

      log(`[UnifiedStorage] Retrieved ${sourcesWithStatus.length} sources with status`, 'storage');
      return sourcesWithStatus;

    } catch (error: any) {
      log(`[UnifiedStorage] Error getting sources with status: ${error.message}`, 'storage-error');
      throw error;
    }
  }

  /**
   * Toggle source preference for a user (no data duplication)
   */
  async toggleSourcePreference(
    userId: string,
    sourceId: string,
    appType: AppType,
    enabled: boolean
  ): Promise<void> {
    try {
      log(`[UnifiedStorage] Toggling source ${sourceId} to ${enabled} for user ${userId}`, 'storage');

      const appContext = appType === 'news-radar' ? 'news_radar' : 'threat_tracker';

      if (enabled) {
        // Insert or update to enabled
        await db
          .insert(userSourcePreferences)
          .values({
            userId,
            sourceId,
            appContext,
            isEnabled: true,
            enabledAt: new Date()
          })
          .onConflictDoUpdate({
            target: [userSourcePreferences.userId, userSourcePreferences.sourceId, userSourcePreferences.appContext],
            set: {
              isEnabled: true,
              enabledAt: new Date()
            }
          });
      } else {
        // Update to disabled or delete the preference
        await db
          .delete(userSourcePreferences)
          .where(
            and(
              eq(userSourcePreferences.userId, userId),
              eq(userSourcePreferences.sourceId, sourceId),
              eq(userSourcePreferences.appContext, appContext)
            )
          );
      }

      log(`[UnifiedStorage] Source preference updated successfully`, 'storage');
    } catch (error: any) {
      log(`[UnifiedStorage] Error toggling source preference: ${error.message}`, 'storage-error');
      throw error;
    }
  }

  /**
   * Get a single source by ID
   */
  async getSource(sourceId: string): Promise<GlobalSource | null> {
    try {
      const [source] = await db
        .select()
        .from(globalSources)
        .where(eq(globalSources.id, sourceId))
        .limit(1);

      return source || null;
    } catch (error: any) {
      log(`[UnifiedStorage] Error getting source: ${error.message}`, 'storage-error');
      throw error;
    }
  }

  /**
   * Get user keywords (proxy to existing storage - no changes)
   */
  private async getUserKeywords(userId: string, appType: AppType): Promise<string[]> {
    try {
      if (appType === 'news-radar') {
        // Use existing keywords table for news radar
        const userKeywords = await db
          .select({ term: keywords.term })
          .from(keywords)
          .where(eq(keywords.userId, userId));
        
        return userKeywords.map(k => k.term);
      } else {
        // Use existing threat_keywords table for threat tracker
        const userKeywords = await db
          .select({ term: threatKeywords.term })
          .from(threatKeywords)
          .where(
            and(
              eq(threatKeywords.userId, userId),
              eq(threatKeywords.isDefault, false)
            )
          );
        
        return userKeywords.map(k => k.term);
      }
    } catch (error: any) {
      log(`[UnifiedStorage] Error getting keywords: ${error.message}`, 'storage-error');
      return [];
    }
  }

  /**
   * Get article count for user
   */
  async getUserArticleCount(userId: string, appType: AppType): Promise<number> {
    try {
      log(`[UnifiedStorage] Getting article count for user ${userId}, app: ${appType}`, 'storage');

      // Get user's enabled sources
      const enabledSources = await db
        .select({ sourceId: userSourcePreferences.sourceId })
        .from(userSourcePreferences)
        .where(
          and(
            eq(userSourcePreferences.userId, userId),
            eq(userSourcePreferences.appContext, appType === 'news-radar' ? 'news_radar' : 'threat_tracker'),
            eq(userSourcePreferences.isEnabled, true)
          )
        );

      if (enabledSources.length === 0) {
        log(`[UnifiedStorage] User has no enabled sources`, 'storage');
        return 0;
      }

      const enabledSourceIds = enabledSources.map(s => s.sourceId);

      // Build conditions
      const conditions = [
        inArray(globalArticles.sourceId, enabledSourceIds)
      ];

      // For threat tracker, only count cybersecurity articles
      if (appType === 'threat-tracker') {
        conditions.push(eq(globalArticles.isCybersecurity, true));
      }

      // Get user's active keywords for filtering
      let keywordsToFilter: any[] = [];
      
      if (appType === 'news-radar') {
        // Use withUserContext to bypass RLS and get keywords
        const encryptedKeywords = await withUserContext(
          userId,
          async (contextDb) => contextDb
            .select({ 
              term: keywords.term, 
              id: keywords.id, 
              userId: keywords.userId,
              active: keywords.active 
            })
            .from(keywords)
            .where(
              and(
                eq(keywords.userId, userId),
                eq(keywords.active, true)
              )
            )
        );
        
        // Decrypt the keyword terms
        const decryptedKeywords = await Promise.all(
          encryptedKeywords.map(async (k) => ({
            ...k,
            term: await envelopeDecryptAndRotate(keywords, k.id, 'term', userId)
          }))
        );
        
        keywordsToFilter = decryptedKeywords.map(k => k.term);
      } else {
        // Threat Tracker: Handle NULL user_id values in threat_keywords table
        let keywordResults = [];
        try {
          const userKeywords = await withUserContext(
            userId,
            async (contextDb) => contextDb
              .select({ 
                term: threatKeywords.term, 
                id: threatKeywords.id,
                category: threatKeywords.category,
                userId: threatKeywords.userId,
                active: threatKeywords.active
              })
              .from(threatKeywords)
              .where(
                and(
                  eq(threatKeywords.userId, userId),
                  eq(threatKeywords.active, true)
                )
              )
          );
          keywordResults = userKeywords;
        } catch (error) {
          log(`[UnifiedStorage] Error getting user threat keywords: ${error}`, 'storage-error');
        }
        
        // Also get global threat keywords (userId is NULL)
        const globalKeywords = await db
          .select({ 
            term: threatKeywords.term, 
            id: threatKeywords.id,
            category: threatKeywords.category,
            userId: threatKeywords.userId,
            active: threatKeywords.active
          })
          .from(threatKeywords)
          .where(
            and(
              isNull(threatKeywords.userId),
              eq(threatKeywords.active, true)
            )
          );
        
        // Combine both results
        keywordsToFilter = [...keywordResults, ...globalKeywords];
      }
      
      // Apply keyword filtering
      if (keywordsToFilter.length > 0) {
        if (appType === 'threat-tracker' && keywordsToFilter[0]?.category) {
          // Threat Tracker: Cross-reference matching - need both threat AND entity keywords
          const threatKws = keywordsToFilter.filter(k => k.category === 'threat').map(k => k.term);
          const entityKws = keywordsToFilter.filter(k => ['vendor', 'client', 'hardware'].includes(k.category)).map(k => k.term);
          
          if (threatKws.length > 0 && entityKws.length > 0) {
            // Create conditions for threat keywords
            const threatConditions = threatKws.map(kw => 
              or(
                ilike(globalArticles.title, `%${kw}%`),
                ilike(globalArticles.content, `%${kw}%`)
              )
            );
            
            // Create conditions for entity keywords
            const entityConditions = entityKws.map(kw => 
              or(
                ilike(globalArticles.title, `%${kw}%`),
                ilike(globalArticles.content, `%${kw}%`)
              )
            );
            
            // Require at least one threat AND at least one entity
            conditions.push(
              and(
                or(...threatConditions),
                or(...entityConditions)
              )
            );
          } else {
            // If only one category is selected, show no results (requires both)
            conditions.push(sql`FALSE`);
          }
        } else {
          // News Radar: OR matching
          const keywordTerms = Array.isArray(keywordsToFilter) && keywordsToFilter[0]?.term 
            ? keywordsToFilter.map(k => k.term)
            : keywordsToFilter;
            
          const keywordConditions = keywordTerms.map(kw => 
            or(
              ilike(globalArticles.title, `%${kw}%`),
              ilike(globalArticles.content, `%${kw}%`)
            )
          );
          
          if (keywordConditions.length > 0) {
            conditions.push(or(...keywordConditions));
          }
        }
      }

      // Count articles with all conditions applied
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(globalArticles)
        .where(and(...conditions));

      const count = result?.count || 0;
      log(`[UnifiedStorage] Article count for user: ${count}`, 'storage');
      return count;
    } catch (error: any) {
      log(`[UnifiedStorage] Error getting article count: ${error.message}`, 'storage-error');
      return 0;
    }
  }
}

// Export singleton instance
export const unifiedStorage = new UnifiedStorageService();
