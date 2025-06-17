# News Radar Scraping System

## Overview

The News Radar scraping system is a hybrid HTTP/Puppeteer solution designed for efficient news article collection and analysis. It prioritizes speed with HTTP requests while automatically falling back to Puppeteer for protected sites, dynamic content, and complex web applications. The system includes AI-powered content analysis, keyword filtering, and intelligent duplicate prevention.

## Architecture Components

### Core Files
- `backend/apps/news-radar/services/scraper.ts` - Main HTTP scraping engine with Puppeteer fallback
- `backend/apps/news-radar/services/puppeteer-scraper.ts` - Specialized Puppeteer handling for complex sites
- `backend/apps/news-radar/services/background-jobs.ts` - Job orchestration and scheduling
- `backend/apps/news-radar/services/openai.ts` - AI content analysis and structure detection
- `backend/apps/news-radar/services/scheduler.ts` - Global job scheduling system

## Functional Flow

### 1. Job Initialization (`runGlobalScrapeJob`)

**Entry Point**: User-triggered or scheduled background job
**Location**: `backend/apps/news-radar/services/background-jobs.ts`

```
runGlobalScrapeJob(userId)
├── Check if global job already running
├── Set globalJobRunning flag
├── Get auto-scrape sources for user
├── Process each source sequentially
├── Collect all new articles
└── Send consolidated email notification
```

**Key Features**:
- Single global job per execution (prevents resource conflicts)
- User-specific source filtering
- Consolidated email notifications
- Comprehensive error handling per source

### 2. Source Processing (`scrapeSource`)

**Purpose**: Process individual news sources for article collection
**Location**: `backend/apps/news-radar/services/background-jobs.ts`

```
scrapeSource(sourceId)
├── Retrieve source configuration
├── Scrape source URL for article links
├── Get or detect HTML structure (scraping config)
├── Get user's active keywords
├── Process each article URL
├── Filter articles by keyword relevance
└── Update source lastScraped timestamp
```

**Processing Strategy**:
- Keyword-driven filtering during processing
- Configurable scraping structures cached per source
- Real-time duplicate prevention
- User-scoped article collection

### 3. Hybrid Scraping Engine (`scrapeUrl`)

**Purpose**: Intelligently choose between HTTP and Puppeteer scraping
**Location**: `backend/apps/news-radar/services/scraper.ts`

#### HTTP-First Strategy

```
scrapeUrl(url, isSourceUrl, config)
├── Attempt HTTP request with headers
├── Detect bot protection/dynamic content
├── Switch to Puppeteer if needed
└── Return HTML content
```

**HTTP Request Configuration**:
```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  'Accept': 'text/html,application/xhtml+xml,application/xml...',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0'
}
```

#### Automatic Fallback Triggers

**Bot Protection Detection**:
- DataDome headers (`x-datadome`, `x-dd-b`)
- HTTP 401/403 responses
- Incapsula/Cloudflare indicators
- Content-based protection patterns

**Dynamic Content Detection**:
- React application indicators (`__next`, `data-reactroot`)
- Lazy loading patterns (`.loading`, `.skeleton`)
- HTMX attributes (`hx-get`, `hx-post`, `hx-trigger`)
- Insufficient link count (< 10 links)

**Retry Strategy**:
- Maximum 5 attempts with progressive delays
- Cookie persistence across attempts
- Referrer header addition on retries
- Graceful degradation to Puppeteer

### 4. Puppeteer Fallback System (`scrapePuppeteer`)

**Purpose**: Handle protected and dynamic sites that HTTP cannot access
**Location**: `backend/apps/news-radar/services/puppeteer-scraper.ts`

#### Enhanced Browser Configuration

```javascript
puppeteer.launch({
  headless: true,
  timeout: 60000,
  protocolTimeout: 180000,
  handleSIGINT: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    // ... extensive stealth configuration
  ]
})
```

#### Advanced Protection Bypass

**DataDome Challenge Handling**:
```javascript
handleDataDomeChallenge(page)
├── Detect DataDome protection elements
├── Wait for challenge processing
├── Verify successful bypass
└── Continue with content extraction
```

**Comprehensive Header Setup**:
```javascript
setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1'
})
```

### 5. Dynamic Content Handling

#### HTMX Detection and Processing

**Detection Strategy**:
```javascript
// Check for HTMX indicators
const htmxInfo = await page.evaluate(() => ({
  scriptLoaded: !!(window as any).htmx,
  hasHxAttributes: document.querySelectorAll('[hx-get], [hx-post]').length > 0,
  hxGetElements: Array.from(document.querySelectorAll('[hx-get]'))
}));
```

**Content Loading Process**:
1. **Direct Endpoint Fetching**: Common HTMX endpoints (`/media/items/`, `/news/items/`)
2. **Element Triggering**: Click visible HTMX elements
3. **Load More Buttons**: Activate pagination and loading buttons
4. **Progressive Scrolling**: Trigger lazy-loaded content

#### Lazy Loading Support

**Scrolling Strategy**:
```javascript
// Progressive scrolling to trigger content loading
await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight / 3);
  // ... wait and continue scrolling
});
```

### 6. Article Link Extraction (`extractArticleLinks`)

**Purpose**: Extract potential article URLs from source pages
**Location**: `backend/apps/news-radar/services/scraper.ts`

```
extractArticleLinks(html, baseUrl)
├── Detect dynamic content requirements
├── Extract all anchor links with context
├── Structure data for AI analysis
├── Send to OpenAI for article identification
├── Process and validate returned URLs
└── Return absolute URLs
```

**Link Data Structure**:
```javascript
{
  href: "article-url",
  text: "article-title", 
  context: "surrounding-text"
}
```

