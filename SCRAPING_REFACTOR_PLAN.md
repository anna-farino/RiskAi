# Centralized Scraping System Refactoring Plan

## Executive Summary

This document outlines the complete refactoring plan to centralize and componentize the scraping functionality across News Radar, Threat Tracker, and News Capsule applications. The refactoring will create a unified scraping system that eliminates code duplication while maintaining each app's unique functionality and requirements.

## Goals and Requirements

### Primary Goals
1. **Componentization**: Break scraping system into small, focused files with minimal functions each
2. **Unified Bot Protection**: Centralize advanced Cloudflare and DataDome bypass capabilities
3. **Shared Link Extraction**: Common article link identification across all apps
4. **Shared Content Extraction**: Unified article content scraping methods
5. **Dynamic Content Support**: Maintain HTMX and JavaScript-heavy site capabilities
6. **App-Specific AI**: Preserve unique OpenAI integrations for each app's requirements

### Success Criteria
- Zero functionality loss during migration
- Significant code reduction through deduplication
- Improved maintainability and debugging capabilities
- Enhanced testing coverage through componentization
- Preserved performance characteristics for each app

## Current State Analysis

### Existing Code Locations

#### News Radar
- **Main Scraper**: `backend/apps/news-radar/services/scraper.ts` (410 lines)
- **Puppeteer Handler**: `backend/apps/news-radar/services/puppeteer-scraper.ts` (380 lines)
- **Background Jobs**: `backend/apps/news-radar/services/background-jobs.ts` (290 lines)
- **OpenAI Integration**: `backend/apps/news-radar/services/openai.ts` (180 lines)

#### Threat Tracker
- **Main Scraper**: `backend/apps/threat-tracker/services/scraper.ts` (520 lines)
- **Background Jobs**: `backend/apps/threat-tracker/services/background-jobs.ts` (340 lines)
- **OpenAI Integration**: `backend/apps/threat-tracker/services/openai.ts` (220 lines)
- **Date Extractor**: `backend/apps/threat-tracker/services/date-extractor.ts` (180 lines)

#### News Capsule
- **URL Processor**: `backend/apps/news-capsule/process-url.ts` (180 lines)

### Duplicate Code Identification

#### Browser Management (95% similarity)
- **getBrowser()**: All three apps have nearly identical browser launch configurations
- **setupPage()**: Same viewport, user agent, and header configurations
- **Page timeouts**: Consistent 60-second timeout settings across apps

#### Bot Protection (90% similarity)
- **DataDome detection**: Identical logic in all three apps
- **Cloudflare handling**: Same evasion techniques
- **Human-like actions**: Mouse movements and timing patterns

#### Link Extraction (85% similarity)
- **Cheerio parsing**: Similar DOM traversal patterns
- **URL normalization**: Identical absolute URL creation logic
- **OpenAI integration**: Similar prompt structures for link identification

#### Content Extraction (80% similarity)
- **Selector-based extraction**: Common fallback selector hierarchies
- **Text cleaning**: Identical whitespace and formatting cleanup
- **Error handling**: Similar retry and fallback patterns

## New Architecture Design

### Directory Structure
```
backend/
├── services/
│   └── scraping/
│       ├── core/
│       │   ├── browser-manager.ts        # 50-70 lines
│       │   ├── page-setup.ts             # 80-100 lines
│       │   └── protection-bypass.ts      # 120-150 lines
│       ├── extractors/
│       │   ├── link-extractor.ts         # 100-120 lines
│       │   ├── content-extractor.ts      # 150-180 lines
│       │   └── structure-detector.ts     # 80-100 lines
│       ├── scrapers/
│       │   ├── http-scraper.ts           # 100-120 lines
│       │   ├── puppeteer-scraper.ts      # 180-200 lines
│       │   └── hybrid-scraper.ts         # 120-140 lines
│       ├── processors/
│       │   ├── url-processor.ts          # 60-80 lines
│       │   └── content-processor.ts      # 80-100 lines
│       ├── jobs/
│       │   ├── job-manager.ts            # 100-120 lines
│       │   └── user-job-coordinator.ts   # 80-100 lines
│       └── index.ts                      # 40-60 lines (main orchestrator)
```

