# Web Intelligence Platform Re-Architecture Plan
## From User-Specific to Global Shared Scraping Infrastructure

### Executive Summary
This plan outlines the transformation of our current user-specific article scraping system into a global, shared infrastructure that collects all articles and allows users to filter them at query time. The re-architecture maintains all existing scraping capabilities while significantly changing the data model and processing pipeline.

---

## Phase 1: Database Schema Transformation
**Timeline: Week 1-2**

### 1.1 New Global Tables Structure

#### Articles Table (Unified)
```sql
-- CURRENT: Separate tables (articles, threat_articles) with userId
-- NEW: Single global articles table without userId
CREATE TABLE global_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourceId UUID REFERENCES global_sources(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  author TEXT,
  publishDate TIMESTAMP,
  summary TEXT,
  
  -- AI Analysis Fields (New)
  isCybersecurity BOOLEAN DEFAULT FALSE,
  securityScore INTEGER, -- 0-100, only for cybersecurity articles
  threatCategories JSONB, -- {malware: true, ransomware: false, etc}
  
  -- Metadata
  scrapedAt TIMESTAMP DEFAULT NOW(),
  lastAnalyzedAt TIMESTAMP,
  analysisVersion TEXT, -- Track AI model version used
  
  -- Legacy fields for compatibility
  detectedKeywords JSONB -- Maintained but populated differently
);
```

#### Sources Table (Unified)
```sql
-- CURRENT: User-specific sources
-- NEW: Global shared sources
CREATE TABLE global_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT, -- 'news', 'tech', 'security', etc
  
  -- Global status
  isActive BOOLEAN DEFAULT TRUE,
  isDefault BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 50, -- Scraping priority
  
  -- Scraping configuration
  scrapingConfig JSONB,
  lastScraped TIMESTAMP,
  lastSuccessfulScrape TIMESTAMP,
  consecutiveFailures INTEGER DEFAULT 0,
  
  -- Metadata
  addedAt TIMESTAMP DEFAULT NOW(),
  addedBy UUID REFERENCES users(id) -- Admin who added it
);
```

#### User Preferences Tables
```sql
-- User-specific source preferences
CREATE TABLE user_source_preferences (
  userId UUID REFERENCES users(id),
  sourceId UUID REFERENCES global_sources(id),
  appContext TEXT NOT NULL, -- 'news_radar' or 'threat_tracker'
  isEnabled BOOLEAN DEFAULT TRUE,
  enabledAt TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (userId, sourceId, appContext)
);

-- User-specific keywords (unchanged structure, new usage)
CREATE TABLE user_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES users(id) NOT NULL,
  appContext TEXT NOT NULL, -- 'news_radar' or 'threat_tracker'
  term TEXT NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(userId, appContext, term)
);
```

### 1.2 Migration Strategy

#### Step 1: Create New Tables (Non-Destructive)
```sql
-- Run alongside existing tables
CREATE TABLE global_articles_staging (...);
CREATE TABLE global_sources_staging (...);
CREATE TABLE user_source_preferences (...);
```

