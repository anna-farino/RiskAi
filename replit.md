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
- **Enhanced Company-Product Relationship Detection**: Implemented two-tier relationship detection (AI + heuristic patterns) across all input methods (manual entry, CSV uploads) to properly classify products like "Google DeepMind", "Microsoft Sentinel" and "AWS GuardDuty" as products of their parent companies. Uses AI with 0.6 confidence threshold, falling back to pattern matching for 40+ tech companies. Automatically adds parent companies as vendors and preserves full product names.
- **Safe Upload Preview System**: Redesigned CSV/Excel upload flow to use read-only existence checks during preview phase. No entities are saved to database until user confirms selection. Upload endpoint now uses `check*Exists` methods instead of `findOrCreate*`, ensuring data integrity and user control over imports.
- **Optimistic Updates with Smooth Transitions**: Implemented a local-state pattern for instant UI feedback with CSS transitions. When using TanStack Query optimistic updates, state changes happen synchronously in a single render cycle, preventing CSS transitions from playing. Solution: Use local component state (`useState`) that updates immediately on user interaction, synced with cache updates via `useEffect`. This allows the browser to see both the before and after states, enabling smooth CSS transitions while maintaining optimistic update benefits.
- **Admin Source Management Interface**: Added a Source Management tab to the Live Logs interface that allows administrators (users with live logs access) to manage global sources. Features include: add/edit/delete sources, enable/disable toggle with optimistic updates, search and filter toolbar matching Threat Tracker design, and comprehensive protection for default sources. The interface reuses live logs permissions for access control and provides a unified management experience for all global scraping sources used across News Radar and Threat Tracker applications.
- **Consolidated Admin Backend Organization**: Reorganized all admin-related backend code into a unified `backend/admin/` module with clear subdirectories: `routes/` (live-logs.ts, source-management.ts, test-scraping.ts), `services/` (permissions.ts, log-interceptor.ts, socket-server.ts), and `test-scraping/` (all test scraping utilities). This consolidation improves code maintainability, establishes clear boundaries between admin and application features, and provides a single import point (`backend/admin`) for all admin functionality. All imports throughout the codebase have been updated to use the new structure.

## Frontend Development Patterns

### Optimistic Updates with Smooth CSS Transitions

When implementing optimistic updates with TanStack Query, direct cache updates happen synchronously, preventing CSS transitions from animating. This pattern solves that problem.

#### The Problem
```typescript
// ❌ This won't animate smoothly
<Switch 
  checked={item.isActive}  // Changes instantly from cache update
  onCheckedChange={(checked) => {
    toggleMutation.mutate({ id: item.id, isActive: checked });
  }}
/>
```

**Why?** The optimistic `onMutate` updates the cache immediately in the same render cycle. The DOM goes from State A → State B instantly, with no time for CSS transitions to play.

#### The Solution
Use local component state as an intermediate layer:

```typescript
// ✅ This animates smoothly
const MyComponent = ({ item }) => {
  // 1. Local state for immediate UI feedback
  const [localIsActive, setLocalIsActive] = useState(item.isActive);
  
  // 2. Sync with cache/server updates
  useEffect(() => {
    setLocalIsActive(item.isActive);
  }, [item.isActive]);
  
  // 3. Update local state first, then mutate
  return (
    <Switch 
      checked={localIsActive}
      onCheckedChange={(checked) => {
        setLocalIsActive(checked);  // Instant local update (animates)
        toggleMutation.mutate({ id: item.id, isActive: checked });
      }}
    />
  );
};
```

#### How It Works
1. **User clicks** → Local state updates immediately (`setLocalIsActive`)
2. **Component re-renders** → Switch receives new value, CSS transition plays
3. **Mutation triggers** → Optimistic update runs
4. **useEffect syncs** → Keeps local state aligned with cache

#### CSS Transition Setup
Use inline styles to avoid Tailwind/CSS conflicts:

```typescript
<SwitchPrimitives.Root
  style={{
    transition: 'background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
  }}
>
  <SwitchPrimitives.Thumb
    style={{
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}
  />
</SwitchPrimitives.Root>
```

#### Best Practices
- **Always sync with useEffect**: Prevents stale local state when cache updates from server/rollback
- **Update local state first**: Provides instant visual feedback before mutation
- **Use inline styles**: Ensures transitions always apply, avoiding specificity conflicts
- **Don't invalidate queries**: In mutation `onSuccess`, avoid `invalidateQueries` to preserve optimistic updates
- **Handle rollbacks**: The `useEffect` will automatically sync local state when `onError` rolls back the cache

#### When to Use This Pattern
- Toggle switches, checkboxes, radio buttons
- Any interactive control with visual state transitions
- Components where instant feedback + smooth animation are both desired

#### Example Implementation
See `frontend/src/pages/dashboard/threat-tracker/tech-stack.tsx` for a complete working example with the `TechStackItem` component.

## External Dependencies
- **Database**: PostgreSQL 16
- **Runtime**: Node.js 20
- **Browser Automation**: Chromium
- **NPM Packages**: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `rebrowser-puppeteer`, `cheerio`, `openai`, `drizzle-orm`, `drizzle-kit`, `argon2`, `csrf-csrf`, `uuid`, `docx`, `jspdf`, `@sendgrid/mail`
- **External APIs**: OpenAI, SendGrid