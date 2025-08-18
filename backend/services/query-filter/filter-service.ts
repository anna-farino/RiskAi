// Query-time Filtering Service - Filters global articles based on user preferences
import { db } from "backend/db/db";
import { eq, and, or, inArray, ilike, desc, asc, gte, lte, count } from "drizzle-orm";
import { log } from "backend/utils/log";
import { globalArticles, globalSources, userSourcePreferences, userKeywords } from "@shared/db/schema/global";

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

      // Step 1: Get user's source preferences
      const userSources = await this.getUserSourcePreferences(options.userId, options.appContext);
      
      // Step 2: Get user's keyword preferences
      const userKeywords = await this.getUserKeywords(options.userId, options.appContext);
      
      // Step 3: Build filters
      const filters = this.buildFilterConditions(options, userSources, userKeywords);
      
      // Step 4: Build and execute query using a functional approach
      let queryBuilder = db.select({
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

      // Apply filters conditionally
      if (filters.length > 0) {
        queryBuilder = queryBuilder.where(and(...filters));
      }

      // Apply sorting
      const sortOrder = options.sortOrder || 'desc';
      if (options.sortBy === 'security_score' && options.appContext === 'threat_tracker') {
        queryBuilder = sortOrder === 'desc'
          ? queryBuilder.orderBy(desc(globalArticles.securityScore))
          : queryBuilder.orderBy(asc(globalArticles.securityScore));
      } else {
        queryBuilder = sortOrder === 'desc'
          ? queryBuilder.orderBy(desc(globalArticles.scrapedAt))
          : queryBuilder.orderBy(asc(globalArticles.scrapedAt));
      }

      // Apply pagination
      if (options.offset) {
        queryBuilder = queryBuilder.offset(options.offset);
      }
      if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      // Execute query
      const articles = await queryBuilder;
      
      // Step 5: Calculate relevance scores and total count
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



    } catch (error) {
      log(`[QueryFilter] Filter failed for user ${options.userId}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get user's active source preferences for app context
   */
  private async getUserSourcePreferences(userId: string, appContext: string): Promise<any[]> {
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
  }

  /**
   * Get user's active keywords for app context
   */
  private async getUserKeywords(userId: string, appContext: string): Promise<string[]> {
    const keywords = await db.select({ term: userKeywords.term })
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, userId),
        eq(userKeywords.appContext, appContext),
        eq(userKeywords.isActive, true)
      ));
    
    return keywords.map(k => k.term);
  }

  /**
   * Build filter conditions based on options and user preferences
   */
  private buildFilterConditions(options: FilterOptions, userSources: any[], userKeywords: string[]): any[] {
    const conditions = [];

    // Source filtering - either user's preferred sources or explicitly provided sources
    const sourcesToFilter = options.sources || userSources.map(s => s.sourceId);
    if (sourcesToFilter.length > 0) {
      conditions.push(inArray(globalArticles.sourceId, sourcesToFilter));
    }

    // Keyword filtering - either user's keywords or explicitly provided keywords
    const keywordsToFilter = options.keywords || userKeywords;
    if (keywordsToFilter.length > 0) {
      const keywordConditions = keywordsToFilter.map(keyword => {
        // Search in title, content, and detected keywords
        return or(
          ilike(globalArticles.title, `%${keyword}%`),
          ilike(globalArticles.content, `%${keyword}%`)
          // TODO: Also search in detectedKeywords JSON field
        );
      });
      conditions.push(or(...keywordConditions));
    }

    // Cybersecurity filtering (for threat-tracker)
    if (options.appContext === 'threat_tracker') {
      if (!options.includeNonCybersecurity) {
        conditions.push(eq(globalArticles.isCybersecurity, true));
      }
      
      if (options.minSecurityScore) {
        conditions.push(gte(globalArticles.securityScore, options.minSecurityScore));
      }
      
      if (options.threatCategories && options.threatCategories.length > 0) {
        // TODO: Filter by threat categories in JSON field
      }
    }

    // Date filtering
    if (options.dateFrom) {
      conditions.push(gte(globalArticles.scrapedAt, options.dateFrom));
    }
    
    if (options.dateTo) {
      conditions.push(lte(globalArticles.scrapedAt, options.dateTo));
    }

    return conditions;
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
    const result = await db.select({ count: count() })
      .from(globalArticles)
      .leftJoin(globalSources, eq(globalArticles.sourceId, globalSources.id))
      .where(filters.length > 0 ? and(...filters) : undefined);
    
    return result[0]?.count || 0;
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