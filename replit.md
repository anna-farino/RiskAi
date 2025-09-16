# RisqAi News Intelligence Platform

## Overview
RisqAi is a comprehensive threat intelligence and news monitoring platform designed for automated web scraping, AI-powered content analysis, and intelligent threat detection. It comprises three core applications: News Radar for general news, Threat Tracker for cybersecurity intelligence, and News Capsule for reporting and analysis. The platform provides a complete solution for staying informed on critical news and cybersecurity threats. Its ambition is to offer cutting-edge intelligence, leveraging AI to transform raw data into actionable insights for diverse users.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The RisqAi platform utilizes a monorepo structure with a React 18 (TypeScript) frontend and a Node.js (TypeScript) Express.js backend. The system employs a global scraping infrastructure where sources are scraped every 3 hours, and users apply query-time filtering for relevant content.

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
- **Unified Global Scraping**: Centralized, app-agnostic scraping logic with a hybrid approach (HTTP-first with intelligent Puppeteer fallback) and a 3-step workflow for efficiency. It supports dynamic content (HTMX, JavaScript) and includes a multi-phase content recovery system.
- **AI-Powered Analysis**: Leverages OpenAI for content summarization, keyword detection, relevance, and security scoring, with dynamic prompt adaptation.
- **Robust Data Handling**: Drizzle ORM manages various data schemas (user, news, threats, reports).
- **Modular Design**: Emphasizes componentization and a strategy pattern for app-specific analysis while sharing core scraping functionalities.
- **UI/UX Design**: Consistent Material Design principles, unified navigation, and platform-wide visual consistency with standardized corner radii, border weights, and a modern card-style aesthetic. The login experience features a "RisqWidget"-inspired hero card design with animated highlights.
- **Smart Relevance Filtering**: AI-driven relevance scoring categorizes articles into High, Medium, and Low Priority.
- **Executive Report Dashboard**: News Capsule home page transformed into executive report summary tiles with AI-driven threat level assessment.
- **Unified Research Toolbar**: Collapsible toolbar for News Capsule Research page, streamlining URL processing, report actions, and article management.
- **Enhanced Bot Detection Bypass**: Implemented a tiered scraping strategy using CycleTLS for TLS fingerprinting, advanced error detection, and progressive fallbacks to Puppeteer with stealth, ensuring robust evasion of bot protection.
- **Scraping Validation**: Implemented strict link count validation for source pages, ensuring quality content acquisition before escalation to more resource-intensive scraping methods.

## External Dependencies
- **Database**: PostgreSQL
- **Runtime**: Node.js
- **Browser Automation**: Chromium
- **NPM Packages**: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `rebrowser-puppeteer`, `cheerio`, `openai`, `drizzle-orm`, `drizzle-kit`, `argon2`, `csrf-csrf`, `uuid`, `docx`, `jspdf`, `@sendgrid/mail`
- **External APIs**: OpenAI, SendGrid