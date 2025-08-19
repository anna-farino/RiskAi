# Web Intelligence Platform Re-Architecture Plan
## From User-Specific to Global Shared Scraping Infrastructure

### Executive Summary
This plan outlines the transformation of our current user-specific article scraping system into a global, shared infrastructure that collects all articles and allows users to filter them at query time. 

**Key Approach: Modify existing files, NOT create new ones**
- We will modify existing scraping services in-place
- Only remove userID and keyword constraints from scraping logic
- Keep ALL other scraping functionality exactly as-is (bot detection, extraction, error handling)
- No backwards compatibility concerns - direct migration to new system

---

## Summary of File Modifications

### Files to Modify (NOT create new):
1. **Scraping Services**
   - `backend/apps/news-radar/scraper.ts` - Remove userId, keywords
   - `backend/apps/threat-tracker/scraper.ts` - Remove userId, keywords  
   - `backend/services/scraping/*` - Remove userId, keywords
   - `backend/apps/*/scheduler.ts` - Change to global 3-hour schedule

2. **Database Queries**
   - `backend/apps/news-radar/queries/*` - Update to use global tables
   - `backend/apps/threat-tracker/queries/*` - Update to use global tables
   - `backend/storage.ts` - Update to use global tables

3. **API Routes**
   - `backend/apps/news-radar/router/*` - Update for filtering
   - `backend/apps/threat-tracker/router/*` - Update for filtering

4. **OpenAI Services**
   - `backend/services/openai.ts` - Add cybersecurity detection methods
   - `backend/apps/*/openai.ts` - Add security scoring methods

### What Stays EXACTLY the Same:
- All bot detection and bypass mechanisms
- All content extraction logic
- All error handling and logging
- All scraping strategies (Puppeteer, CycleTLS, HTTP)
- All URL pattern detection
- All date extraction logic
- All existing OpenAI prompts (just add new ones)

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

## Phase 2: Backend Service Modifications
**Timeline: Week 2-3**

### 2.1 Modify Existing Scraping Services

#### Combine Existing Schedulers (NOT create new ones)
```typescript
// MODIFY: backend/apps/news-radar/scheduler.ts
// MODIFY: backend/apps/threat-tracker/scheduler.ts
// Combine into single global scheduler that runs every 3 hours

export class ScrapingScheduler {
  private job: cron.ScheduledTask;
  private isRunning = false;
  
  async initialize() {
    // Change from user-specific to global schedule
    // Run every 3 hours instead of user-defined intervals
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
      // Get all active sources from global table
      const sources = await db.select()
        .from(globalSources)
        .where(eq(globalSources.isActive, true))
        .orderBy(desc(globalSources.priority));
      
      // Use existing scraping logic with minimal changes
      for (const source of sources) {
        await this.scrapeSource(source);
      }
      
      // Log statistics (existing logging logic)
      const stats = {
        duration: Date.now() - startTime,
        sourcesProcessed: sources.length
      };
      
      console.log('Global scraping completed', stats);
      
    } finally {
      this.isRunning = false;
    }
  }
}
```

#### Modify Existing Scraper Files
```typescript
// MODIFY: backend/apps/news-radar/scraper.ts
// MODIFY: backend/apps/threat-tracker/scraper.ts
// MODIFY: backend/services/scraping/*

// Changes to make in existing scraper files:
// 1. REMOVE: userId parameter from all scraping functions
// 2. REMOVE: Keyword filtering logic during scraping
// 3. REMOVE: User-specific article saving
// 4. KEEP: All bot detection bypass logic
// 5. KEEP: All content extraction logic
// 6. KEEP: All error handling
// 7. KEEP: All scraping strategies (Puppeteer, CycleTLS, HTTP)

// Example of changes in existing scraper:
export async function scrapeSource(source: GlobalSource) {
  // REMOVE THIS:
  // const keywords = await getUserKeywords(userId);
  // const relevantArticles = filterByKeywords(articles, keywords);
  
  // KEEP ALL OF THIS:
  const articleLinks = await extractArticleLinks(source.url);
  const articles = await scrapeArticles(articleLinks);
  
  // CHANGE: Save to global table instead of user-specific
  for (const article of articles) {
    await db.insert(globalArticles).values({
      ...article,
      sourceId: source.id,
      // No userId field
    });
  }
}
```

### 2.2 AI Processing Pipeline

