# Threat Tracker Puppeteer Scraping System

## Overview

The Threat Tracker uses a sophisticated Puppeteer-based scraping system designed to handle complex web protection mechanisms and extract cybersecurity threat intelligence from protected sources. The system employs stealth techniques, bot protection bypass, and AI-powered content analysis to identify and process relevant threat articles.

## Architecture Components

### Core Files
- `backend/apps/threat-tracker/services/scraper.ts` - Main scraping engine
- `backend/apps/threat-tracker/services/background-jobs.ts` - Job orchestration
- `backend/apps/threat-tracker/services/openai.ts` - AI analysis services
- `backend/apps/threat-tracker/services/date-extractor.ts` - Date extraction utilities

## Functional Flow

### 1. Job Initialization (`runGlobalScrapeJob`)

**Entry Point**: User-triggered or scheduled background job
**Location**: `backend/apps/threat-tracker/services/background-jobs.ts`

```
runGlobalScrapeJob(userId) 
├── Check if user job already running
├── Set userJobsRunning flag
├── Get active auto-scrape sources for user
└── Process each source sequentially
```

**Key Features**:
- Per-user job isolation (multiple users can run simultaneously)
- Job state tracking with `userJobsRunning` Map
- Graceful error handling per source
- Consolidated results collection

### 2. Source Processing (`scrapeSource`)

**Purpose**: Process individual threat intelligence sources
**Location**: `backend/apps/threat-tracker/services/background-jobs.ts`

```
scrapeSource(source, userId)
├── Get keyword lists by category (threats, vendors, clients, hardware)
├── Scrape source URL using Puppeteer
├── Detect or use cached HTML structure
├── Extract article links with OpenAI
├── Process each article individually
└── Update source lastScraped timestamp
```

**Keyword Categories**:
- **Threats**: Malware names, attack types, vulnerabilities
- **Vendors**: Security companies, software vendors
- **Clients**: Customer organizations, target companies
- **Hardware**: Device types, infrastructure components

### 3. Puppeteer Web Scraping (`scrapeUrl`)

**Purpose**: Handle bot-protected and complex websites
**Location**: `backend/apps/threat-tracker/services/scraper.ts`

#### Browser Setup
```javascript
getBrowser() → setupPage() → Navigate & Extract
```

**Browser Configuration**:
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox', 
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
  // ... additional stealth flags
]
```

**Page Setup**:
- Viewport: 1920x1080 (desktop simulation)
- User Agent: Latest Chrome on Windows
- Comprehensive HTTP headers for authenticity
- Extended timeouts (60 seconds)

#### Bot Protection Handling

**Detection Methods**:
- Incapsula protection indicators
- Captcha challenges
- Cloudflare protection
- Content analysis for protection pages

**Evasion Techniques**:
```javascript
// Human-like mouse movements
await page.mouse.move(50, 50);
await page.mouse.down();
await page.mouse.move(100, 100);
await page.mouse.up();