#### Step 2: Data Migration Script
```javascript
// Migrate existing articles to global table
async function migrateArticles() {
  // 1. Combine articles from both news_radar and threat_tracker
  // 2. Remove userId field
  // 3. Deduplicate by URL
  // 4. Run AI analysis for cybersecurity flagging
  
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const articles = await db.select()
      .from(oldArticles)
      .limit(batchSize)
      .offset(offset);
    
    if (articles.length === 0) break;
    
    const globalArticles = articles.map(article => ({
      ...article,
      userId: undefined, // Remove user association
      isCybersecurity: false, // Will be updated by AI
      securityScore: null,
      scrapedAt: article.createdAt
    }));
    
    // Insert with ON CONFLICT DO NOTHING (URL uniqueness)
    await db.insert(globalArticlesStaging)
      .values(globalArticles)
      .onConflictDoNothing();
    
    offset += batchSize;
  }
}

// Migrate sources to global table
async function migrateSources() {
  // 1. Get all unique sources from both tables
  // 2. Deduplicate by URL
  // 3. Set appropriate defaults
  
  const allSources = await db.execute(sql`
    SELECT DISTINCT url, name, scraping_config
    FROM (
      SELECT url, name, scraping_config FROM sources
      UNION
      SELECT url, name, scraping_config FROM threat_sources
    ) AS combined
  `);
  
  const globalSources = allSources.map(source => ({
    ...source,
    isActive: true,
    category: determineCategory(source.url),
    priority: 50
  }));
  
  await db.insert(globalSourcesStaging).values(globalSources);
}

// Create user preferences from existing data
async function createUserPreferences() {
  // Map existing user-source relationships to preferences
  const userSources = await db.select().from(sources);
  
  for (const source of userSources) {
    await db.insert(userSourcePreferences).values({
      userId: source.userId,
      sourceId: await getGlobalSourceId(source.url),
      appContext: 'news_radar',
      isEnabled: source.active
    });
  }
}
```

### 1.3 Database Performance Optimizations

```sql
-- Materialized view for performance (optional)
CREATE MATERIALIZED VIEW recent_cybersecurity_articles AS
SELECT * FROM global_articles
WHERE isCybersecurity = TRUE
  AND publishDate > NOW() - INTERVAL '7 days'
WITH DATA;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recent_cybersecurity_articles;
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 2: Backend Service Re-Architecture
**Timeline: Week 2-3**

### 2.1 Global Scraping Service

#### New Scraping Scheduler
```typescript
// backend/services/global-scraper/scheduler.ts
export class GlobalScrapingScheduler {
  private job: cron.ScheduledTask;
  private isRunning = false;
  
  async initialize() {
    // Run every 3 hours
    this.job = cron.schedule('0 */3 * * *', async () => {
      if (this.isRunning) {
        console.log('Previous scraping job still running, skipping...');
        return;
      }
      
      await this.runGlobalScrape();
    });
    
    // Run immediately on startup
    await this.runGlobalScrape();
  }
  
  private async runGlobalScrape() {
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      // Get all active sources ordered by priority
      const sources = await db.select()
        .from(globalSources)
        .where(eq(globalSources.isActive, true))
        .orderBy(desc(globalSources.priority));
      
      // Process in parallel with concurrency limit
      const results = await pLimit(5)(
        sources.map(source => () => this.scrapeSource(source))
      );
      
      // Log statistics
      const stats = {
        duration: Date.now() - startTime,
        sourcesProcessed: results.length,
        articlesScraped: results.reduce((sum, r) => sum + r.articles, 0),
        failures: results.filter(r => !r.success).length
      };
      
      await this.logScrapingRun(stats);
      
    } finally {
      this.isRunning = false;
    }
  }
  
  private async scrapeSource(source: GlobalSource) {
    try {
      // Use existing scraping logic WITHOUT keyword filtering
      const articleLinks = await scrapingService.scrapeSourceUrl(source.url);
      
      const articles = [];
      for (const link of articleLinks) {
        const article = await scrapingService.scrapeArticleUrl(link, {
          titleSelector: source.scrapingConfig?.titleSelector,
          contentSelector: source.scrapingConfig?.contentSelector
        });
        
        if (article) {
          // Save immediately without keyword checking
          const saved = await this.saveArticle(article, source.id);
          if (saved) articles.push(saved);
        }
      }
      
      // Update source last scraped time
      await db.update(globalSources)
        .set({ 
          lastScraped: new Date(),
          lastSuccessfulScrape: new Date(),
          consecutiveFailures: 0
        })
        .where(eq(globalSources.id, source.id));
      
      return { success: true, articles: articles.length };
      
    } catch (error) {
      // Increment failure counter
      await db.update(globalSources)
        .set({ 
          consecutiveFailures: sql`consecutive_failures + 1`,
          lastScraped: new Date()
        })
        .where(eq(globalSources.id, source.id));
      
      return { success: false, error: error.message };
    }
  }
  
  private async saveArticle(articleData: any, sourceId: string) {
    try {
      // Check if article already exists (by URL)
      const existing = await db.select()
        .from(globalArticles)
        .where(eq(globalArticles.url, articleData.url))
        .limit(1);
      
      if (existing.length > 0) {
        return null; // Skip duplicates
      }
      
      // Insert new article
      const [article] = await db.insert(globalArticles)
        .values({
          sourceId,
          title: articleData.title,
          content: articleData.content,
          url: articleData.url,
          author: articleData.author,
          publishDate: articleData.publishDate,
          summary: null, // Will be generated by AI processor
          isCybersecurity: false, // Will be determined by AI
          scrapedAt: new Date()
        })
        .returning();
      
      // Queue for AI processing
      await this.queueForAIProcessing(article.id);
      
      return article;
      
    } catch (error) {
      console.error('Error saving article:', error);
      return null;
    }
  }
}
```

### 2.2 AI Processing Pipeline

#### Article Analysis Service
```typescript
// backend/services/ai-processor/analyzer.ts
export class ArticleAnalyzer {
  private processingQueue: Queue;
  
