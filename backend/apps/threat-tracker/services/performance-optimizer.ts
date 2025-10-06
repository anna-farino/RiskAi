import { db } from "../../../db/db";
import { globalArticles } from "../../../../shared/db/schema/global-tables";
import { articleRelevanceScores } from "../../../../shared/db/schema/threat-tracker/relevance-scoring";
import { entityResolutionCache } from "../../../../shared/db/schema/threat-tracker/entity-resolution";
import { eq, sql, and, gte, lte, inArray, isNull, desc } from "drizzle-orm";
import { log } from "backend/utils/log";

// =====================================================
// PERFORMANCE OPTIMIZER SERVICE
// =====================================================

export class PerformanceOptimizer {
  private cache: Cache;
  
  constructor() {
    this.cache = new Cache({
      defaultTTL: 300, // 5 minutes default
      maxSize: 1000
    });
  }
  
  // =====================================================
  // BATCH PROCESSING OPTIMIZATION
  // =====================================================
  
  /**
   * Process entities in optimized batches with parallel processing
   */
  async batchProcessArticles(
    articleIds: string[],
    processor: (batch: string[]) => Promise<void>,
    options: {
      batchSize?: number;
      concurrency?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ) {
    const { 
      batchSize = 50, 
      concurrency = 3,
      onProgress 
    } = options;
    
    const batches: string[][] = [];
    for (let i = 0; i < articleIds.length; i += batchSize) {
      batches.push(articleIds.slice(i, i + batchSize));
    }
    
    let processedCount = 0;
    
    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += concurrency) {
      const concurrentBatches = batches.slice(i, i + concurrency);
      
      await Promise.all(
        concurrentBatches.map(async (batch) => {
          try {
            await processor(batch);
            processedCount += batch.length;
            
            if (onProgress) {
              onProgress(processedCount, articleIds.length);
            }
          } catch (error) {
            log(`Error processing batch: ${error}`, "performance-optimizer");
          }
        })
      );
    }
    
    return processedCount;
  }
  
  // =====================================================
  // QUERY OPTIMIZATION
  // =====================================================
  