#### Modify Existing OpenAI Service
```typescript
// MODIFY: backend/services/openai.ts
// MODIFY: backend/apps/news-radar/openai.ts
// MODIFY: backend/apps/threat-tracker/openai.ts

// Add new analysis functions to existing OpenAI service
export class OpenAIService {
  // KEEP: All existing functionality
  // ADD: New cybersecurity detection methods
  
  // ADD: New method to check if article is cybersecurity related
  async analyzeCybersecurity(article: GlobalArticle): Promise<{
    isCybersecurity: boolean;
    confidence: number;
  }> {
    // Use existing OpenAI configuration and methods
    // Just add new prompt for cybersecurity detection
    const prompt = `Analyze if this is cybersecurity related...`;
    return await this.callOpenAI(prompt);
  }
  
  // ADD: Security risk scoring for cybersecurity articles
  async calculateSecurityRisk(article: GlobalArticle): Promise<{
    score: number;
    categories: object;
  }> {
    // Use existing OpenAI infrastructure
    const prompt = `Calculate security risk score...`;
    return await this.callOpenAI(prompt);
}
```

### 2.3 Query-Time Filtering Implementation

#### Modify Existing Storage/Query Services
```typescript
// MODIFY: backend/apps/news-radar/queries/news-tracker/*.ts
// MODIFY: backend/apps/threat-tracker/queries/threat-tracker/*.ts
// MODIFY: backend/storage.ts (if using storage pattern)

// Update existing query functions to filter from global tables
export class ArticleQueryService {
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

### Overview of Frontend Changes

The frontend updates will modify existing pages in each app (News Radar, Threat Tracker, News Capsule) to work with the new global scraping system. The key principle is **minimal visual disruption** - users should see familiar interfaces with enhanced capabilities.

### 4.1 Source Management UI Changes

#### Files to Modify:
- `frontend/src/pages/dashboard/news-radar/sources.tsx`
- `frontend/src/pages/dashboard/threat-tracker/sources.tsx`

#### Key Changes:

**REMOVE these features:**
```typescript
// Remove ability to add new sources
const addSource = useMutation({...}) // DELETE THIS

// Remove source editing
const editSource = useMutation({...}) // DELETE THIS  

// Remove source deletion
const deleteSource = useMutation({...}) // DELETE THIS

// Remove individual source scraping
const scrapeSource = useMutation({...}) // DELETE THIS

// Remove Add Source form UI
<Dialog>
  <DialogTrigger><Plus /> Add Source</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog> // DELETE THIS SECTION

// Remove Edit/Delete buttons in source list
<Button onClick={() => editSource(id)}>Edit</Button> // DELETE
<Button onClick={() => deleteSource(id)}>Delete</Button> // DELETE
```

**ADD these features:**
```typescript
// New endpoint to get all global sources with user preferences
const sources = useQuery({
  queryKey: ['/api/news-tracker/sources/available', appContext],
  queryFn: async () => {
    const response = await fetchWithAuth('/api/news-tracker/sources/available?app=' + appContext);
    return response.json();
    // Returns: { id, name, url, category, articleCount, lastScraped, isEnabled }
  }
});