  constructor() {
    // Initialize processing queue with rate limiting
    this.processingQueue = new Queue('article-analysis', {
      concurrency: 3, // Process 3 articles simultaneously
      interval: 1000, // Rate limit for OpenAI API
      intervalCap: 5
    });
  }
  
  async processArticle(articleId: string) {
    const article = await db.select()
      .from(globalArticles)
      .where(eq(globalArticles.id, articleId))
      .limit(1);
    
    if (!article[0]) return;
    
    // Step 1: Generate summary (for all articles)
    const summary = await this.generateSummary(article[0]);
    
    // Step 2: Check if cybersecurity related
    const cybersecurityAnalysis = await this.analyzeCybersecurity(article[0]);
    
    // Step 3: If cybersecurity, calculate risk score
    let securityScore = null;
    let threatCategories = null;
    
    if (cybersecurityAnalysis.isCybersecurity) {
      const riskAnalysis = await this.calculateSecurityRisk(article[0]);
      securityScore = riskAnalysis.score;
      threatCategories = riskAnalysis.categories;
    }
    
    // Update article with analysis results
    await db.update(globalArticles)
      .set({
        summary,
        isCybersecurity: cybersecurityAnalysis.isCybersecurity,
        securityScore,
        threatCategories,
        lastAnalyzedAt: new Date(),
        analysisVersion: 'v1.0'
      })
      .where(eq(globalArticles.id, articleId));
  }
  
