# Performance Optimizations for Threat Tracker

## Overview
This document outlines the comprehensive performance optimizations implemented in the enhanced threat tracker system to ensure scalability and efficiency.

## Components Implemented

### 1. Performance Optimizer Service (`performance-optimizer.ts`)
A comprehensive service that handles:

#### Batch Processing
- **Optimized Batch Processing**: Processes articles in configurable batches with controlled concurrency
- **Parallel Execution**: Supports parallel processing of multiple batches (default: 3 concurrent batches)
- **Progress Tracking**: Real-time progress reporting for long-running operations

#### Query Optimization
- **Selective Column Fetching**: Only retrieves necessary columns to reduce data transfer
- **Indexed Queries**: Leverages database indexes for faster queries
- **Optimized Sorting**: Efficient ordering by relevance, severity, or date

#### Caching Strategy
- **In-Memory Cache**: LRU cache with configurable TTL (default: 5 minutes)
- **Query Result Caching**: Caches frequently accessed article lists
- **Cache Pre-warming**: Pre-loads cache for active users
- **Cache Invalidation**: Smart invalidation per user or globally

#### Database Optimization
- **Bulk Operations**: Efficient bulk insert/update with conflict handling
- **Table Analysis**: Periodic ANALYZE operations for query optimization
- **Cleanup Tasks**: Automatic cleanup of old cache entries

### 2. Rate Limiter Service (`rate-limiter.ts`)
Comprehensive rate limiting for API protection:

#### General Rate Limiter
- **Configurable Windows**: Time-based rate limiting (default: 60 requests/minute)
- **Per-User Tracking**: Individual rate limits per user/identifier
- **Automatic Cleanup**: Removes expired entries periodically

#### Specialized Rate Limiters
- **OpenAI Rate Limiter**: 50 requests/minute for GPT-4 API calls
- **Entity Extraction Limiter**: 100 extractions/minute
- **Relevance Calculation Limiter**: 50 calculations/5 minutes

#### Rate-Limited Queue System
- **Request Queue**: Processes requests with automatic rate limiting
- **Priority Queue**: Supports priority-based request ordering
- **Concurrency Control**: Configurable concurrent request processing
- **Retry Logic**: Automatic retry with exponential backoff

## Usage Examples

### Using Performance Optimizer

```typescript
import { performanceOptimizer } from './performance-optimizer';

// Get optimized articles with caching
const articles = await performanceOptimizer.getArticlesWithRelevanceOptimized(userId, {
  limit: 50,
  sortBy: 'relevance',
  minSeverity: 5
});

// Process articles in batches
await performanceOptimizer.batchProcessArticles(
  articleIds,
  async (batch) => {
    // Process batch
  },
  {
    batchSize: 50,
    concurrency: 3,
    onProgress: (processed, total) => {
      console.log(`Progress: ${processed}/${total}`);
    }
  }
);

// Pre-warm cache for active users
await performanceOptimizer.prewarmCache(['user1', 'user2']);

// Invalidate cache when data changes
performanceOptimizer.invalidateCache(userId);
```

### Using Rate Limiter

```typescript
import { openAIRateLimiter, relevanceQueue } from './rate-limiter';

// Check rate limit before API call
const { allowed, retryAfter } = await openAIRateLimiter.checkOpenAILimit(userId);
if (!allowed) {
  throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
}

// Use rate-limited queue for automatic rate limiting
const result = await relevanceQueue.enqueue(
  'user-123',
  async () => {
    // Your async operation
    return calculateRelevance();
  },
  1 // Priority (higher = processed first)
);
```

## Performance Metrics

### Caching Performance
- Cache hit rate tracking
- Size monitoring
- TTL management

### Database Performance
- Query execution time tracking
- Batch processing efficiency
- Index usage monitoring

### Rate Limiting Metrics
- Request throughput monitoring
- Rate limit violations tracking
- Queue performance statistics

## Configuration

### Cache Configuration
```typescript
const cache = new Cache({
  defaultTTL: 300,  // 5 minutes
  maxSize: 1000     // Maximum cache entries
});
```

### Rate Limiter Configuration
```typescript
const limiter = new RateLimiter({
  windowMs: 60000,      // 1 minute window
  maxRequests: 60,      // 60 requests per window
  skipFailedRequests: true // Don't count failures
});
```

### Batch Processing Configuration
```typescript
{
  batchSize: 50,        // Items per batch
  concurrency: 3,       // Parallel batches
  onProgress: callback  // Progress reporting
}
```

## Best Practices

### 1. Use Batch Processing for Large Operations
- Process articles in batches of 50-100
- Limit concurrency to 3-5 parallel operations
- Implement progress tracking for user feedback

### 2. Leverage Caching Strategically
- Cache frequently accessed data (articles, scores)
- Use short TTLs (1-5 minutes) for dynamic data
- Invalidate cache after data mutations

### 3. Implement Rate Limiting
- Protect expensive API endpoints (OpenAI, entity extraction)
- Use queues for automatic rate limit handling
- Set conservative limits to avoid service disruption

### 4. Monitor Performance
- Track cache hit rates (target: >80%)
- Monitor query execution times
- Alert on rate limit violations

### 5. Database Optimization
- Run periodic ANALYZE operations
- Clean up old cache entries regularly
- Use bulk operations for batch inserts/updates

## Integration Points

### Background Jobs
- Entity extraction uses rate-limited queues
- Relevance calculation uses batch processing
- Article processing uses performance optimizer

### API Endpoints
- `/articles/with-relevance` uses cached queries
- `/relevance/calculate` uses rate limiting
- All endpoints benefit from optimized queries

### Frontend Components
- Enhanced threat list leverages cached data
- Real-time progress tracking for calculations
- Efficient pagination with query optimization

## Monitoring & Maintenance

### Regular Tasks
1. **Daily**: Monitor cache hit rates and adjust TTLs
2. **Weekly**: Review rate limit violations and adjust limits
3. **Monthly**: Clean up old cache entries and analyze tables

### Performance Targets
- Cache hit rate: >80%
- Average query time: <100ms
- Rate limit violations: <1%
- Queue processing time: <5s per batch

## Future Enhancements

1. **Redis Integration**: Move cache to Redis for distributed caching
2. **Query Optimization**: Implement materialized views for complex queries
3. **Auto-scaling**: Dynamic rate limit adjustment based on load
4. **Monitoring Dashboard**: Real-time performance metrics visualization
5. **Predictive Pre-caching**: ML-based cache pre-warming