### Component Responsibility Matrix

| Component | Functions | Lines | Replaces |
|-----------|-----------|-------|----------|
| `browser-manager.ts` | `getBrowser()`, `closeBrowser()`, `createPage()` | 60 | 3 duplicate implementations |
| `page-setup.ts` | `setupPage()`, `configureHeaders()`, `setTimeouts()` | 90 | 3 duplicate implementations |
| `protection-bypass.ts` | `handleDataDome()`, `handleCloudflare()`, `detectProtection()`, `humanActions()` | 140 | 3 duplicate implementations |
| `link-extractor.ts` | `extractLinks()`, `identifyArticleLinks()`, `filterLinks()` | 110 | 2 duplicate implementations |
| `content-extractor.ts` | `extractContent()`, `applyFallbacks()`, `cleanContent()` | 160 | 3 duplicate implementations |
| `structure-detector.ts` | `detectStructure()`, `validateSelectors()`, `sanitizeSelectors()` | 90 | 2 duplicate implementations |

## Detailed Implementation Plan

### Phase 1: Core Infrastructure Components

#### Step 1: Browser Manager (`core/browser-manager.ts`)

**Purpose**: Centralize browser instance management across all applications

**Functions to Implement**:
```typescript
// Primary browser management
export class BrowserManager {
  private static browser: Browser | null = null;
  private static isShuttingDown: boolean = false;
  
  static async getBrowser(): Promise<Browser>
  static async closeBrowser(): Promise<void>
  static async createPage(): Promise<Page>
  static async healthCheck(): Promise<boolean>
}
```

**Migration Mapping**:
- **Removes**: 3 duplicate `getBrowser()` implementations (85 lines total)
- **Consolidates**: Browser launch arguments from all three apps
- **Adds**: Health monitoring and graceful shutdown capabilities

**Implementation Details**:
```typescript
// Unified browser configuration combining best practices from all apps
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920x1080',
  '--disable-features=site-per-process,AudioServiceOutOfProcess',
  '--disable-blink-features=AutomationControlled',
  // Additional args from Threat Tracker for enhanced stealth
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-gl-drawing-for-tests',
  '--mute-audio',
  '--no-zygote',
  '--no-first-run',
  '--no-default-browser-check'
];
```

#### Step 2: Page Setup (`core/page-setup.ts`)

**Purpose**: Unified page configuration with stealth capabilities

**Functions to Implement**:
```typescript
export async function setupPage(options?: PageSetupOptions): Promise<Page>
export async function configureHeaders(page: Page, customHeaders?: Record<string, string>): Promise<void>
export async function setTimeouts(page: Page, timeouts?: TimeoutConfig): Promise<void>
export function generateUserAgent(variant?: 'chrome' | 'firefox'): string

interface PageSetupOptions {
  viewport?: { width: number; height: number };
  userAgent?: string;
  headers?: Record<string, string>;
  timeouts?: TimeoutConfig;
  stealthMode?: boolean;
}
```

**Migration Mapping**:
- **Removes**: 3 duplicate `setupPage()` implementations (120 lines total)
- **Consolidates**: Header configurations from all apps
- **Standardizes**: Viewport and timeout settings
- **Enhances**: User agent rotation and header randomization

#### Step 3: Protection Bypass (`core/protection-bypass.ts`)

**Purpose**: Advanced bot protection bypass for all major systems

**Functions to Implement**:
```typescript
export async function handleDataDomeChallenge(page: Page): Promise<boolean>
export async function handleCloudflareChallenge(page: Page): Promise<boolean>
export async function detectBotProtection(html: string, response?: Response): Promise<ProtectionInfo>
export async function performHumanLikeActions(page: Page): Promise<void>
export async function bypassIncapsula(page: Page): Promise<boolean>

interface ProtectionInfo {
  hasProtection: boolean;
  type: 'datadome' | 'cloudflare' | 'incapsula' | 'generic' | 'none';
  confidence: number;
  details: string;
}
```