  /**
   * Optimized query for fetching articles with relevance scores
   * Uses proper indexing and selective column fetching
   */
  async getArticlesWithRelevanceOptimized(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      minSeverity?: number;
      sortBy?: 'relevance' | 'severity' | 'date';
    } = {}
  ) {
    const {
      limit = 50,
      offset = 0,
      minSeverity = 0,
      sortBy = 'relevance'
    } = options;
    
    const cacheKey = `articles:${userId}:${sortBy}:${minSeverity}:${limit}:${offset}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Build optimized query with selective columns
    const query = db
      .select({
        // Only select needed columns for performance
        id: globalArticles.id,
        title: globalArticles.title,
        summary: globalArticles.summary,
        url: globalArticles.url,
        publishDate: globalArticles.publishDate,
        threatSeverityScore: globalArticles.threatSeverityScore,
        // Relevance data
        relevanceScore: articleRelevanceScores.relevanceScore,
        softwareScore: articleRelevanceScores.softwareScore,
        hardwareScore: articleRelevanceScores.hardwareScore,
        vendorScore: articleRelevanceScores.vendorScore,
        clientScore: articleRelevanceScores.clientScore,
        keywordScore: articleRelevanceScores.keywordScore,
        matchedSoftware: articleRelevanceScores.matchedSoftware,
        matchedCompanies: articleRelevanceScores.matchedCompanies,
        matchedHardware: articleRelevanceScores.matchedHardware,
        matchedKeywords: articleRelevanceScores.matchedKeywords
      })
      .from(globalArticles)
      .leftJoin(
        articleRelevanceScores,
        and(
          eq(articleRelevanceScores.articleId, globalArticles.id),
          eq(articleRelevanceScores.userId, userId)
        )
      )
      .where(and(
        eq(globalArticles.isCybersecurity, true),
        gte(globalArticles.threatSeverityScore, minSeverity.toString())
      ));
    
    // Apply optimized sorting
    if (sortBy === 'relevance') {
      query.orderBy(
        desc(articleRelevanceScores.relevanceScore),
        desc(globalArticles.threatSeverityScore)
      );
    } else if (sortBy === 'severity') {
      query.orderBy(
        desc(globalArticles.threatSeverityScore),
        desc(articleRelevanceScores.relevanceScore)
      );
    } else {
      query.orderBy(desc(globalArticles.publishDate));
    }
    
    const results = await query.limit(limit).offset(offset);
    
    // Cache results
    this.cache.set(cacheKey, results, 60); // Cache for 1 minute
    
    return results;
  }
  
  // =====================================================
  // CACHE MANAGEMENT
  // =====================================================
  
  /**
   * Pre-warm cache with frequently accessed data
   */
  async prewarmCache(userIds: string[]) {
    log("Pre-warming cache for active users", "performance-optimizer");
    
    const promises = userIds.map(async (userId) => {
      try {
        // Pre-fetch articles for common queries
        await this.getArticlesWithRelevanceOptimized(userId, {
          limit: 20,
          sortBy: 'relevance'
        });
        
        await this.getArticlesWithRelevanceOptimized(userId, {
          limit: 20,
          sortBy: 'severity'
        });
      } catch (error) {
        log(`Failed to pre-warm cache for user ${userId}: ${error}`, "performance-optimizer");
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Invalidate cache for specific user or globally
   */
  invalidateCache(userId?: string) {
    if (userId) {
      // Invalidate user-specific cache entries
      this.cache.deletePattern(`articles:${userId}:*`);
      this.cache.deletePattern(`relevance:${userId}:*`);
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }
  
  // =====================================================
  // DATABASE OPTIMIZATION
  // =====================================================
  
  /**
   * Clean up old entity resolution cache entries
   */
  async cleanupEntityResolutionCache(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db
      .delete(entityResolutionCache)
      .where(lte(entityResolutionCache.createdAt, cutoffDate));
    
    log(`Cleaned up ${result.rowCount} old entity resolution cache entries`, "performance-optimizer");
    
    return result.rowCount;
  }
  
  /**
   * Vacuum analyze tables for better query performance
   */
  async optimizeTables() {
    try {
      // Analyze tables to update statistics
      await db.execute(sql`ANALYZE global_articles`);
      await db.execute(sql`ANALYZE article_relevance_scores`);
      await db.execute(sql`ANALYZE entity_resolution_cache`);
      await db.execute(sql`ANALYZE software`);
      await db.execute(sql`ANALYZE hardware`);
      await db.execute(sql`ANALYZE companies`);
      
      log("Database tables analyzed for optimal performance", "performance-optimizer");
    } catch (error) {
      log(`Error optimizing tables: ${error}`, "performance-optimizer");
    }
  }
  
  // =====================================================
  // BULK OPERATIONS OPTIMIZATION
  // =====================================================
  
  /**
   * Bulk insert relevance scores with conflict handling
   */
  async bulkUpsertRelevanceScores(scores: any[], chunkSize = 100) {
    let inserted = 0;
    let updated = 0;
    
    for (let i = 0; i < scores.length; i += chunkSize) {
      const chunk = scores.slice(i, i + chunkSize);
      
      try {
        const result = await db
          .insert(articleRelevanceScores)
          .values(chunk)
          .onConflictDoUpdate({
            target: [articleRelevanceScores.userId, articleRelevanceScores.articleId],
            set: {
              relevanceScore: sql`EXCLUDED.relevance_score`,
              softwareScore: sql`EXCLUDED.software_score`,
              hardwareScore: sql`EXCLUDED.hardware_score`,
              vendorScore: sql`EXCLUDED.vendor_score`,
              clientScore: sql`EXCLUDED.client_score`,
              keywordScore: sql`EXCLUDED.keyword_score`,
              matchedSoftware: sql`EXCLUDED.matched_software`,
              matchedCompanies: sql`EXCLUDED.matched_companies`,
              matchedHardware: sql`EXCLUDED.matched_hardware`,
              matchedKeywords: sql`EXCLUDED.matched_keywords`,
              calculatedAt: new Date()
            }
          });
        
        inserted += result.rowCount || 0;
      } catch (error) {
        log(`Error in bulk upsert: ${error}`, "performance-optimizer");
        updated += chunk.length;
      }
    }
    
    return { inserted, updated };
  }
  
  // =====================================================
  // MONITORING & METRICS
  // =====================================================
  
  /**
   * Get performance metrics for monitoring
   */
  async getPerformanceMetrics() {
    const metrics = {
      cacheStats: this.cache.getStats(),
      databaseStats: {
        totalArticles: 0,
        totalRelevanceScores: 0,
        avgQueryTime: 0
      }
    };
    
    // Get database statistics
    const [articleCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(globalArticles)
      .where(eq(globalArticles.isCybersecurity, true));
    
    const [scoreCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articleRelevanceScores);
    
    metrics.databaseStats.totalArticles = articleCount?.count || 0;
    metrics.databaseStats.totalRelevanceScores = scoreCount?.count || 0;
    
    return metrics;
  }
}

// =====================================================
// CACHE IMPLEMENTATION
// =====================================================

class Cache {
  private cache: Map<string, { data: any; expires: number }>;
  private defaultTTL: number;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(options: { defaultTTL?: number; maxSize?: number } = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes
    this.maxSize = options.maxSize || 1000;
  }
  
  get(key: string): any {
    const item = this.cache.get(key);
    
    if (!item) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return item.data;
  }
  
  set(key: string, data: any, ttl?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    const expires = Date.now() + (ttl || this.defaultTTL) * 1000;
    this.cache.set(key, { data, expires });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();