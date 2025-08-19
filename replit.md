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
- **Background Jobs**: Custom scheduler system

### Core Architectural Decisions
- **Unified Scraping System**: Centralized, app-agnostic scraping logic handles content extraction, link identification, and bot protection. It employs a hybrid approach (HTTP-first with intelligent Puppeteer fallback) and a 3-step workflow for efficiency.
- **AI-Powered Analysis**: Leverages OpenAI for content summarization, keyword detection, relevance scoring, and security scoring, dynamically adapting prompts for specific tasks.
- **Robust Data Handling**: Drizzle ORM manages various data schemas (user, news, threats, reports), ensuring structured storage and retrieval.
- **Dynamic Content Support**: Advanced HTMX and JavaScript site handling, including multi-step deep extraction, pre-emptive challenge detection, and intelligent element analysis for URLs, authors, and dates.
- **Resilient Extraction**: Features a multi-phase content recovery system with comprehensive selector debugging, intelligent fallback strategies, and AI re-analysis for robust content acquisition.
- **Modular Design**: Emphasizes componentization and a strategy pattern to allow app-specific analysis while sharing core scraping functionalities, promoting maintainability and reducing redundancy.
- **Error Handling**: Comprehensive error logging for scraping operations, including network, parsing, and AI errors, with detailed context.
- **UI/UX**: Consistent Material Design principles, including accessible checkbox implementations and streamlined bulk operation patterns with visual feedback.
- **Unified Navigation**: Comprehensive collapsible navigation system with unified button designs, hardware-accelerated animations, and modern card-style sub-navigation items featuring gradient backgrounds and brand-colored edge highlights. Updated January 2025 with RisqWidget card styling including backdrop blur, brand-colored shadows, and consistent spacing.
- **Enhanced Login Experience**: RisqWidget-inspired hero card design with animated feature highlights, unified brand styling, and progressive disclosure patterns that showcase platform capabilities before authentication.

## External Dependencies

- **Database**: PostgreSQL 16
- **Runtime**: Node.js 20
- **Browser Automation**: Chromium (via Nix packages)
- **NPM Packages**: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `rebrowser-puppeteer`, `cheerio`, `openai`, `drizzle-orm`, `drizzle-kit`, `argon2`, `csrf-csrf`, `uuid`, `docx`, `jspdf`, `@sendgrid/mail`
- **External APIs**: OpenAI, SendGrid
```