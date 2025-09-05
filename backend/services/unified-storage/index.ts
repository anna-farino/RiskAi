/**
 * Unified Storage Service
 * Phase 5: Reads from global tables with user preference filtering
 * Replaces app-specific storage implementations for articles and sources
 */

import { db } from 'backend/db/db';
import {
  globalArticles,
  globalSources,
  userSourcePreferences,
  type GlobalArticle,
  type GlobalSource
} from '@shared/db/schema/global-tables';
import { keywords, type Keyword } from '@shared/db/schema/news-tracker';
import { threatKeywords, type ThreatKeyword } from '@shared/db/schema/threat-tracker';
import { eq, and, or, inArray, sql, desc, ilike, isNull } from 'drizzle-orm';
import { log } from 'backend/utils/log';

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
      let keywordsToFilter: string[] = [];
      
      if (filter?.keywordIds && filter.keywordIds.length > 0) {
        // Use specific keyword IDs sent from frontend
        
        if (appType === 'news-radar') {
          const keywordResults = await db
            .select({ term: keywords.term, id: keywords.id })
            .from(keywords)
            .where(
              and(
                eq(keywords.userId, userId),
                inArray(keywords.id, filter.keywordIds)
              )
            );
          keywordsToFilter = keywordResults.map(k => k.term);
        } else {
          // Threat Tracker: Handle NULL user_id values in threat_keywords table
          const keywordResults = await db
            .select({ term: threatKeywords.term, id: threatKeywords.id })
            .from(threatKeywords)
            .where(
              and(
                // Handle NULL user_id by checking both conditions
                or(
                  eq(threatKeywords.userId, userId),
                  isNull(threatKeywords.userId)
                ),
                inArray(threatKeywords.id, filter.keywordIds)
              )
            );
          keywordsToFilter = keywordResults.map(k => k.term);
        }
      } else {
        // Fallback: Use all active keywords (existing behavior)
        keywordsToFilter = await this.getUserKeywords(userId, appType);
      }
      
      // Handle keyword filtering logic
      if (filter?.keywordIds && filter.keywordIds.length > 0) {
        if (keywordsToFilter.length === 0) {
          // User requested specific keywords but none were found in database
          // This can happen when keywords exist in frontend state but not in database
          log(`[UnifiedStorage] Warning: ${filter.keywordIds.length} keywords requested but 0 found in database. Showing all articles.`, 'storage');
          // Don't apply keyword filtering - show all articles from enabled sources
        } else {
          // Apply keyword filtering if we have keywords
          const keywordConditions = keywordsToFilter.map(kw => 
            or(
              ilike(globalArticles.title, `%${kw}%`),
              ilike(globalArticles.content, `%${kw}%`),
              sql`${globalArticles.detectedKeywords}::text ILIKE ${'%' + kw + '%'}`
            )
          );
          
          if (keywordConditions.length > 0) {
            conditions.push(or(...keywordConditions));
          }
          
          log(`[UnifiedStorage] Applied keyword filter: ${keywordsToFilter.length} terms`, 'storage');
        }
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
        .where(eq(globalSources.isActive, true));

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

      // Count articles
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(globalArticles)
        .where(and(...conditions));

      return result?.count || 0;
    } catch (error: any) {
      log(`[UnifiedStorage] Error getting article count: ${error.message}`, 'storage-error');
      return 0;
    }
  }
}

// Export singleton instance
export const unifiedStorage = new UnifiedStorageService();