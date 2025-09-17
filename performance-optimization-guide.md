# RisqAi Performance Optimization Guide

## Overview
This document outlines two critical performance optimizations for the RisqAi platform's article query system that can reduce loading times from 2-5 seconds to under 100ms.

## Current Performance Issues

### Bottlenecks Identified
1. **ILIKE Pattern Matching**: Scanning full article content (thousands of characters) for each keyword
2. **Sequential Keyword Decryption**: 5-20ms per keyword, adding 100-400ms for 20 keywords
3. **No Database Indexes**: Missing indexes on frequently queried columns
4. **Large Data Transfers**: Requesting up to 1000 articles at once

## Optimization 1: PostgreSQL Full-Text Search

### Problem
Current implementation uses inefficient ILIKE queries:
```sql
WHERE (
  title ILIKE '%ransomware%' OR 
  content ILIKE '%ransomware%' OR
  title ILIKE '%vulnerability%' OR 
  content ILIKE '%vulnerability%'
)
```

### Solution: Full-Text Search with tsvector

#### Step 1: Add Search Vector Column
```sql
-- Add a generated column for full-text search
ALTER TABLE global_articles 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C')
) STORED;
```

**Weight Explanation:**
- `A` (title): Highest priority, matches here rank highest
- `B` (summary): Medium priority
- `C` (content): Lower priority but still searchable

#### Step 2: Create GIN Index
```sql
-- Create index for ultra-fast text searches
CREATE INDEX idx_articles_search ON global_articles USING GIN(search_vector);

-- Optional: Index for partial matches
CREATE INDEX idx_articles_search_trigram ON global_articles 
USING GIN(title gin_trgm_ops, content gin_trgm_ops);
```

#### Step 3: Update Drizzle Schema
```typescript
// shared/db/schema/global-tables.ts
import { sql } from 'drizzle-orm';

export const globalArticles = pgTable('global_articles', {
  // ... existing columns ...
  
  // Add search vector column definition
  searchVector: text('search_vector')
    .generatedAlwaysAs(sql`
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'C')
    `)
});
```

#### Step 4: Implement Search Query
```typescript
// backend/services/unified-storage/index.ts

// Replace ILIKE conditions with full-text search
if (keywordsToFilter.length > 0) {
  // Build search query from keywords
  const searchTerms = keywordsToFilter
    .map(kw => kw.replace(/[^\w\s]/g, '')) // Sanitize special characters
    .join(' | '); // OR operator for tsquery
  
  // Use full-text search
  conditions.push(
    sql`search_vector @@ to_tsquery('english', ${searchTerms})`
  );
  
  // Optional: Add relevance ranking
  const articlesWithRank = await db
    .select({
      ...globalArticles,
      rank: sql`ts_rank(search_vector, to_tsquery('english', ${searchTerms}))`
    })
    .from(globalArticles)
    .where(conditions)
    .orderBy(sql`ts_rank(search_vector, to_tsquery('english', ${searchTerms})) DESC`);
}
```

#### Advanced Search Features
```typescript
// Phrase search: "critical vulnerability"
const phraseSearch = sql`
  search_vector @@ phraseto_tsquery('english', ${phrase})
`;

// Proximity search: "security" within 5 words of "breach"
const proximitySearch = sql`
  search_vector @@ to_tsquery('english', 'security <5> breach')
`;

// Weighted search with ranking
const weightedSearch = sql`
  SELECT *, 
    ts_rank_cd(search_vector, query, 32) AS rank
  FROM global_articles,
    to_tsquery('english', ${searchTerms}) query
  WHERE search_vector @@ query
  ORDER BY rank DESC
`;
```

### Performance Impact
- **Before**: 2-5 seconds for 10,000 articles
- **After**: 50-200ms for same dataset
- **Improvement**: 10-100x faster

## Optimization 2: Keyword Caching

### Problem
Keywords are decrypted on every request:
```typescript
// Current: 100-400ms overhead per request
const decryptedKeywords = await Promise.all(
  encryptedKeywords.map(async (k) => ({
    ...k,
    term: await envelopeDecryptAndRotate(keywords, k.id, 'term', userId)
  }))
);
```

### Solution A: In-Memory Cache