// Toggle source on/off for current app
const toggleSource = useMutation({
  mutationFn: async ({ sourceId, isEnabled }) => {
    return fetchWithAuth(`/api/news-tracker/sources/${sourceId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ 
        appContext: 'news_radar', // or 'threat_tracker'
        isEnabled 
      })
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['articles']);
  }
});

// Update the source display to group by category
const sourcesByCategory = useMemo(() => {
  return sources.data?.reduce((acc, source) => {
    const category = source.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(source);
    return acc;
  }, {});
}, [sources.data]);

// New UI showing toggleable sources grouped by category
return (
  <div>
    <Card>
      <CardHeader>
        <CardTitle>Available News Sources</CardTitle>
        <CardDescription>
          Enable or disable sources to customize your news feed.
          Articles are collected automatically every 3 hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {Object.entries(sourcesByCategory).map(([category, sources]) => (
          <div key={category}>
            <h3 className="font-semibold mb-2">{category}</h3>
            <div className="space-y-2 mb-4">
              {sources.map(source => (
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{source.name}</div>
                    <div className="text-sm text-muted">{source.url}</div>
                    <div className="text-xs text-muted mt-1">
                      {source.articleCount} articles • Last updated {source.lastScraped}
                    </div>
                  </div>
                  <Switch
                    checked={source.isEnabled}
                    onCheckedChange={(checked) => 
                      toggleSource.mutate({ sourceId: source.id, isEnabled: checked })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    
    {/* Remove the auto-scrape settings section - it's now global */}
  </div>
);
```

### 4.2 Keywords Management Updates

#### Files to Modify:
- `frontend/src/pages/dashboard/news-radar/keywords.tsx`
- `frontend/src/pages/dashboard/threat-tracker/keywords.tsx`

#### Key Changes:

Keywords remain user-specific but their purpose changes from triggering scraping to filtering/highlighting articles.

**UPDATE the UI messaging:**
```typescript
// Change the page description
<CardDescription>
  {/* OLD: "Add keywords to track specific topics in your news sources" */}
  NEW: "Add keywords to filter and highlight articles from the global news pool"
</CardDescription>

// Add informational banner explaining the new behavior
<Alert className="mb-4">
  <Info className="h-4 w-4" />
  <AlertTitle>How Keywords Work</AlertTitle>
  <AlertDescription>
    Keywords help you filter and discover relevant articles from all available sources.
    Articles containing your keywords will be highlighted for easy identification.
    The system automatically collects all articles - keywords help you find what matters to you.
  </AlertDescription>
</Alert>

// Keep existing add/delete/toggle functionality but update tooltips
<HelpCircle className="h-4 w-4" />
<span className="text-sm text-muted">
  Keywords filter articles in real-time. Active keywords are highlighted in article text.
</span>

// Show keyword match statistics
{keywords.data?.map(keyword => (
  <div className="flex items-center justify-between">
    <div>
      <span>{keyword.term}</span>
      <Badge variant="secondary" className="ml-2">
        {keyword.matchCount || 0} matches today
      </Badge>
    </div>
    <Switch checked={keyword.active} />
  </div>
))}
```

### 4.3 Article List (Home) Pages Updates

#### Files to Modify:
- `frontend/src/pages/dashboard/news-radar/home.tsx`
- `frontend/src/pages/dashboard/threat-tracker/home.tsx`

#### Key Principle: **Minimal Visual Changes**
The article display should look virtually identical to users, but data comes from filtered global pool instead of user-specific scraping.

**UPDATE data fetching:**
```typescript
// OLD: Fetch user-specific articles
const articles = useQuery({
  queryKey: ["/api/news-tracker/articles"],
  queryFn: () => fetchWithAuth("/api/news-tracker/articles")
});

// NEW: Fetch filtered articles from global pool
const articles = useQuery({
  queryKey: ["/api/news-tracker/articles", { 
    page: currentPage,
    search: searchTerm,
    keywords: selectedKeywordIds,
    dateFrom: dateRange.startDate,
    dateTo: dateRange.endDate
  }],
  queryFn: async () => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: articlesPerPage.toString(),
      ...(searchTerm && { search: searchTerm }),
      ...(selectedKeywordIds.length && { keywords: selectedKeywordIds.join(',') }),
      ...(dateRange.startDate && { dateFrom: dateRange.startDate.toISOString() }),
      ...(dateRange.endDate && { dateTo: dateRange.endDate.toISOString() })
    });
    
    const response = await fetchWithAuth(`/api/news-tracker/articles?${params}`);
    const data = await response.json();
    return {
      articles: data.articles,
      total: data.total,
      filtered: data.filtered
    };
  }
});

// ADD article count indicators
<div className="flex items-center justify-between mb-4">
  <h2 className="text-2xl font-bold">Articles</h2>
  <div className="text-sm text-muted">
    Showing {articles.data?.filtered || 0} of {articles.data?.total || 0} available articles
  </div>
</div>

// Remove "Scan All Sources" button - it's automatic now
// DELETE: <Button onClick={scanAllSources}><Play /> Scan All Sources</Button>

// Update the auto-scrape status to show global scraping status
<Badge variant={autoScrapeStatus.data?.running ? "default" : "secondary"}>
  {autoScrapeStatus.data?.running 
    ? "Global scraping in progress..." 
    : `Next scrape: ${autoScrapeStatus.data?.nextRun || 'in 3 hours'}`}
</Badge>
```

**For Threat Tracker specifically, ADD security indicators:**
```typescript
// In threat-tracker/home.tsx, update ThreatArticleCard component usage
<ThreatArticleCard
  article={article}
  // NEW: Show security score if available
  showSecurityScore={true}
  securityScore={article.securityScore}
  threatCategories={article.threatCategories}
/>

// Add security score badge to ThreatArticleCard component
{showSecurityScore && article.securityScore && (
  <Badge 
    variant={
      article.securityScore > 75 ? "destructive" :
      article.securityScore > 50 ? "warning" :
      article.securityScore > 25 ? "secondary" :
      "default"
    }
  >
    Risk: {article.securityScore}/100
  </Badge>
)}

// Add threat category tags
{article.threatCategories && (
  <div className="flex flex-wrap gap-1 mt-2">
    {Object.entries(article.threatCategories)
      .filter(([_, value]) => value)
      .map(([category]) => (
        <Badge key={category} variant="outline" className="text-xs">
          {category}
        </Badge>
      ))
    }
  </div>
)}
```

### 4.4 News Capsule Application Updates

#### Files to Modify:
- `frontend/src/pages/dashboard/news-capsule/research.tsx`
- `frontend/src/pages/dashboard/news-capsule/reports.tsx`

News Capsule pulls articles from both News Radar and Threat Tracker, so it needs to work with the new global system.

**UPDATE research page to pull from global articles:**
```typescript
// In news-capsule/research.tsx
// Update the article fetching to pull from global pool
const fetchArticlesForResearch = async () => {
  // Get articles from both news and threat contexts
  const newsArticles = await fetchWithAuth('/api/news-tracker/articles?limit=100');
  const threatArticles = await fetchWithAuth('/api/threat-tracker/articles?limit=100');
  
  // Combine and deduplicate
  const allArticles = [...newsArticles.articles, ...threatArticles.articles];
  const uniqueArticles = Array.from(
    new Map(allArticles.map(a => [a.globalId || a.id, a])).values()
  );
  
  return uniqueArticles;
};
```

### 4.5 Component Updates

#### ArticleCard Component Updates
```typescript
// Update frontend/src/components/ui/article-card.tsx
// Add keyword highlighting functionality

interface ArticleCardProps {
  article: Article;
  keywords?: string[];
  showHighlight?: boolean;
  showStats?: boolean;
}

const highlightText = (text: string, keywords: string[]) => {
  if (!keywords?.length) return text;
  
  let highlighted = text;
  keywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  });
  return highlighted;
};

// In the component render
<CardTitle>
  {showHighlight 
    ? <span dangerouslySetInnerHTML={{ __html: highlightText(article.title, keywords) }} />
    : article.title
  }
</CardTitle>
```

### 4.6 State Management Updates

No major changes needed to Zustand stores, but update types to reflect new data structure:

```typescript
// Update types in store if needed
interface ArticleStore {
  articles: GlobalArticle[]; // Changed from Article[]
  totalCount: number;
  filteredCount: number;
  lastGlobalScrapeTime: Date | null;
}
```

### 4.7 Summary of Frontend Phase Changes

#### What Users Will Notice:
1. **Sources Page**: Can only enable/disable sources (no add/edit/delete)
2. **Keywords Page**: Same functionality but new explanation of filtering vs scraping
3. **Article Lists**: Virtually identical but shows "X of Y articles" indicator
4. **Performance**: Potentially faster as no individual scraping needed
5. **Threat Tracker**: New security scores and threat category badges

#### What Users Won't Notice:
1. Data comes from global pool instead of user-specific tables
2. Filtering happens server-side with user preferences
3. Articles are pre-analyzed by AI
4. No more per-user scraping jobs

#### Migration Messaging:
Add a one-time banner after deployment:
```typescript
// Add to Dashboard.tsx or app root
{showMigrationNotice && (
  <Alert className="mb-4">
    <Info className="h-4 w-4" />
    <AlertTitle>System Upgraded!</AlertTitle>
    <AlertDescription>
      We've upgraded to a more powerful article collection system. 
      All sources now update automatically every 3 hours with AI-powered analysis.
      Your keywords now help filter and highlight relevant content from a much larger pool of articles.
      <Button size="sm" variant="ghost" onClick={() => setShowMigrationNotice(false)}>
        Got it
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

### 4.8 Testing Checklist for Frontend

Before marking Phase 4 complete, verify:

- [ ] Source toggles work correctly per app context
- [ ] Keywords filter articles in real-time
- [ ] Article counts show filtered vs total
- [ ] Pagination works with new data structure  
- [ ] Search functionality works across global articles
- [ ] Threat Tracker shows security scores
- [ ] News Capsule can access articles from both apps
- [ ] No "Add Source" functionality remains
- [ ] Auto-scrape controls are removed
- [ ] Global scrape status shows correctly

---
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