**Migration Mapping**:
- **Removes**: 3 duplicate protection detection implementations (180 lines total)
- **Consolidates**: DataDome handling from News Radar and News Capsule
- **Enhances**: Cloudflare bypass from Threat Tracker
- **Adds**: Incapsula detection and bypass capabilities

### Phase 2: Content Processing Components

#### Step 4: Link Extractor (`extractors/link-extractor.ts`)

**Purpose**: Intelligent article link identification across all site types

**Functions to Implement**:
```typescript
export async function extractArticleLinks(html: string, baseUrl: string, options?: LinkExtractionOptions): Promise<string[]>
export async function identifyArticleLinksWithAI(linkData: LinkData[], context: string): Promise<string[]>
export function filterLinksByPatterns(links: string[], include?: string[], exclude?: string[]): string[]
export function normalizeUrls(links: string[], baseUrl: string): string[]

interface LinkExtractionOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  aiContext?: string;
  maxLinks?: number;
  minimumTextLength?: number;
}
```

**Migration Mapping**:
- **Removes**: Duplicate link extraction from News Radar and Threat Tracker (200 lines total)
- **Consolidates**: Cheerio parsing logic
- **Standardizes**: URL normalization across apps
- **Enhances**: AI prompt optimization for different content types

#### Step 5: Structure Detector (`extractors/structure-detector.ts`)

**Purpose**: Automatic HTML structure detection for content extraction

**Functions to Implement**:
```typescript
export async function detectHtmlStructure(html: string, url: string, context?: string): Promise<ScrapingConfig>
export function validateSelectors(config: ScrapingConfig, html?: string): ValidationResult
export function sanitizeSelector(selector: string): string
export function generateFallbackSelectors(elementType: 'title' | 'content' | 'author' | 'date'): string[]

interface ScrapingConfig {
  titleSelector: string;
  contentSelector: string;
  authorSelector?: string;
  dateSelector?: string;
  articleSelector?: string;
  confidence: number;
  alternatives?: Partial<ScrapingConfig>;
}
```

**Migration Mapping**:
- **Removes**: Duplicate structure detection from News Radar and Threat Tracker (150 lines total)
- **Consolidates**: OpenAI integration for structure detection
- **Standardizes**: Selector sanitization logic
- **Enhances**: Validation and confidence scoring

#### Step 6: Content Extractor (`extractors/content-extractor.ts`)

**Purpose**: Robust content extraction with multiple fallback strategies

**Functions to Implement**:
```typescript
export async function extractArticleContent(html: string, config: ScrapingConfig): Promise<ArticleContent>
export async function extractWithFallbacks(html: string, config: ScrapingConfig): Promise<ArticleContent>
export function cleanAndNormalizeContent(content: string): string
export async function extractPublishDate(html: string, config?: ScrapingConfig): Promise<Date | null>

interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date;
  extractionMethod: string;
  confidence: number;
  rawHtml?: string;
}
```

**Migration Mapping**:
- **Removes**: 3 duplicate content extraction implementations (240 lines total)
- **Consolidates**: Fallback selector hierarchies
- **Integrates**: Date extraction utility from Threat Tracker
- **Standardizes**: Content cleaning and normalization

### Phase 3: Scraping Method Components

#### Step 7: HTTP Scraper (`scrapers/http-scraper.ts`)

**Purpose**: High-performance HTTP-based scraping with intelligent fallback detection

**Functions to Implement**:
```typescript
export async function scrapeWithHTTP(url: string, options?: HTTPScrapingOptions): Promise<ScrapingResult>
export function detectRequiresPuppeteer(html: string, response: Response): boolean
export function generateHeaders(customHeaders?: Record<string, string>): Record<string, string>
export async function handleCookies(response: Response): Promise<void>

interface HTTPScrapingOptions {
  maxRetries?: number;
  timeout?: number;
  customHeaders?: Record<string, string>;
  followRedirects?: boolean;
}
```

**Migration Mapping**:
- **Extracts**: HTTP logic from News Radar (150 lines)
- **Standardizes**: Header generation and cookie handling
- **Enhances**: Retry logic and error handling

