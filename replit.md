# RisqAi News Intelligence Platform

## Overview
RisqAi is a comprehensive threat intelligence and news monitoring platform providing automated web scraping, AI-powered content analysis, and intelligent threat detection. It comprises three core applications: News Radar for general news, Threat Tracker for cybersecurity intelligence, and News Capsule for reporting and analysis. The platform aims to offer a complete solution for staying informed on critical news and cybersecurity threats.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The RisqAi platform employs a monorepo architecture, featuring a React 18 (TypeScript) frontend and a Node.js (TypeScript) Express.js backend.

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
- **Global Scraping Infrastructure**: Transformed from per-user to a global scraping system. All sources are scraped every 3 hours globally, with articles saved to a shared pool. Users apply query-time filtering to see relevant content.
- **Unified Scraping System**: Centralized, app-agnostic scraping logic handles content extraction, link identification, and bot protection, employing a hybrid approach (HTTP-first with intelligent Puppeteer fallback).
- **AI-Powered Analysis**: Leverages OpenAI for content summarization, keyword detection, relevance scoring, and security scoring, with dynamic prompt adaptation.
- **Spreadsheet Import for Tech Stack**: Users can upload Excel/CSV files containing their technology inventory. AI intelligently extracts and categorizes software, hardware, vendors, and clients regardless of column structure, with preview and deduplication before import.
- **Robust Data Handling**: Drizzle ORM manages various data schemas (user, news, threats, reports).
- **Dynamic Content Support**: Advanced HTMX and JavaScript site handling, including multi-step deep extraction, pre-emptive challenge detection, and intelligent element analysis.
- **Resilient Extraction**: Features a multi-phase content recovery system with comprehensive selector debugging, intelligent fallback strategies, and AI re-analysis.
- **Modular Design**: Emphasizes componentization and a strategy pattern for app-specific analysis while sharing core scraping functionalities.
- **Error Handling**: Comprehensive error logging for scraping operations.
- **UI/UX**: Consistent Material Design principles, unified navigation with hardware-accelerated animations, and a standardized `rounded-md` corner radius across all components. Enhanced login experience with RisqWidget-inspired hero card design.
- **Smart Relevance Filtering**: Replaced basic content type filters with an AI-driven relevance scoring system (High, Medium, Low Priority).
- **Executive Report Dashboard**: Transformed News Capsule home page to executive report summary tiles with AI-driven threat level assessment.
- **Unified Research Toolbar**: Collapsible toolbar for News Capsule Research page with organized sections for URL Processing, Report Actions, and Article Management.
- **Enhanced Bot Detection Bypass**: Implemented an error detection module, CycleTLS integration for TLS fingerprinting, and a tiered scraping strategy with progressive fallback.
- **Link Count Validation**: Improved source scraping reliability by strictly enforcing a minimum of 10 links for source pages, ensuring proper escalation to Puppeteer when necessary.
- **Advanced Turnstile Instrumentation**: Implemented comprehensive Cloudflare Turnstile API instrumentation that wraps render(), execute(), and getResponse() methods to capture real widget IDs and tokens. Fixed critical browser function execution bug and properly handles invisible challenges with automatic token capture and validation.
- **MITRE ATT&CK Integration**: Implemented automated synchronization with MITRE ATT&CK framework data, fetching threat actor groups and techniques from STIX data twice daily at 12am and 12pm EST. Successfully enriched database with 181 verified threat actors including aliases and 76 MITRE techniques as threat keywords.

## External Dependencies
- **Database**: PostgreSQL 16
- **Runtime**: Node.js 20
- **Browser Automation**: Chromium
- **NPM Packages**: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `rebrowser-puppeteer`, `cheerio`, `openai`, `drizzle-orm`, `drizzle-kit`, `argon2`, `csrf-csrf`, `uuid`, `docx`, `jspdf`, `@sendgrid/mail`
- **External APIs**: OpenAI, SendGrid