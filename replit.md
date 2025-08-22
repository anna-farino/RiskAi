# RisqAi News Intelligence Platform

## Overview
RisqAi is a comprehensive threat intelligence and news monitoring platform designed to provide automated web scraping, AI-powered content analysis, and intelligent threat detection. It comprises three core applications: News Radar for general news, Threat Tracker for cybersecurity intelligence, and News Capsule for reporting and analysis. The platform aims to offer a complete solution for staying informed on critical news and cybersecurity threats.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The RisqAi platform uses a monorepo structure with a React 18 (TypeScript) frontend and a Node.js (TypeScript) Express.js backend.

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **UI Components**: Radix UI, Tailwind CSS
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with CSRF protection
- **Web Scraping**: Puppeteer with stealth plugins
- **AI Integration**: OpenAI API
- **Background Jobs**: Global scheduler system (runs every 3 hours)

### Core Architectural Decisions
- **Global Scraping Infrastructure** (Updated 2025-01-18): Transformed from per-user to global scraping system. All sources are scraped every 3 hours globally, with articles saved to a shared pool. Users apply query-time filtering to see relevant content.
- **Unified Scraping System**: Centralized, app-agnostic scraping logic handles content extraction, link identification, and bot protection. It employs a hybrid approach (HTTP-first with intelligent Puppeteer fallback) and a 3-step workflow for efficiency.
- **AI-Powered Analysis**: Leverages OpenAI for content summarization, keyword detection, relevance scoring, and security scoring, dynamically adapting prompts for specific tasks.
- **Robust Data Handling**: Drizzle ORM manages various data schemas (user, news, threats, reports), ensuring structured storage and retrieval.
- **Dynamic Content Support**: Advanced HTMX and JavaScript site handling, including multi-step deep extraction, pre-emptive challenge detection, and intelligent element analysis for URLs, authors, and dates.
- **Resilient Extraction**: Features a multi-phase content recovery system with comprehensive selector debugging, intelligent fallback strategies, and AI re-analysis for robust content acquisition.
- **Modular Design**: Emphasizes componentization and a strategy pattern to allow app-specific analysis while sharing core scraping functionalities, promoting maintainability and reducing redundancy.
- **Error Handling**: Comprehensive error logging for scraping operations, including network, parsing, and AI errors, with detailed context.
- **UI/UX**: Consistent Material Design principles, including accessible checkbox implementations and streamlined bulk operation patterns with visual feedback.

## External Dependencies

- **Database**: PostgreSQL 16
- **Runtime**: Node.js 20
- **Browser Automation**: Chromium (via Nix packages)
- **NPM Packages**: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `rebrowser-puppeteer`, `cheerio`, `openai`, `drizzle-orm`, `drizzle-kit`, `argon2`, `csrf-csrf`, `uuid`, `docx`, `jspdf`, `@sendgrid/mail`
- **External APIs**: OpenAI, SendGrid

## Recent Architecture Changes (January 2025)

### Phase 1: Data Migration (Completed 2025-01-18)
- Successfully migrated 453 unique articles from 688 total (235 duplicates removed)
- Migrated 95 global sources and 259 user preferences
- All data preserved with proper foreign key relationships

### Phase 2: Global Scraping Infrastructure (Completed 2025-01-18)
- **2.1 Background Jobs**: Removed userId and keyword dependencies from both News Radar and Threat Tracker
- **2.1 Unified Global Scheduler**: Combined News Radar and Threat Tracker schedulers into single global scheduler
  - Created `backend/services/global-scheduler.ts` that runs both app scrapers
  - Runs every 3 hours globally (not per-user)
  - Eliminates duplicate scraping that was occurring with separate schedulers
- **2.1 API Routes**: Modified to work with global functions without userId parameters
- **2.1 Article Processing**: All articles now saved globally without keyword filtering at scrape time
- **2.2 AI Processing Pipeline**: Added cybersecurity detection and risk scoring during scraping
  - Added `analyzeCybersecurity()` and `calculateSecurityRisk()` methods to OpenAI service
  - Articles automatically analyzed and flagged as cybersecurity-related during scraping
  - Risk scores calculated for identified cybersecurity articles
  - Metadata stored in existing `detectedKeywords` field (no schema changes)
  - Threat Tracker now filters to show only cybersecurity articles
- **2.3 Storage Layer Update**: Modified storage to use global_articles table for global scraping
  - Updated `createArticle` methods in both News Radar and Threat Tracker
  - When userId is undefined (global scraping), articles insert into `global_articles` table
  - When userId is provided (user-specific), articles still use legacy tables
  - Proper type mapping ensures compatibility with existing code
