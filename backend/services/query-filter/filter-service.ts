// Query-time Filtering Service - Filters global articles based on user preferences
import { db } from "backend/db/db";
import { eq, and, or, inArray, ilike, desc, asc } from "drizzle-orm";
import { log } from "backend/utils/log";
// TODO: Import actual tables once schema is integrated
// import { globalArticles, globalSources, userSourcePreferences, userKeywords } from "@shared/db/schema/global";

interface FilterOptions {
  userId: string;
  appContext: 'news_radar' | 'threat_tracker';
  keywords?: string[];
  sources?: string[];
  includeNonCybersecurity?: boolean; // For threat-tracker, filter by cybersecurity relevance
  minSecurityScore?: number; // For threat-tracker, minimum security score
  threatCategories?: string[]; // For threat-tracker, specific threat types
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'relevance' | 'security_score';
  sortOrder?: 'asc' | 'desc';
}

interface FilteredArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  author: string | null;
  publishDate: Date | null;
  summary: string | null;
  isCybersecurity: boolean;
  securityScore: number | null;
  threatCategories: string[] | null;
  sourceName: string;
  sourceUrl: string;
  scrapedAt: Date;
  relevanceScore: number; // Calculated based on keyword matches
}

interface FilterResult {
  articles: FilteredArticle[];
  totalCount: number;
  hasMore: boolean;
  filters: {
    activeKeywords: string[];
    activeSources: string[];
    appliedFilters: string[];
  };
}

/**
 * Main query-time filtering service
 */