#### Implementation
```typescript
// backend/services/keyword-cache.ts
import { LRUCache } from 'lru-cache';

export class KeywordCache {
  private static instance: KeywordCache;
  private cache: LRUCache<string, CachedKeyword>;
  
  private constructor() {
    this.cache = new LRUCache<string, CachedKeyword>({
      max: 1000, // Maximum 1000 entries
      ttl: 10 * 60 * 1000, // 10 minutes TTL
      updateAgeOnGet: true, // Refresh TTL on access
      allowStale: false,
    });
  }
  
  static getInstance(): KeywordCache {
    if (!KeywordCache.instance) {
      KeywordCache.instance = new KeywordCache();
    }
    return KeywordCache.instance;
  }
  
  async getKeyword(
    userId: string, 
    keywordId: string, 
    encryptedTerm: string,
    decryptFn: () => Promise<string>
  ): Promise<string> {
    const cacheKey = `${userId}:${keywordId}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.term;
    }
    
    // Decrypt and cache
    const decrypted = await decryptFn();
    this.cache.set(cacheKey, {
      term: decrypted,
      userId,
      keywordId,
      cachedAt: new Date()
    });
    
    return decrypted;
  }
  
  async getMultipleKeywords(
    userId: string,
    keywords: Array<{id: string, term: string}>,
    decryptFn: (keyword: any) => Promise<string>
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const toDecrypt = [];
    
    // Check cache first
    for (const kw of keywords) {
      const cacheKey = `${userId}:${kw.id}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        results.set(kw.id, cached.term);
      } else {
        toDecrypt.push(kw);
      }
    }
    
    // Batch decrypt missing keywords
    if (toDecrypt.length > 0) {
      const decrypted = await Promise.all(
        toDecrypt.map(kw => decryptFn(kw))
      );
      
      // Cache and add to results
      toDecrypt.forEach((kw, index) => {
        const cacheKey = `${userId}:${kw.id}`;
        const term = decrypted[index];
        
        this.cache.set(cacheKey, {
          term,
          userId,
          keywordId: kw.id,
          cachedAt: new Date()
        });
        
        results.set(kw.id, term);
      });
    }
    
    return results;
  }
  
  // Clear cache for a user when keywords are updated
  clearUserCache(userId: string) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }
  
  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      hits: this.cache.hits,
      misses: this.cache.misses,
      hitRate: this.cache.hits / (this.cache.hits + this.cache.misses)
    };
  }
}

interface CachedKeyword {
  term: string;
  userId: string;
  keywordId: string;
  cachedAt: Date;
}
```

#### Integration with Unified Storage
```typescript
// backend/services/unified-storage/index.ts
import { KeywordCache } from '../keyword-cache';

class UnifiedStorageService {
  private keywordCache = KeywordCache.getInstance();
  
  async getArticles(userId: string, appType: string, filter?: ArticleFilter) {
    // ... existing code ...
    
    if (filter?.keywordIds && filter.keywordIds.length > 0) {
      if (appType === 'news-radar') {
        const encryptedKeywords = await withUserContext(/* ... */);
        
        // Use cache for decryption
        const decryptedMap = await this.keywordCache.getMultipleKeywords(
          userId,
          encryptedKeywords,
          async (kw) => await envelopeDecryptAndRotate(keywords, kw.id, 'term', userId)
        );
        
        keywordsToFilter = Array.from(decryptedMap.values());
      }
      // Similar for threat-tracker
    }
  }
}
```

### Solution B: Redis Cache (Production-Ready)

#### Setup
```typescript
// backend/services/redis-cache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export class RedisKeywordCache {
  private readonly TTL = 600; // 10 minutes in seconds
  private readonly PREFIX = 'keyword:';
  
  async getKeywords(
    userId: string, 
    keywordData: Array<{id: string, term: string}>,
    decryptFn: (kw: any) => Promise<string>
  ): Promise<Map<string, string>> {
    const pipeline = redis.pipeline();
    const cacheKeys = keywordData.map(kw => 
      `${this.PREFIX}${userId}:${kw.id}`
    );
    
    // Get all cached values in one call
    cacheKeys.forEach(key => pipeline.get(key));
    const cached = await pipeline.exec();
    
    const results = new Map<string, string>();
    const toDecrypt = [];
    const decryptIndices = [];
    
    // Process cache results
    cached?.forEach(([err, value], index) => {
      if (value) {
        results.set(keywordData[index].id, value as string);
      } else {
        toDecrypt.push(keywordData[index]);
        decryptIndices.push(index);
      }
    });
    
    // Decrypt missing keywords
    if (toDecrypt.length > 0) {
      const decrypted = await Promise.all(
        toDecrypt.map(kw => decryptFn(kw))
      );
      
      // Store in Redis with pipeline
      const setPipeline = redis.pipeline();
      decrypted.forEach((term, i) => {
        const kw = toDecrypt[i];
        const cacheKey = `${this.PREFIX}${userId}:${kw.id}`;
        
        setPipeline.setex(cacheKey, this.TTL, term);
        results.set(kw.id, term);
      });
      
      await setPipeline.exec();
    }
    
    return results;
  }
  
  async clearUserCache(userId: string): Promise<void> {
    const pattern = `${this.PREFIX}${userId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
  
  async warmCache(
    userId: string, 
    keywords: Array<{id: string, term: string}>
  ): Promise<void> {
    const pipeline = redis.pipeline();
    
    keywords.forEach(kw => {
      const cacheKey = `${this.PREFIX}${userId}:${kw.id}`;
      pipeline.setex(cacheKey, this.TTL, kw.term);
    });
    
    await pipeline.exec();
  }
}
```

### Cache Invalidation Strategy

#### Event-Based Invalidation
```typescript
// backend/apps/threat-tracker/router/index.ts

// Clear cache when keywords are updated
router.post('/keywords/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  // Update keyword in database
  await updateKeyword(id, req.body);
  
  // Clear user's keyword cache
  const cache = KeywordCache.getInstance();
  cache.clearUserCache(userId);
  
  res.json({ success: true });
});

// Clear cache when keywords are deleted
router.delete('/keywords/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  // Delete keyword
  await deleteKeyword(id);
  
  // Clear cache
  const cache = KeywordCache.getInstance();
  cache.clearUserCache(userId);
  
  res.json({ success: true });
});
```

### Performance Metrics

#### Expected Results
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| First Request | 100-400ms | 100-400ms | No change (must decrypt) |
| Subsequent Requests | 100-400ms | 1-5ms | 20-100x faster |
| Memory Usage | 0 | ~50KB per 1000 keywords | Minimal overhead |
| Cache Hit Rate | N/A | 85-95% | High efficiency |

#### Monitoring
```typescript
// Add monitoring endpoint
router.get('/cache/stats', async (req, res) => {
  const cache = KeywordCache.getInstance();
  const stats = cache.getStats();
  
  res.json({
    ...stats,
    memoryUsageMB: stats.calculatedSize / (1024 * 1024),
    recommendation: stats.hitRate < 0.7 
      ? 'Consider increasing TTL' 
      : 'Cache performing well'
  });
});
```

## Implementation Plan

### Phase 1: Quick Wins (1-2 hours)
1. Add database indexes on `publishDate`, `isCybersecurity`
2. Reduce frontend query limit from 1000 to 50
3. Implement basic in-memory keyword caching

### Phase 2: Full-Text Search (2-4 hours)
1. Add `search_vector` column to database
2. Create GIN indexes
3. Update query logic to use full-text search
4. Test and optimize search queries

### Phase 3: Production Caching (2-3 hours)
1. Set up Redis (if not already available)
2. Implement Redis-based keyword cache
3. Add cache invalidation logic
4. Add monitoring and metrics

### Phase 4: Fine-Tuning (1-2 hours)
1. Adjust cache TTL based on usage patterns
2. Optimize full-text search weights
3. Add relevance scoring to results
4. Performance testing and benchmarking

## Testing Strategy

### Load Testing
```bash
# Test current performance
time curl -X GET "http://localhost:5000/api/threat-tracker/articles?limit=1000"