#### Step 8: Puppeteer Scraper (`scrapers/puppeteer-scraper.ts`)

**Purpose**: Advanced browser-based scraping for protected and dynamic sites

**Functions to Implement**:
```typescript
export async function scrapeWithPuppeteer(url: string, options?: PuppeteerScrapingOptions): Promise<ScrapingResult>
export async function handleDynamicContent(page: Page): Promise<void>
export async function handleHTMXContent(page: Page): Promise<void>
export async function extractPageContent(page: Page, isArticlePage: boolean): Promise<string>

interface PuppeteerScrapingOptions {
  isArticlePage?: boolean;
  waitForContent?: boolean;
  scrollToLoad?: boolean;
  handleHTMX?: boolean;
  scrapingConfig?: ScrapingConfig;
}
```

**Migration Mapping**:
- **Consolidates**: Puppeteer logic from all three apps (400 lines total)
- **Standardizes**: Dynamic content handling
- **Enhances**: HTMX support from News Radar
- **Integrates**: Article-specific extraction from Threat Tracker

#### Step 9: Hybrid Scraper (`scrapers/hybrid-scraper.ts`)

**Purpose**: Intelligent method selection and orchestration

**Functions to Implement**:
```typescript
export async function scrapeUrl(url: string, options: ScrapingOptions): Promise<ScrapingResult>
export async function determineScrapingMethod(url: string, initialAttempt?: boolean): Promise<'http' | 'puppeteer'>
export async function scrapeWithFallback(url: string, options: ScrapingOptions): Promise<ScrapingResult>

interface ScrapingOptions {
  isSourceUrl: boolean;
  isArticlePage: boolean;
  forceMethod?: 'http' | 'puppeteer';
  scrapingConfig?: ScrapingConfig;
  retryAttempts?: number;
  appContext?: 'news-radar' | 'threat-tracker' | 'news-capsule';
}
```

**Migration Mapping**:
- **Creates**: New intelligent selection logic
- **Integrates**: Decision logic from News Radar
- **Standardizes**: Fallback mechanisms across apps

### Phase 4: Job Management System

#### Step 10: User Job Coordinator (`jobs/user-job-coordinator.ts`)

**Purpose**: Unified job management supporting both global and per-user patterns

**Functions to Implement**:
```typescript
export class UserJobCoordinator {
  // Per-user job management (Threat Tracker pattern)
  static async startUserJob(userId: string, appType: AppType): Promise<JobResult>
  static async stopUserJob(userId: string, appType: AppType): Promise<void>
  static isUserJobRunning(userId: string, appType: AppType): boolean
  
  // Global job management (News Radar pattern)
  static async startGlobalJob(appType: AppType): Promise<JobResult>
  static async stopGlobalJob(appType: AppType): Promise<void>
  static isGlobalJobRunning(appType: AppType): boolean
  
  // Hybrid management
  static async getJobStatus(userId?: string, appType?: AppType): Promise<JobStatus[]>
}

interface JobResult {
  success: boolean;
  message: string;
  processedCount?: number;
  savedCount?: number;
  errors?: string[];
}
```

**Per-User Job Management Implementation**:

The unified system will support both job management patterns through a coordinated approach:

**Global Jobs (News Radar Style)**:
```typescript
// Single global job with user-specific filtering
const globalJobManager = new Map<AppType, GlobalJobState>();

interface GlobalJobState {
  isRunning: boolean;
  startedBy: string;
  startTime: Date;
  currentSource?: string;
  processedSources: number;
  totalSources: number;
}
```

**Per-User Jobs (Threat Tracker Style)**:
```typescript
// Multiple concurrent user jobs
const userJobManager = new Map<string, Map<AppType, UserJobState>>();

interface UserJobState {
  isRunning: boolean;
  startTime: Date;
  currentSource?: string;
  processedSources: number;
  totalSources: number;
}
```

**Coordination Logic**:
1. **Global Jobs**: Only one global job per app type can run
2. **User Jobs**: Multiple user jobs per app type can run simultaneously
3. **Resource Management**: User jobs have priority over global jobs
4. **State Persistence**: Job states survive server restarts