  private async analyzeCybersecurity(article: Article): Promise<{
    isCybersecurity: boolean;
    confidence: number;
    indicators: string[];
  }> {
    const prompt = `
      Analyze if this article is related to cybersecurity, IT vulnerabilities, or threats.
      
      Title: ${article.title}
      Content: ${article.content.substring(0, 2000)}
      
      Return JSON with:
      - isCybersecurity: boolean
      - confidence: 0-100
      - indicators: array of keywords/phrases that indicate cybersecurity relevance
    `;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
  
  private async calculateSecurityRisk(article: Article): Promise<{
    score: number;
    categories: object;
    severity: string;
  }> {
    const prompt = `
      Calculate security risk score for this cybersecurity article.
      
      Title: ${article.title}
      Content: ${article.content.substring(0, 3000)}
      
      Return JSON with:
      - score: 0-100 (0=low risk, 100=critical)
      - categories: {
          malware: boolean,
          ransomware: boolean,
          dataBrearch: boolean,
          zeroDay: boolean,
          supplyChain: boolean,
          other: string[]
        }
      - severity: "low" | "medium" | "high" | "critical"
      
      Consider factors like:
      - Exploit availability
      - Affected systems scope
      - Potential impact
      - Active exploitation status
    `;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
}
```

### 2.3 Query-Time Filtering Implementation

#### New Article Retrieval Service
```typescript
// backend/services/article-query/filter.ts
export class ArticleFilterService {
  async getArticlesForUser(
    userId: string,
    appContext: 'news_radar' | 'threat_tracker',
    options: {
      page?: number;
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ) {
    // Step 1: Get user's enabled sources for this app
    const userSources = await db.select()
      .from(userSourcePreferences)
      .where(
        and(
          eq(userSourcePreferences.userId, userId),
          eq(userSourcePreferences.appContext, appContext),
          eq(userSourcePreferences.isEnabled, true)
        )
      );
    
    const sourceIds = userSources.map(s => s.sourceId);
    
    // Step 2: Get user's active keywords for this app
    const userKeywords = await db.select()
      .from(userKeywords)
      .where(
        and(
          eq(userKeywords.userId, userId),
          eq(userKeywords.appContext, appContext),
          eq(userKeywords.isActive, true)
        )
      );
    
    const keywords = userKeywords.map(k => k.term.toLowerCase());
    
    // Step 3: Build query with filters
    let query = db.select().from(globalArticles);
    
    // Filter by sources
    if (sourceIds.length > 0) {
      query = query.where(inArray(globalArticles.sourceId, sourceIds));
    }
    
    // App-specific filtering
    if (appContext === 'threat_tracker') {
      // Only show cybersecurity articles in Threat Tracker
      query = query.where(eq(globalArticles.isCybersecurity, true));
    }
    
    // Date range filtering
    if (options.dateFrom) {
      query = query.where(gte(globalArticles.publishDate, options.dateFrom));
    }
    if (options.dateTo) {
      query = query.where(lte(globalArticles.publishDate, options.dateTo));
    }
    
    // Order by publish date
    query = query.orderBy(desc(globalArticles.publishDate));
    
    // Pagination
    const page = options.page || 1;
    const limit = options.limit || 50;
    query = query.limit(limit).offset((page - 1) * limit);
    
    // Execute query
    const articles = await query;
    
    // Step 4: Apply keyword filtering (in memory for now, can optimize later)
    if (keywords.length > 0) {
      return articles.filter(article => {
        const searchText = `${article.title} ${article.content}`.toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword));
      });
    }
    
    return articles;
  }
  
  // Optimized version using full-text search
  async getArticlesWithFullTextSearch(
    userId: string,
    appContext: string,
    searchTerms: string[]
  ) {
    const userSources = await this.getUserEnabledSources(userId, appContext);
    
    // Use PostgreSQL full-text search
    const query = sql`
      SELECT * FROM global_articles
      WHERE source_id = ANY(${userSources})
        ${appContext === 'threat_tracker' ? sql`AND is_cybersecurity = true` : sql``}
        AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', ${searchTerms.join(' | ')})
      ORDER BY publish_date DESC
      LIMIT 100
    `;
    
    return await db.execute(query);
  }
}
```

---

## Phase 3: API Endpoint Updates
**Timeline: Week 3-4**

### 3.1 Modified Endpoints

#### Articles Endpoints
```typescript
// backend/apps/news-radar/router/articles.ts

// BEFORE: Get user-specific articles
router.get('/articles', async (req, res) => {
  const userId = req.user.id;
  const articles = await storage.getArticles(userId);
  res.json(articles);
});

// AFTER: Get filtered articles from global pool
router.get('/articles', async (req, res) => {
  const userId = req.user.id;
  const { page, limit, dateFrom, dateTo } = req.query;
  
  const articles = await articleFilterService.getArticlesForUser(
    userId,
    'news_radar', // App context
    { page, limit, dateFrom, dateTo }
  );
  
  res.json({
    articles,
    pagination: {
      page,
      limit,
      total: await articleFilterService.countArticles(userId, 'news_radar')
    }
  });
});
```

#### Sources Endpoints
```typescript
// BEFORE: Users can add sources
router.post('/sources', async (req, res) => {
  const source = await storage.createSource(req.body);
  res.json(source);
});

// AFTER: Users can only enable/disable existing sources
router.get('/sources/available', async (req, res) => {
  // Get all global sources
  const allSources = await db.select().from(globalSources);
  
  // Get user's preferences
  const userPrefs = await db.select()
    .from(userSourcePreferences)
    .where(
      and(
        eq(userSourcePreferences.userId, req.user.id),
        eq(userSourcePreferences.appContext, req.query.appContext)
      )
    );
  
  // Combine data
  const sources = allSources.map(source => ({
    ...source,
    isEnabled: userPrefs.find(p => p.sourceId === source.id)?.isEnabled ?? false
  }));
  
  res.json(sources);
});

router.put('/sources/:id/toggle', async (req, res) => {
  const { appContext, isEnabled } = req.body;
  
  await db.insert(userSourcePreferences)
    .values({
      userId: req.user.id,
      sourceId: req.params.id,
      appContext,
      isEnabled
    })
    .onConflictDoUpdate({
      target: ['userId', 'sourceId', 'appContext'],
      set: { isEnabled, enabledAt: new Date() }
    });
  
  res.json({ success: true });
});

// Remove add/delete endpoints
// router.post('/sources', ...) - REMOVED
// router.delete('/sources/:id', ...) - REMOVED
```

#### Keywords Endpoints
```typescript
// Keywords remain user-specific but change in function
router.post('/keywords', async (req, res) => {
  const { term, appContext } = req.body;
  
  const keyword = await db.insert(userKeywords)
    .values({
      userId: req.user.id,
      appContext,
      term,
      isActive: true
    })
    .returning();
  
  res.json(keyword);
});

// Toggle keyword active status
router.put('/keywords/:id/toggle', async (req, res) => {
  await db.update(userKeywords)
    .set({ isActive: req.body.isActive })
    .where(
      and(
        eq(userKeywords.id, req.params.id),
        eq(userKeywords.userId, req.user.id)
      )
    );
  
  res.json({ success: true });
});
```

### 3.2 New Admin Endpoints

```typescript
// backend/apps/admin/router/sources.ts

// Admin endpoint to add new global sources
router.post('/admin/sources', requireAdmin, async (req, res) => {
  const { url, name, category, priority } = req.body;
  
  const source = await db.insert(globalSources)
    .values({
      url,
      name,
      category,
      priority: priority || 50,
      isActive: true,
      addedBy: req.user.id
    })
    .returning();
  
  res.json(source);
});

// Admin endpoint to manage global scraping
router.post('/admin/scraping/trigger', requireAdmin, async (req, res) => {
  await globalScrapingScheduler.runGlobalScrape();
  res.json({ message: 'Global scraping initiated' });
});

router.get('/admin/scraping/stats', requireAdmin, async (req, res) => {
  const stats = await db.select({
    totalArticles: count(globalArticles.id),
    cybersecurityArticles: count(
      case(when(globalArticles.isCybersecurity, 1))
    ),
    last24Hours: count(
      case(when(
        gte(globalArticles.scrapedAt, sql`NOW() - INTERVAL '24 hours'`),
        1
      ))
    )
  }).from(globalArticles);
  
  res.json(stats);
});
```

---

## Phase 4: Frontend Updates
**Timeline: Week 4**

### 4.1 Source Management UI Changes

```typescript
// frontend/src/pages/dashboard/SourceManager.tsx

// BEFORE: Add source button and form
const SourceManager = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  
  return (
    <div>
      <Button onClick={() => setShowAddForm(true)}>Add Source</Button>
      {showAddForm && <AddSourceForm />}
      <SourceList />
    </div>
  );
};