// Page reload with extended wait
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(resolve => setTimeout(resolve, 5000));
```

### 4. Content Extraction Modes

#### A. Source Page Mode (`isArticlePage: false`)
**Purpose**: Extract article links from listing pages

```
Source Page Processing:
├── Wait for anchor tags to load
├── Extract all link data (href, text, context)
├── Pass to extractArticleLinksStructured()
└── Return processed article URLs
```

#### B. Article Page Mode (`isArticlePage: true`)
**Purpose**: Extract article content from individual pages

```
Article Page Processing:
├── Progressive scrolling to load content
├── Client-side content extraction
├── Fallback selector attempts
└── Return structured HTML
```

**Content Extraction Strategy**:
1. **Primary**: Use provided scraping config selectors
2. **Fallback**: Common article selectors (`article`, `.article-content`, etc.)
3. **Last Resort**: Main content area or body text

### 5. Article Link Identification (`extractArticleLinksStructured`)

**Purpose**: Convert raw HTML into structured article links
**Location**: `backend/apps/threat-tracker/services/scraper.ts`

```
extractArticleLinksStructured(page, extractedLinkData)
├── Create structured HTML representation
├── Send to OpenAI for article link identification
├── Process and validate returned URLs
└── Return filtered article URL list
```

**AI Prompt Strategy**:
- Provides full page context with link relationships
- Requests identification of cybersecurity/threat-related articles
- Returns structured JSON with URLs and confidence scores

### 6. HTML Structure Detection (`detectHtmlStructure`)

**Purpose**: Automatically detect article content selectors
**Location**: `backend/apps/threat-tracker/services/openai.ts`

```
detectHtmlStructure(html, sourceUrl)
├── Extract body content to reduce token usage
├── Truncate to 50,000 characters max
├── Send to GPT-4o-mini for selector detection
└── Return JSON with CSS selectors
```

**Detected Selectors**:
- `title`: Article headline selector
- `content`: Main article body selector  
- `author`: Author information selector
- `date`: Publication date selector
- `dateAlternatives`: Fallback date selectors

### 7. Individual Article Processing (`processArticle`)

**Purpose**: Process single articles for relevance and storage
**Location**: `backend/apps/threat-tracker/services/background-jobs.ts`

```
processArticle(url, sourceId, userId, htmlStructure, keywords)
├── URL normalization and duplicate checking
├── Title similarity duplicate detection
├── HTML scraping with structure
├── Content extraction and validation
├── OpenAI relevance analysis
├── Keyword validation and filtering
└── Database storage
```

#### Duplicate Prevention
1. **URL-based**: Normalized URL comparison
2. **Title-based**: 85% similarity threshold using title comparison
3. **User-scoped**: Prevents cross-user duplicates

#### Content Analysis with OpenAI
```javascript
analyzeContent(content, title, threats, vendors, clients, hardware)
├── Keyword detection across all categories
├── Relevance scoring (0-10)
├── Security severity scoring  
├── Content summarization
└── Return structured analysis
```

**Relevance Criteria**:
- Must contain ≥1 threat keyword AND ≥1 other category keyword
- Keywords must exactly match user's configured terms
- OpenAI detections are validated against user keyword lists

### 8. Comprehensive Date Extraction

**Purpose**: Extract accurate publication dates from articles
**Location**: `backend/apps/threat-tracker/services/date-extractor.ts`

**Extraction Strategies**:
1. **HTML Structure**: Time elements, data attributes
2. **Meta Tags**: OpenGraph, article schema
3. **JSON-LD**: Structured data parsing
4. **CSS Selectors**: Common date class patterns
5. **Text Patterns**: Natural language date parsing
6. **Relative Dates**: "2 days ago" conversions

**Supported Formats**:
- ISO 8601: `2024-01-15T10:30:00Z`
- US formats: `1/15/2024`, `1-15-2024`
- Written: `January 15, 2024`, `Jan 1 2024`
- European: `15.01.2024`
- Unix timestamps (10 and 13 digit)

### 9. Data Storage and Validation

**Final Processing**:
```javascript
storage.createArticle({
  sourceId,
  title,
  content, 
  url: normalizedUrl,
  author,
  publishDate,
  summary,
  relevanceScore,
  securityScore,
  detectedKeywords: {
    threats: validThreatKeywords,
    vendors: validVendorKeywords, 
    clients: validClientKeywords,
    hardware: validHardwareKeywords
  },
  userId
})
```

## Key Technical Features

### Stealth and Evasion
- Comprehensive browser flags to avoid detection
- Human-like interaction patterns
- Realistic headers and user agent strings
- Progressive content loading simulation

### Error Resilience  
- Individual article failure isolation
- Graceful degradation with fallback selectors
- Comprehensive logging for debugging
- Job state preservation across failures

### Performance Optimization
- Browser instance reuse
- Parallel processing where safe
- Token usage optimization for OpenAI calls
- Efficient duplicate detection

### User Isolation
- Per-user keyword filtering
- Independent job scheduling
- User-scoped article storage
- Personalized relevance scoring

## Monitoring and Logging

**Log Categories**:
- `scraper`: General scraping operations
- `scraper-error`: Error conditions and failures
- `openai`: AI service interactions
- `openai-error`: AI service failures

**Key Metrics Tracked**:
- Articles processed vs saved ratios
- Keyword match distributions
- Processing times per source
- Error rates and types
- Bot protection encounter rates

## Configuration and Customization

### Source Configuration
```javascript
{
  name: "Source Name",
  url: "https://source.com/news/",
  scrapingConfig: {
    title: "h1.article-title",
    content: ".article-body", 
    author: ".byline",
    date: "time[datetime]"
  },
  includeInAutoScrape: true,
  userId: "user-specific-or-null-for-global"
}
```

### Keyword Categories
- **Threats**: Specific to cybersecurity threats and vulnerabilities
- **Vendors**: Technology and security solution providers
- **Clients**: Organizations that might be targets or customers
- **Hardware**: Physical devices and infrastructure components

This system provides robust, scalable threat intelligence collection with advanced evasion capabilities and intelligent content filtering tailored to cybersecurity professionals' needs.