#### Step 11: Job Manager (`jobs/job-manager.ts`)

**Purpose**: Core job execution and monitoring

**Functions to Implement**:
```typescript
export class JobManager {
  static async executeSourceScraping(sources: Source[], userId: string, appType: AppType): Promise<JobResult>
  static async processArticleBatch(articles: string[], config: ScrapingConfig, appType: AppType): Promise<ArticleContent[]>
  static async monitorJobProgress(jobId: string): Promise<JobProgress>
  static async cleanupExpiredJobs(): Promise<void>
}
```

### Phase 5: Main Orchestrator

#### Step 12: Unified Scraping Service (`index.ts`)

**Purpose**: Main entry point providing simplified interface for all apps

**Functions to Implement**:
```typescript
export class UnifiedScrapingService {
  // Source URL processing (returns article links)
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]>
  
  // Article URL processing (returns structured content)
  async scrapeArticleUrl(url: string, config?: ScrapingConfig): Promise<ArticleContent>
  
  // Batch article processing
  async scrapeMultipleArticles(urls: string[], config: ScrapingConfig, options?: BatchOptions): Promise<ArticleContent[]>
  
  // Structure detection
  async detectArticleStructure(url: string, context?: string): Promise<ScrapingConfig>
}

interface SourceScrapingOptions {
  aiContext?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxLinks?: number;
  appType?: AppType;
}

interface BatchOptions {
  concurrency?: number;
  retryFailures?: boolean;
  stopOnError?: boolean;
  progressCallback?: (progress: BatchProgress) => void;
}
```

## App-Specific Integration Plans

### News Radar Migration

#### Current Implementation Analysis
- **Lines of Code**: ~1,260 lines across 4 files
- **Unique Features**: HTTP-first strategy, global job management, email notifications
- **Integration Points**: Background job scheduler, email service, source management

#### Migration Steps

**Step 1: Update Background Jobs** (`backend/apps/news-radar/services/background-jobs.ts`)
```typescript
// Before (290 lines) - After (80 lines)
import { UnifiedScrapingService, UserJobCoordinator } from '../../services/scraping';

const scrapingService = new UnifiedScrapingService();

export async function runGlobalScrapeJob(userId: string): Promise<JobResult> {
  return await UserJobCoordinator.startGlobalJob('news-radar');
}

export async function scrapeSource(sourceId: string): Promise<SourceResult> {
  const source = await storage.getSource(sourceId);
  
  // 1. Extract article links using unified service
  const articleLinks = await scrapingService.scrapeSourceUrl(source.url, {
    aiContext: "news and business articles",
    appType: 'news-radar'
  });
  
  // 2. Process articles with existing News Radar logic
  const results = [];
  for (const link of articleLinks) {
    const content = await scrapingService.scrapeArticleUrl(link, source.scrapingConfig);
    
    // 3. Apply News Radar specific analysis (UNCHANGED)
    const analysis = await analyzeContent(content.content, activeKeywords, content.title);
    
    if (analysis.detectedKeywords.length > 0) {
      const article = await storage.createArticle({
        sourceId,
        userId: source.userId,
        title: content.title,
        content: content.content,
        url: link,
        author: content.author,
        publishDate: content.publishDate || new Date(),
        summary: analysis.summary,
        relevanceScore: analysis.relevanceScore,
        detectedKeywords: analysis.detectedKeywords
      });
      results.push(article);
    }
  }
  
  return { processedCount: articleLinks.length, savedCount: results.length, newArticles: results };
}
```

**Step 2: Simplify Main Scraper** (`backend/apps/news-radar/services/scraper.ts`)
```typescript
// Before (410 lines) - After (60 lines)
import { UnifiedScrapingService } from '../../services/scraping';

// Re-export for backward compatibility
export const scrapeUrl = UnifiedScrapingService.prototype.scrapeSourceUrl;
export const extractArticleContent = UnifiedScrapingService.prototype.scrapeArticleUrl;
export const extractArticleLinks = UnifiedScrapingService.prototype.scrapeSourceUrl;

// Keep News Radar specific functions
export { analyzeContent } from './openai';
export { sendNewArticlesEmail } from './email-service';
```