// AFTER: Toggle sources only
const SourceManager = () => {
  const { data: sources } = useQuery({
    queryKey: ['sources', 'available'],
    queryFn: () => api.get('/sources/available')
  });
  
  const toggleSource = useMutation({
    mutationFn: ({ sourceId, isEnabled }) => 
      api.put(`/sources/${sourceId}/toggle`, { 
        appContext: getCurrentApp(),
        isEnabled 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      queryClient.invalidateQueries(['articles']);
    }
  });
  
  return (
    <div className="space-y-4">
      <h2>Available News Sources</h2>
      <p className="text-muted">
        Enable or disable sources to customize your news feed
      </p>
      
      <div className="grid gap-2">
        {sources?.map(source => (
          <div key={source.id} className="flex items-center justify-between p-3 border rounded">
            <div>
              <h3>{source.name}</h3>
              <p className="text-sm text-muted">{source.url}</p>
            </div>
            <Switch
              checked={source.isEnabled}
              onCheckedChange={(checked) => 
                toggleSource.mutate({ 
                  sourceId: source.id, 
                  isEnabled: checked 
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 4.2 Article Display with Real-time Filtering

```typescript
// frontend/src/components/ArticleList.tsx

const ArticleList = () => {
  const [filters, setFilters] = useState({
    keywords: [],
    sources: [],
    dateRange: null
  });
  
  // Articles are now filtered server-side based on user preferences
  const { data, isLoading } = useQuery({
    queryKey: ['articles', filters],
    queryFn: () => api.get('/articles', { params: filters })
  });
  
  // Keywords are used for client-side highlighting
  const userKeywords = useQuery({
    queryKey: ['keywords', getCurrentApp()],
    queryFn: () => api.get('/keywords')
  });
  
  const highlightKeywords = (text: string) => {
    if (!userKeywords.data) return text;
    
    const keywords = userKeywords.data
      .filter(k => k.isActive)
      .map(k => k.term);
    
    // Highlight matching keywords in the text
    let highlighted = text;
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
  };
  
  return (
    <div>
      <FilterBar onFilterChange={setFilters} />
      
      {isLoading ? (
        <Skeleton />
      ) : (
        <div className="space-y-4">
          {data?.articles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              highlightedTitle={highlightKeywords(article.title)}
              showSecurityScore={getCurrentApp() === 'threat_tracker'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

### 4.3 App Context Switching

```typescript
// frontend/src/context/AppContext.tsx

const AppContext = createContext<{
  currentApp: 'news_radar' | 'threat_tracker';
  switchApp: (app: string) => void;
}>(null);

export const AppProvider = ({ children }) => {
  const [currentApp, setCurrentApp] = useState('news_radar');
  
  // Switching apps changes the filtering context
  const switchApp = (app: string) => {
    setCurrentApp(app);
    // Invalidate queries to refetch with new context
    queryClient.invalidateQueries(['articles']);
    queryClient.invalidateQueries(['sources']);
    queryClient.invalidateQueries(['keywords']);
  };
  
  return (
    <AppContext.Provider value={{ currentApp, switchApp }}>
      {children}
    </AppContext.Provider>
  );
};
```

---

## Phase 5: Migration Execution
**Timeline: Week 5**

### 5.1 Migration Steps

```bash
# Step 1: Deploy database changes
npm run migration:create-global-tables
npm run migration:run

# Step 2: Start data migration (can run in background)
npm run migration:migrate-articles
npm run migration:migrate-sources
npm run migration:create-user-preferences

# Step 3: Deploy backend changes with feature flags
ENABLE_GLOBAL_SCRAPING=false npm run deploy:backend

# Step 4: Test global scraping in staging
npm run test:global-scraping

# Step 5: Enable global scraping
ENABLE_GLOBAL_SCRAPING=true npm run deploy:backend

# Step 6: Deploy frontend changes
npm run deploy:frontend

# Step 7: Monitor and validate
npm run monitor:migration
```

### 5.2 Rollback Plan

```typescript
// Rollback procedures if issues arise
export class MigrationRollback {
  async rollbackToUserSpecific() {
    // 1. Stop global scraping
    await globalScrapingScheduler.stop();
    
    // 2. Re-enable user-specific endpoints
    await featureFlags.enable('USER_SPECIFIC_SCRAPING');
    
    // 3. Restore user-specific data relationships
    // Articles still exist, just need to restore userId associations
    await db.execute(sql`
      UPDATE articles a
      SET user_id = usp.user_id
      FROM user_source_preferences usp
      WHERE a.source_id = usp.source_id
    `);
    
    // 4. Re-enable user-specific schedulers
    await userSchedulers.reinitialize();
  }
}
```

---

## Performance Considerations

### Database Optimization
1. **Partitioning**: Partition articles table by month for better query performance
2. **Connection Pooling**: Optimize database connection pool settings

### Query Optimization
```sql
-- Example: Optimized query for filtered articles
EXPLAIN ANALYZE
SELECT a.*, s.name as source_name
FROM global_articles a
JOIN global_sources s ON a.source_id = s.id
WHERE a.source_id = ANY(ARRAY[/* user's enabled sources */])
  AND a.publish_date > NOW() - INTERVAL '7 days'
  AND to_tsvector('english', a.title || ' ' || a.content) @@ to_tsquery('english', 'keyword1 | keyword2')
ORDER BY a.publish_date DESC
LIMIT 50;
```

---

## Monitoring & Success Metrics

### Key Performance Indicators
1. **Scraping Metrics**
   - Articles scraped per hour
   - Source success rate
   - AI processing queue depth
   - Average processing time per article

2. **User Experience Metrics**
   - Article retrieval latency
   - Filter application speed
   - Page load times
   - User engagement rates

3. **System Health Metrics**
   - Database query performance
   - API response times
   - Error rates
   - Memory usage

### Monitoring Implementation
```typescript
// Metrics collection
const metrics = {
  scrapingRuns: new Counter('scraping_runs_total'),
  articlesScraped: new Counter('articles_scraped_total'),
  aiProcessingTime: new Histogram('ai_processing_duration_seconds'),
  queryLatency: new Histogram('query_latency_seconds')
};

// Log metrics during operations
async function scrapeWithMetrics(source: Source) {
  const timer = metrics.aiProcessingTime.startTimer();
  try {
    const result = await scrapeSource(source);
    metrics.articlesScraped.inc(result.articles);
    return result;
  } finally {
    timer();
  }
}
```

---

## Risk Mitigation

### Identified Risks & Mitigation Strategies

1. **Data Loss Risk**
   - Mitigation: Complete backup before migration
   - Parallel run of old and new systems during transition

2. **Performance Degradation**
   - Mitigation: Database query optimization
   - Consider read replicas for heavy read operations
   - Caching layer to be implemented in future phase

3. **AI Processing Bottleneck**
   - Mitigation: Queue-based processing with rate limiting
   - Implement retry logic with exponential backoff
   - Consider multiple AI provider fallbacks

4. **User Confusion**
   - Mitigation: Clear communication about changes
   - Gradual UI updates with tooltips
   - Maintain familiar interface patterns

---

## Timeline Summary

| Week | Phase | Activities |
|------|-------|------------|
| 1-2 | Database | Schema design, migration scripts, testing |
| 2-3 | Backend | Global scraping service, AI pipeline |
| 3-4 | API | Endpoint updates, admin tools |
| 4 | Frontend | UI updates, filtering implementation |
| 5 | Migration | Deployment, monitoring, validation |

Total estimated time: **5 weeks**

---

## Conclusion

This re-architecture plan transforms the application from user-specific to global scraping while maintaining all existing capabilities. The key benefits include:

1. **Efficiency**: Single global scraping job vs multiple user-specific jobs
2. **Data Richness**: All articles available for analysis and filtering
3. **Scalability**: Better resource utilization and performance
4. **Flexibility**: Users can discover content beyond their initial keywords
5. **Intelligence**: AI-powered categorization and risk scoring

The plan ensures minimal disruption during migration with comprehensive rollback procedures and maintains all existing scraping capabilities while significantly improving the system's architecture.