export class QueryFilterService {
  /**
   * Filter articles based on user preferences and query parameters
   */
  async filterArticles(options: FilterOptions): Promise<FilterResult> {
    const startTime = Date.now();
    
    try {
      log(`[QueryFilter] Starting article filter for user ${options.userId} (${options.appContext})`, 'query-filter');

      // TODO: Replace with actual implementation once schema is integrated
      // For now, return placeholder structure
      const placeholderResult: FilterResult = {
        articles: [],
        totalCount: 0,
        hasMore: false,
        filters: {
          activeKeywords: options.keywords || [],
          activeSources: options.sources || [],
          appliedFilters: ['Database schema not yet integrated']
        }
      };

      log(`[QueryFilter] Filter completed in ${Date.now() - startTime}ms - found 0 articles (placeholder)`, 'query-filter');
      return placeholderResult;

      /*
      // ACTUAL IMPLEMENTATION (to be uncommented once schema is available):
      
      // Step 1: Get user's source preferences
      const userSources = await this.getUserSourcePreferences(options.userId, options.appContext);
      
      // Step 2: Get user's keyword preferences
      const userKeywords = await this.getUserKeywords(options.userId, options.appContext);
      
      // Step 3: Build base query
      let query = db.select({
        id: globalArticles.id,
        title: globalArticles.title,
        content: globalArticles.content,
        url: globalArticles.url,
        author: globalArticles.author,
        publishDate: globalArticles.publishDate,
        summary: globalArticles.summary,
        isCybersecurity: globalArticles.isCybersecurity,
        securityScore: globalArticles.securityScore,
        threatCategories: globalArticles.threatCategories,
        sourceName: globalSources.name,
        sourceUrl: globalSources.url,
        scrapedAt: globalArticles.scrapedAt,
      })
      .from(globalArticles)
      .leftJoin(globalSources, eq(globalArticles.sourceId, globalSources.id));

      // Step 4: Apply filters
      const filters = this.buildFilterConditions(options, userSources, userKeywords);
      if (filters.length > 0) {
        query = query.where(and(...filters));
      }

      // Step 5: Apply sorting
      query = this.applySorting(query, options);

      // Step 6: Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      // Step 7: Execute query
      const articles = await query;
      
      // Step 8: Calculate relevance scores and total count
      const articlesWithRelevance = await this.calculateRelevanceScores(articles, userKeywords);
      const totalCount = await this.getTotalCount(filters);

      const result: FilterResult = {
        articles: articlesWithRelevance,
        totalCount,
        hasMore: options.offset ? (options.offset + articles.length) < totalCount : articles.length >= (options.limit || 50),
        filters: {
          activeKeywords: userKeywords,
          activeSources: userSources.map(s => s.name),
          appliedFilters: this.getAppliedFilters(options)
        }
      };

      const duration = Date.now() - startTime;
      log(`[QueryFilter] Filter completed in ${duration}ms - found ${articles.length} articles`, 'query-filter');

      return result;
      */

    } catch (error) {
      log(`[QueryFilter] Filter failed for user ${options.userId}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get user's active source preferences for app context
   */
  private async getUserSourcePreferences(userId: string, appContext: string): Promise<any[]> {
    // TODO: Implement once schema is available
    /*
    return await db.select({
      sourceId: userSourcePreferences.sourceId,
      name: globalSources.name,
      url: globalSources.url
    })
    .from(userSourcePreferences)
    .leftJoin(globalSources, eq(userSourcePreferences.sourceId, globalSources.id))
    .where(and(
      eq(userSourcePreferences.userId, userId),
      eq(userSourcePreferences.appContext, appContext),
      eq(userSourcePreferences.isEnabled, true)
    ));
    */
    return [];
  }

  /**
   * Get user's active keywords for app context
   */
  private async getUserKeywords(userId: string, appContext: string): Promise<string[]> {
    // TODO: Implement once schema is available
    /*
    const keywords = await db.select({ term: userKeywords.term })
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, userId),
        eq(userKeywords.appContext, appContext),
        eq(userKeywords.isActive, true)
      ));
    
    return keywords.map(k => k.term);
    */
    return [];
  }

  /**
   * Build filter conditions based on options and user preferences
   */
  private buildFilterConditions(options: FilterOptions, userSources: any[], userKeywords: string[]): any[] {
    const conditions = [];

    // Source filtering - either user's preferred sources or explicitly provided sources
    const sourcesToFilter = options.sources || userSources.map(s => s.sourceId);
    if (sourcesToFilter.length > 0) {
      // conditions.push(inArray(globalArticles.sourceId, sourcesToFilter));
    }

    // Keyword filtering - either user's keywords or explicitly provided keywords
    const keywordsToFilter = options.keywords || userKeywords;
    if (keywordsToFilter.length > 0) {
      const keywordConditions = keywordsToFilter.map(keyword => {
        // Search in title, content, and detected keywords
        return or(
          // ilike(globalArticles.title, `%${keyword}%`),
          // ilike(globalArticles.content, `%${keyword}%`)
          // TODO: Also search in detectedKeywords JSON field
        );
      });
      // conditions.push(or(...keywordConditions));
    }

    // Cybersecurity filtering (for threat-tracker)
    if (options.appContext === 'threat_tracker') {
      if (!options.includeNonCybersecurity) {
        // conditions.push(eq(globalArticles.isCybersecurity, true));
      }
      
      if (options.minSecurityScore) {
        // conditions.push(gte(globalArticles.securityScore, options.minSecurityScore));
      }
      
      if (options.threatCategories && options.threatCategories.length > 0) {
        // TODO: Filter by threat categories in JSON field
      }
    }

    // Date filtering
    if (options.dateFrom) {
      // conditions.push(gte(globalArticles.scrapedAt, options.dateFrom));
    }
    
    if (options.dateTo) {
      // conditions.push(lte(globalArticles.scrapedAt, options.dateTo));
    }

    return conditions;
  }

  /**
   * Apply sorting to query
   */
  private applySorting(query: any, options: FilterOptions): any {
    const sortOrder = options.sortOrder || 'desc';
    
    switch (options.sortBy) {
      case 'date':
        return sortOrder === 'desc' 
          ? query.orderBy(desc(/* globalArticles.scrapedAt */))
          : query.orderBy(asc(/* globalArticles.scrapedAt */));
      
      case 'security_score':
        if (options.appContext === 'threat_tracker') {
          return sortOrder === 'desc'
            ? query.orderBy(desc(/* globalArticles.securityScore */))
            : query.orderBy(asc(/* globalArticles.securityScore */));
        }
        break;
        
      case 'relevance':
        // TODO: Implement relevance-based sorting
        break;
    }

    // Default: sort by date (newest first)
    return query.orderBy(desc(/* globalArticles.scrapedAt */));
  }

  /**
   * Calculate relevance scores based on keyword matches
   */
  private async calculateRelevanceScores(articles: any[], keywords: string[]): Promise<FilteredArticle[]> {
    if (keywords.length === 0) {
      return articles.map(article => ({
        ...article,
        relevanceScore: 0
      }));
    }

    return articles.map(article => {
      let score = 0;
      const text = `${article.title} ${article.content} ${article.summary || ''}`.toLowerCase();
      
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const titleMatches = (article.title?.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
        const contentMatches = (article.content?.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
        const summaryMatches = (article.summary?.toLowerCase().match(new RegExp(keywordLower, 'g')) || []).length;
        
        // Weight title matches higher than content matches
        score += titleMatches * 3 + contentMatches * 1 + summaryMatches * 2;
      });

      return {
        ...article,
        relevanceScore: score
      };
    });
  }

  /**
   * Get total count for pagination
   */
  private async getTotalCount(filters: any[]): Promise<number> {
    // TODO: Implement once schema is available
    /*
    const result = await db.select({ count: count() })
      .from(globalArticles)
      .leftJoin(globalSources, eq(globalArticles.sourceId, globalSources.id))
      .where(filters.length > 0 ? and(...filters) : undefined);
    
    return result[0]?.count || 0;
    */
    return 0;
  }

  /**
   * Get list of applied filters for UI display
   */
  private getAppliedFilters(options: FilterOptions): string[] {
    const filters = [];
    
    if (options.keywords && options.keywords.length > 0) {
      filters.push(`Keywords: ${options.keywords.join(', ')}`);
    }
    
    if (options.sources && options.sources.length > 0) {
      filters.push(`Sources: ${options.sources.length} selected`);
    }
    
    if (options.appContext === 'threat_tracker') {
      if (!options.includeNonCybersecurity) {
        filters.push('Cybersecurity articles only');
      }
      
      if (options.minSecurityScore) {
        filters.push(`Min security score: ${options.minSecurityScore}`);
      }
      
      if (options.threatCategories && options.threatCategories.length > 0) {
        filters.push(`Threat types: ${options.threatCategories.join(', ')}`);
      }
    }
    
    if (options.dateFrom || options.dateTo) {
      filters.push('Date range applied');
    }
    
    return filters;
  }
}

// Export singleton instance
export const queryFilterService = new QueryFilterService();