- **2.4 Enhanced Anti-Bot Protection** (Completed 2025-01-18): Dynamic scraper resilience
  - Advanced fingerprint spoofing with 20+ browser property overrides
  - Multi-layer frame detachment recovery (3 fallback methods)
  - Smart navigation strategy for heavily protected sites
  - No blacklisting - scraper dynamically adapts to bypass protection
  - Automatic browser restart and retry logic on failures

### Phase 3: Unified Global Scraping System (Completed 2025-01-20)
- **3.1 Unified Global Scraper**: Created single unified scraper that replaces app-specific background jobs
  - Created `backend/services/global-scraping/global-scraper.ts` containing all global scraping logic
  - Migrated code exactly as it appeared in deprecated app-specific background-jobs files
  - Processes both News Radar and Threat Tracker sources in one unified job
  - Eliminated duplicate scheduler runs and source lookup errors
- **3.2 Global Scheduler Update**: Modified to use unified scraper
  - Updated `backend/services/global-scheduler.ts` to call unified scraper
  - Single background job runs every 3 hours for all sources
  - No longer uses old app-specific background-jobs files
- **3.3 Direct Core Service Integration**: Refactored to use core scraping services directly
  - Removed dependency on app-specific scraper wrappers
  - Global scraper now imports `unifiedScraper` directly from `backend/services/scraping/scrapers/main-scraper`
  - Uses `StrategyLoader` to create app-specific contexts (news-radar and threat-tracker)
  - Passes contexts directly to unified scraper methods for proper app-specific behavior
  - Uses `detectHtmlStructure` directly from core services instead of through app wrappers
  - Cleaner architecture with direct dependencies and fewer function call layers
- **3.4 Query-time Filtering** (Completed 2025-01-18)
  - **User Filtering**: Keywords and preferences applied when viewing articles, not during collection
  - **Cybersecurity Filter**: Threat Tracker only displays articles flagged as cybersecurity-related

### Phase 4: Unified Global Strategy (Completed 2025-01-20)
- **4.1 Single Global Strategy**: Replaced dual app-specific strategies with unified approach
  - Created `backend/services/scraping/strategies/global-strategy.ts` for all global scraping
  - Combines best patterns from both news and security scraping (comprehensive URL patterns)
  - Aggressive link extraction (100 max links) since we run every 3 hours globally
  - No app-specific filtering - all articles saved with AI categorization as metadata
- **4.2 Simplified Global Scraper**: Refactored to use single scraping function
  - Replaced separate `scrapeNewsRadarSource()` and `scrapeThreatTrackerSource()` functions
  - Single `scrapeGlobalSource()` function processes all sources identically
  - Direct database operations to `globalArticles` and `globalSources` tables
  - Removed dependencies on app-specific storage modules
- **4.3 AI Categorization as Metadata**: All articles saved, categorization added as metadata
  - Every article undergoes AI analysis for content summarization and keyword detection
  - Cybersecurity detection adds `isCybersecurity` boolean flag
  - Security risk scoring (0-100) calculated for cybersecurity articles only
  - `detectedKeywords` array includes `_cyber:true` flag for cybersecurity content
  - No filtering at scrape time - all content preserved for query-time filtering
- **4.4 Architecture Benefits**:
  - **Simpler**: One strategy, one scraping function, one storage approach
  - **More efficient**: No duplicate logic or unnecessary context switching
  - **Easier maintenance**: Single place to update scraping logic
  - **Consistent**: All sources treated equally with AI determining categorization
  - **Future-proof**: Easy to add new categorizations without changing scraping logic

### Phase 5: Critical Bug Fixes (Completed 2025-01-21)
- **5.1 Unified Storage Implementation**: Successfully migrated both applications to use unified storage service
  - Updated News Radar and Threat Tracker routers to use `UnifiedStorageService`
  - Populated `user_source_preferences` table with 171 preferences (147 News Radar, 24 Threat Tracker)
  - Users can now access articles from global_articles through query-time filtering
- **5.2 Puppeteer Compatibility Fix**: Resolved DataDome bypass failures due to deprecated API usage
  - Fixed "page.waitForTimeout is not a function" error across all scraping components
  - Replaced deprecated `page.waitForTimeout()` with modern `setTimeout` wrapped in Promise
  - Enhanced DataDome bypass robustness with proper error handling and validation
  - Fixed scraper compatibility issues in main-scraper.ts and protection-bypass.ts
- **5.3 Protocol Timeout Optimization**: Resolved Puppeteer protocol timeouts in resource-constrained environments
  - Implemented progressive timeout strategy (10min → 30min with retries)
  - Added 20+ Chrome optimization flags to reduce memory usage
  - Reduced memory limit from 1GB to 512MB to prevent OOM errors
  - Implemented page pooling to limit concurrent pages to 5 maximum
  - Added automatic browser reset on protocol errors for recovery
  - Enhanced retry logic with exponential backoff for resilience
```