**Step 3: Remove Duplicate Files**
- **Delete**: `backend/apps/news-radar/services/puppeteer-scraper.ts` (380 lines)
- **Functionality moved to**: `backend/services/scraping/scrapers/puppeteer-scraper.ts`

### Threat Tracker Migration

#### Current Implementation Analysis
- **Lines of Code**: ~1,260 lines across 5 files
- **Unique Features**: Per-user jobs, multi-category validation, security scoring
- **Integration Points**: User job management, keyword categorization, security analysis

#### Migration Steps

**Step 1: Update Background Jobs** (`backend/apps/threat-tracker/services/background-jobs.ts`)
```typescript
// Before (340 lines) - After (100 lines)
import { UnifiedScrapingService, UserJobCoordinator } from '../../services/scraping';

const scrapingService = new UnifiedScrapingService();

export async function runGlobalScrapeJob(userId?: string): Promise<JobResult> {
  if (!userId) throw new Error("User ID required for Threat Tracker jobs");
  return await UserJobCoordinator.startUserJob(userId, 'threat-tracker');
}

export async function scrapeSource(source: ThreatSource, userId: string): Promise<ThreatArticle[]> {
  // 1. Get categorized keywords (UNCHANGED - Threat Tracker specific)
  const keywords = await getKeywordsByCategories(userId);
  
  // 2. Extract article links using unified service
  const articleLinks = await scrapingService.scrapeSourceUrl(source.url, {
    aiContext: "cybersecurity threats and security incidents",
    appType: 'threat-tracker'
  });
  
  // 3. Process articles with Threat Tracker specific logic
  const results = [];
  for (const link of articleLinks) {
    const content = await scrapingService.scrapeArticleUrl(link, source.scrapingConfig);
    
    // 4. Apply Threat Tracker multi-category analysis (UNCHANGED)
    const analysis = await analyzeContent(
      content.content,
      content.title,
      keywords.threats,
      keywords.vendors,
      keywords.clients,
      keywords.hardware
    );
    
    if (analysis.meetsCriteria) {
      const article = await storage.createArticle({
        sourceId: source.id,
        title: content.title,
        content: content.content,
        url: link,
        author: content.author,
        publishDate: content.publishDate,
        summary: analysis.summary,
        relevanceScore: analysis.relevanceScore,
        securityScore: analysis.severityScore,
        detectedKeywords: analysis.detectedKeywords,
        userId
      });
      results.push(article);
    }
  }
  
  return results;
}
```

**Step 2: Simplify Main Scraper** (`backend/apps/threat-tracker/services/scraper.ts`)
```typescript
// Before (520 lines) - After (80 lines)
import { UnifiedScrapingService } from '../../services/scraping';

// Re-export for backward compatibility
export const scrapeUrl = UnifiedScrapingService.prototype.scrapeArticleUrl;
export const extractArticleContent = UnifiedScrapingService.prototype.scrapeArticleUrl;

// Keep Threat Tracker specific functions (UNCHANGED)
export { analyzeContent } from './openai';
export { extractPublishDate } from './date-extractor';
export { normalizeUrl, titleSimilarity } from './utils';
```

**Step 3: Preserve Specialized Components**
- **Keep**: `backend/apps/threat-tracker/services/date-extractor.ts` (integrate into unified content extractor)
- **Keep**: `backend/apps/threat-tracker/services/openai.ts` (threat-specific analysis)

### News Capsule Migration

#### Current Implementation Analysis
- **Lines of Code**: ~180 lines in 1 file
- **Unique Features**: Single URL processing, executive summary generation
- **Integration Points**: Direct URL processing, report generation

#### Migration Steps