# Test with optimizations
time curl -X GET "http://localhost:5000/api/threat-tracker/articles?limit=50"
```

### Cache Testing
```typescript
// Test cache hit rate
async function testCachePerformance() {
  const cache = KeywordCache.getInstance();
  
  // First request - cache miss
  console.time('First request');
  await getArticlesWithKeywords(userId, keywordIds);
  console.timeEnd('First request');
  
  // Second request - cache hit
  console.time('Second request');
  await getArticlesWithKeywords(userId, keywordIds);
  console.timeEnd('Second request');
  
  // Check stats
  console.log('Cache stats:', cache.getStats());
}
```

## Rollback Plan

If issues occur:

1. **Full-Text Search**: Drop the search_vector column and indexes, revert to ILIKE
2. **Caching**: Disable cache by setting TTL to 0 or bypassing cache logic
3. **Both**: Keep feature flags to enable/disable optimizations

```typescript
// Feature flags for gradual rollout
const FEATURES = {
  USE_FULL_TEXT_SEARCH: process.env.USE_FTS === 'true',
  USE_KEYWORD_CACHE: process.env.USE_CACHE === 'true',
  CACHE_TTL_MINUTES: parseInt(process.env.CACHE_TTL || '10'),
};
```

## Expected Overall Impact

Combining both optimizations:

| Query Type | Current Time | Optimized Time | Improvement |
|------------|--------------|----------------|-------------|
| 20 keywords, 10k articles | 2-5 seconds | 50-100ms | 20-100x faster |
| 5 keywords, 1k articles | 500-1000ms | 20-50ms | 10-50x faster |
| No keywords, date filter | 200-500ms | 10-30ms | 10-20x faster |

## Additional Optimizations to Consider

1. **Database Connection Pooling**: Ensure proper connection pool settings
2. **Query Result Caching**: Cache entire article query results for popular filters
3. **CDN for Static Assets**: Offload article images/media
4. **Database Partitioning**: Partition articles table by date for faster queries
5. **Materialized Views**: Pre-compute common aggregations

## Conclusion

These two optimizations address the most critical performance bottlenecks:
- Full-text search eliminates expensive content scanning
- Keyword caching removes redundant decryption overhead

Together, they can reduce query times by 95-98%, making the application feel instant rather than sluggish.