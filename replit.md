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

### Phase 3: Query-time Filtering (Completed 2025-01-18)
- **User Filtering**: Keywords and preferences applied when viewing articles, not during collection
- **Cybersecurity Filter**: Threat Tracker only displays articles flagged as cybersecurity-related
```