**Step 1: Simplify URL Processor** (`backend/apps/news-capsule/process-url.ts`)
```typescript
// Before (180 lines) - After (40 lines)
import { UnifiedScrapingService } from '../../services/scraping';

const scrapingService = new UnifiedScrapingService();

export async function processUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    
    // 1. Extract content using unified service
    const content = await scrapingService.scrapeArticleUrl(url);
    
    // 2. Generate executive summary (UNCHANGED - News Capsule specific)
    const summary = await generateExecutiveSummary(content);
    
    // 3. Save to database (UNCHANGED)
    const userId = (req as FullRequest).user.id;
    const articleData = {
      ...summary,
      originalUrl: url,
      userId,
      createdAt: new Date(),
      markedForReporting: true,
      markedForDeletion: false,
    };
    
    const [result] = await db.insert(capsuleArticles).values(articleData).returning();
    
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ 
      error: "Failed to process URL", 
      details: error.message 
    });
  }
}
```

## Code Reduction Analysis

### Before Refactoring
| App | Files | Total Lines | Duplicate Lines | Unique Lines |
|-----|-------|-------------|-----------------|--------------|
| News Radar | 4 | 1,260 | 850 | 410 |
| Threat Tracker | 5 | 1,260 | 780 | 480 |
| News Capsule | 1 | 180 | 120 | 60 |
| **Total** | **10** | **2,700** | **1,750** | **950** |

### After Refactoring
| Component | Files | Lines | Purpose |
|-----------|-------|-------|---------|
| Unified Scraping | 12 | 1,200 | Centralized scraping system |
| News Radar | 2 | 140 | App-specific logic only |
| Threat Tracker | 3 | 200 | App-specific logic only |
| News Capsule | 1 | 40 | App-specific logic only |
| **Total** | **18** | **1,580** | **41.5% reduction** |

### Line Reduction by Category
- **Browser Management**: 85 lines → 60 lines (29% reduction)
- **Protection Bypass**: 180 lines → 140 lines (22% reduction)
- **Link Extraction**: 200 lines → 110 lines (45% reduction)
- **Content Extraction**: 240 lines → 160 lines (33% reduction)
- **Scraping Logic**: 400 lines → 320 lines (20% reduction)

## Testing Strategy

### Component Testing
Each new component will have dedicated unit tests:
- **Browser Manager**: Browser lifecycle, error handling
- **Page Setup**: Configuration validation, header generation
- **Protection Bypass**: Detection accuracy, bypass success rates
- **Content Extractors**: Extraction accuracy, fallback behavior

### Integration Testing
- **App Migration**: Functionality preservation during migration
- **Performance Testing**: Response time comparison before/after
- **Job Management**: Concurrent job handling, state persistence

### Regression Testing
- **Full workflow tests** for each app with real URLs
- **Performance benchmarks** to ensure no degradation
- **Error handling** validation across all components

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)
- **Days 1-2**: Browser Manager and Page Setup
- **Days 3-4**: Protection Bypass implementation
- **Days 5-7**: Testing and refinement

### Phase 2: Content Processing (Week 2)
- **Days 1-3**: Link and Content Extractors
- **Days 4-5**: Structure Detector
- **Days 6-7**: Integration testing

### Phase 3: Scraping Methods (Week 3)
- **Days 1-2**: HTTP and Puppeteer Scrapers
- **Days 3-4**: Hybrid Scraper and orchestrator
- **Days 5-7**: Job management system

### Phase 4: App Migration (Week 4)
- **Days 1-2**: News Capsule migration (simplest)
- **Days 3-4**: News Radar migration
- **Days 5-7**: Threat Tracker migration and testing

### Phase 5: Cleanup and Optimization (Week 5)
- **Days 1-2**: Remove obsolete code
- **Days 3-4**: Performance optimization
- **Days 5-7**: Documentation and final testing

## Risk Mitigation

### Backup Strategy
- **Feature branches** for each migration step
- **Rollback procedures** documented for each phase
- **Data backup** before any database-related changes

### Error Handling
- **Graceful degradation** when unified service fails
- **Fallback to original implementations** during transition
- **Comprehensive logging** for debugging issues

### Performance Monitoring
- **Response time tracking** before and after migration
- **Resource usage monitoring** for browser instances
- **Error rate tracking** across all endpoints

This comprehensive plan ensures a systematic, safe migration to a centralized scraping system while preserving all existing functionality and improving maintainability across the platform.