**AI Analysis Process**:
- Filters links by title length (>20 characters)
- Provides structured context for each link
- Uses GPT model to identify genuine articles
- Validates and converts to absolute URLs

### 7. HTML Structure Detection (`detectHtmlStructure`)

**Purpose**: Automatically detect article content selectors for new sources
**Location**: `backend/apps/news-radar/services/openai.ts`

```
detectHtmlStructure(html)
├── Extract body content only
├── Truncate to 20,000 characters
├── Send to GPT-4o-mini for analysis
└── Return CSS selector configuration
```

**Returned Structure**:
```javascript
{
  articleSelector: "article", // Container element
  titleSelector: "h1",       // Article title
  contentSelector: ".content", // Main content
  authorSelector: ".author",   // Author information (optional)
  dateSelector: "time"        // Publication date (optional)
}
```

### 8. Content Extraction (`extractArticleContent`)

**Purpose**: Extract structured content from article HTML
**Location**: `backend/apps/news-radar/services/scraper.ts`

#### Pre-processed Content Detection
```javascript
// Handle Puppeteer pre-processed content
if (html.includes('Title:') && html.includes('Content:')) {
  // Parse structured format directly
}
```

#### Cheerio-based Extraction
```javascript
extractArticleContent(html, config)
├── Remove navigation/ads/unrelated elements
├── Sanitize CSS selectors
├── Extract title, content, author using selectors
├── Apply fallback selectors if needed
├── Extract publish date with OpenAI
└── Return structured article data
```

**Fallback Selector Hierarchy**:
1. **Content**: `article`, `.article-content`, `.article-body`, `main`, `#content`
2. **Title**: `h1`, `.article-title`, `.post-title`
3. **Author**: `.author`, `.byline`, `.article-author`

### 9. AI-Powered Content Analysis

#### Keyword Detection and Validation
```javascript
analyzeContent(content, keywords, title)
├── Send content + keywords to OpenAI
├── Get detected keywords and relevance score
├── Validate keywords against user's active list
├── Generate content summary
└── Return analysis results
```

**Validation Process**:
- Title-based keyword matching with word boundaries
- OpenAI content analysis for context-aware detection
- Cross-validation against user's active keyword list
- Duplicate keyword removal

#### Publish Date Extraction
```javascript
extractPublishDate(content, title, html)
├── Send article data to OpenAI
├── Request date identification and parsing
├── Validate returned date format
├── Return Date object or null
```

### 10. Background Job Scheduling

**Global Scheduler System**:
```javascript
// Located in: backend/apps/news-radar/services/scheduler.ts
initializeScheduler()
├── Load saved schedule from database
├── Set up interval-based job execution
├── Handle server restart persistence
└── Manage job state across sessions
```

**Supported Intervals**:
- `15min`, `30min`, `1hour`, `2hour`, `4hour`, `8hour`, `12hour`, `24hour`

**Job Management**:
- Single global job instance prevention
- Graceful job stopping and restarting
- Schedule persistence across server restarts
- Real-time schedule updates

### 11. Email Notification System

**Consolidated Notifications**:
```javascript
sendNewArticlesEmail(userId, articles, manualTrigger, isConsolidated)
├── Group articles by source
├── Generate HTML email template
├── Include article summaries and links
├── Send via SendGrid
└── Log delivery status
```

**Email Features**:
- Source-grouped article presentation
- Article summaries with relevance scores
- Direct links to full articles
- Responsive HTML formatting
- Manual vs automatic trigger indicators

## Key Technical Features

### Performance Optimization
- **HTTP-first strategy**: Faster processing for unprotected sites
- **Intelligent fallback**: Only use Puppeteer when necessary
- **Browser instance reuse**: Minimize resource overhead
- **Token usage optimization**: Truncate content for AI analysis
- **Efficient duplicate detection**: URL and title-based prevention

### Protection Bypass Capabilities
- **DataDome handling**: Specialized challenge bypass
- **Cloudflare evasion**: Comprehensive header spoofing
- **HTMX support**: Dynamic content loading simulation
- **Lazy loading**: Progressive scrolling and content triggering
- **Human simulation**: Mouse movements and realistic timing

### Content Intelligence
- **Structure detection**: Automatic selector discovery
- **Keyword relevance**: Context-aware filtering
- **Date extraction**: Multiple parsing strategies
- **Content summarization**: AI-generated article summaries
- **Duplicate prevention**: URL normalization and title similarity

### User Experience
- **Real-time updates**: 30-second dashboard refresh intervals
- **Email notifications**: Consolidated new article alerts
- **Keyword customization**: User-specific filtering
- **Source management**: Per-user source configuration
- **Error resilience**: Individual source failure isolation

## Monitoring and Configuration

### Logging Categories
- `scraper`: General scraping operations
- `scraper-error`: Error conditions and failures
- `openai`: AI service interactions
- `email`: Notification delivery

### Performance Metrics
- HTTP vs Puppeteer usage ratios
- Processing time per source
- Keyword match rates
- Article save vs process ratios
- Protection bypass success rates

### Configuration Options

**Source Configuration**:
```javascript
{
  name: "News Source",
  url: "https://source.com/news/",
  scrapingConfig: {
    titleSelector: "h1.headline",
    contentSelector: ".article-body",
    authorSelector: ".byline",
    dateSelector: "time.published"
  },
  includeInAutoScrape: true,
  userId: "user-specific-id"
}
```

**Global Settings**:
- Scraping intervals (15min to 24hour)
- Email notification preferences
- Keyword lists and categories
- Source priority and grouping

This system provides efficient, scalable news collection with intelligent protection bypass and personalized content filtering for comprehensive news intelligence gathering.