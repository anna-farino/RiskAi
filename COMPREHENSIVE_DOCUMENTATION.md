# Web Intelligence Platform - Comprehensive Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Architecture](#database-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Scraping System](#scraping-system)
6. [Authentication & Security](#authentication--security)
7. [Application Modules](#application-modules)
8. [API Reference](#api-reference)
9. [Data Flow](#data-flow)
10. [Configuration & Deployment](#configuration--deployment)

---

## System Overview

### Purpose
A sophisticated web intelligence platform leveraging advanced AI technologies for dynamic web content extraction, threat monitoring, and intelligent information gathering. The application provides robust web scraping capabilities with intelligent anti-detection mechanisms, focusing on comprehensive news and threat tracking across multiple domains.

### Technology Stack
- **Backend**: Node.js/Express with TypeScript
- **Frontend**: React with Vite, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Auth0
- **Scraping**: Puppeteer, CycleTLS, custom anti-detection mechanisms  
- **AI**: OpenAI integration for content analysis
- **Styling**: Tailwind CSS, Shadcn/UI components
- **State Management**: TanStack Query (React Query)
- **Email**: SendGrid integration
- **Security**: Helmet, CSRF protection, rate limiting

### Architecture Pattern
The application follows a **monorepo structure** with three main application modules:
- **News Radar**: General news monitoring and article collection
- **Threat Tracker**: Cybersecurity threat monitoring and analysis
- **News Capsule**: Report generation and article processing

---

## Database Architecture

### Core Tables

#### Users & Authentication
```sql
-- Main user table
users {
  id: uuid (PK)
  email: text (unique)
  password: text
  name: text
  twoFactorEnabled: boolean
  verified: boolean
  createdAt: timestamp
}

-- Auth0 integration
auth0_ids {
  id: uuid (PK)
  userId: uuid (FK → users.id)
  auth0Id: text (unique)
}

-- Session management
refresh_tokens {
  id: uuid (PK)
  userId: uuid (FK → users.id)
  token: text (unique)
  expiresAt: timestamp
  createdAt: timestamp
  revokedAt: timestamp
}

-- Access control
allowed_emails {
  id: uuid (PK)
  name: text
  createdAt: timestamp
}
```

#### News Radar Schema
```sql
-- News sources to monitor
sources {
  id: uuid (PK)
  url: text
  name: text
  active: boolean
  includeInAutoScrape: boolean
  scrapingConfig: jsonb
  lastScraped: timestamp
  userId: uuid (FK → users.id)
}

-- Keywords for content filtering
keywords {
  id: uuid (PK)
  term: text
  active: boolean
  userId: uuid (FK → users.id)
}

-- Scraped articles
articles {
  id: uuid (PK)
  sourceId: uuid (FK → sources.id)
  title: text
  content: text
  url: text
  author: text
  publishDate: timestamp
  summary: text
  relevanceScore: integer
  detectedKeywords: jsonb
  userId: uuid (FK → users.id)
}

-- Application settings
settings {
  id: uuid (PK)
  key: text
  value: jsonb
  updatedAt: timestamp
  userId: uuid (FK → users.id)
}
```

#### Threat Tracker Schema
```sql
-- Threat monitoring sources
threat_sources {
  id: uuid (PK)
  url: text
  name: text
  includeInAutoScrape: boolean
  scrapingConfig: jsonb
  lastScraped: timestamp
  userId: uuid (FK → users.id)
  isDefault: boolean
}

-- Threat keywords by category
threat_keywords {
  id: uuid (PK)
  term: text
  category: text -- 'threat', 'vendor', 'client', 'hardware'
  active: boolean
  userId: uuid (FK → users.id)
  isDefault: boolean
}

-- Threat articles
threat_articles {
  id: uuid (PK)
  sourceId: uuid (FK → threat_sources.id)
  title: text
  content: text
  url: text
  author: text
  publishDate: timestamp
  summary: text
  relevanceScore: text
  securityScore: text
  detectedKeywords: jsonb -- { threats: [], vendors: [], clients: [], hardware: [] }
  scrapeDate: timestamp
  userId: uuid (FK → users.id)
  markedForCapsule: boolean
}

-- Threat tracker settings
threat_settings {
  id: uuid (PK)
  key: text
  value: jsonb
  updatedAt: timestamp
  userId: uuid (FK → users.id)
}
```

#### News Capsule Schema
```sql
-- Processed articles for reports
capsule_articles {
  id: uuid (PK)
  title: text
  threatName: text
  vulnerabilityId: text (default: "Unspecified")
  summary: text
  impacts: text
  attackVector: text (default: "Unknown attack vector")
  microsoftConnection: text
  sourcePublication: text
  originalUrl: text
  targetOS: text (default: "Microsoft / Windows")
  createdAt: timestamp
  markedForReporting: boolean (default: true)
  markedForDeletion: boolean (default: false)
  userId: uuid (FK → users.id)
}

-- Report containers
reports {
  id: uuid (PK)
  userId: uuid (FK → users.id)
  topic: text
  createdAt: timestamp
}

-- Many-to-many: articles in reports
capsule_articles_in_reports {
  articleId: uuid (FK → capsule_articles.id)
  reportId: uuid (FK → reports.id)
  PRIMARY KEY (articleId, reportId)
}
```

#### Supporting Tables
```sql
-- Error logging
scraping_error_logs {
  id: uuid (PK)
  errorType: text
  errorMessage: text
  stackTrace: text
  contextInfo: jsonb
  timestamp: timestamp
  userId: uuid (FK → users.id)
}

-- Encrypted secrets management
secrets {
  id: uuid (PK)
  keyName: text
  encryptedValue: text
  createdAt: timestamp
  userId: uuid (FK → users.id)
}

-- OTP management
otps {
  id: uuid (PK)
  email: text
  otp: text
  expiresAt: timestamp
  used: boolean
  createdAt: timestamp
}

-- Role-based access control
rbac {
  id: uuid (PK)
  userId: uuid (FK → users.id)
  role: text
  createdAt: timestamp
}
```

---

## Backend Architecture

### Main Server (`backend/index.ts`)
- **Express server** on port 5000 (configurable)
- **Development proxy** to Vite dev server (port 5174)
- **Security middleware**: Helmet, CORS, rate limiting
- **Auto-scheduler initialization** for both News Radar and Threat Tracker
- **Middleware chain**: 
  - Trust proxy
  - Security headers (Helmet)
  - Call ID tracking
  - Request logging
  - CORS
  - JSON parsing
  - Cookie parsing

### Router Architecture (`backend/router/index.ts`)

#### Public Routes
- `/api/test` - Health check
- `/api/test-datadome-bypass` - DataDome bypass testing
- `/api/auth/*` - Authentication routes

#### Protected Routes (require Auth0 JWT)
- **Users**: `/api/users/*`
- **News Radar**: `/api/news-tracker/*`
- **Threat Tracker**: `/api/threat-tracker/*` 
- **News Capsule**: `/api/news-capsule/*`
- **Secrets**: `/api/secrets`
- **Sample Data**: `/api/sample-data/*`

### Application Modules

#### News Radar (`backend/apps/news-radar/`)
**Router** (`router/index.ts`):
- **Sources Management**: CRUD + bulk operations
- **Keywords Management**: CRUD operations
- **Articles**: Retrieval, filtering, deletion
- **Scraping**: Manual and scheduled scraping
- **Scheduler**: Auto-scrape configuration

**Services**:
- `background-jobs.ts`: Source scraping orchestration
- `scraper.ts`: Core scraping logic
- `scheduler.ts`: Cron job management
- `openai.ts`: Content analysis integration

**Queries** (`queries/news-tracker/`): Database operations

#### Threat Tracker (`backend/apps/threat-tracker/`)
**Router** (`router/index.ts`):
- **Sources Management**: CRUD + bulk operations (includes default sources)
- **Keywords Management**: CRUD + bulk operations with categories
- **Articles**: Retrieval, filtering, deletion
- **Scraping**: Manual and scheduled scraping
- **Scheduler**: Auto-scrape configuration

**Services**:
- `background-jobs.ts`: Threat-specific scraping
- `scraper.ts`: Threat-focused scraping logic
- `scheduler.ts`: Threat monitoring schedules
- `openai.ts`: Security-focused content analysis
- `date-extractor.ts`: Article date extraction
- `url-utils.ts`: URL processing utilities

#### News Capsule (`backend/apps/news-capsule/`)
**Router** (`router.ts`):
- `POST /process-url`: Generate article summaries from URLs
- `POST /add-to-report`: Add articles to reports
- `GET /reports`: Retrieve reports with articles
- `DELETE /reports/:id`: Delete reports
- `DELETE /reports/:reportId/articles/:articleId`: Remove articles from reports
- `GET /articles`: Get all capsule articles
- `DELETE /articles/:id`: Delete capsule articles

**Services**:
- `process-url.ts`: URL processing and AI analysis
- `add-to-report.ts`: Report management
- `get-reports.ts`: Report retrieval
- `delete-report.ts`: Report deletion
- `get-articles.ts`: Article retrieval
- `delete-article.ts`: Article deletion

### Shared Services (`backend/services/`)

#### Scraping Engine (`scraping/`)
**Core Components**:
- `core/`: Base scraping infrastructure
- `extractors/`: Content extraction algorithms
- `scrapers/`: Platform-specific scrapers
- `strategies/`: Anti-detection strategies

**Key Features**:
- **Anti-detection mechanisms**: User agent rotation, timing randomization
- **Multiple scraping strategies**: Puppeteer, CycleTLS, direct HTTP
- **Content extraction**: Title, content, date, author extraction
- **Error handling**: Comprehensive error logging and context preservation

#### Error Logging (`error-logging/`)
- **Centralized error tracking**: All scraping and application errors
- **Context preservation**: User, source, and operation context
- **Integration examples**: How to log errors across modules
- **Storage layer**: Database persistence of error logs

#### Other Services
- `openai.ts`: OpenAI integration for content analysis
- `sample-data-populator.ts`: Development data seeding

### Middleware (`backend/middleware/`)
- **Auth0 Integration**: JWT verification and user context
- **CSRF Protection**: Double submit cookie pattern
- **Rate Limiting**: Request throttling
- **Permission Verification**: Role-based access control
- **Request Logging**: Comprehensive request tracking

---

## Frontend Architecture

### Application Structure (`frontend/src/`)

#### Core Application (`App.tsx`)
- **React Router**: Browser-based routing
- **TanStack Query**: Server state management with dev tools
- **Theme Provider**: Dark/light theme support
- **Error Boundary**: Global error handling
- **Auth0 Provider**: Authentication context

#### Routing (`router/router.tsx`)
**Route Structure**:
```tsx
/ (Auth0 Provider)
├── /auth (Auth Layout)
│   ├── /login
│   ├── /signup
│   ├── /email-otp
│   └── /new-password
├── /dashboard (Dashboard Layout)
│   ├── / (Overview)
│   ├── /news-radar
│   ├── /threat-tracker
│   ├── /news-capsule
│   ├── /settings
│   └── /admin
└── * (Redirect to appropriate section)
```

#### Authentication Flow
**Components**:
- `Auth0ProviderWithNavigate`: Auth0 integration with navigation
- `Redirect.tsx`: Route protection and user direction
- `ProtectedRoutesWrapper.tsx`: Route guard implementation

**Pages** (`pages/`):
- `auth-layout.tsx`: Authentication page container
- `Login.tsx`: Login form
- `Signup.tsx`: Registration form  
- `email-otp.tsx`: Email OTP verification
- `new-password.tsx`: Password reset form

#### Dashboard (`pages/dashboard/`)
**Main Modules**:
- `news-radar/`: News monitoring interface
- `threat-tracker/`: Threat monitoring interface
- `news-capsule/`: Report generation interface
- `Settings.tsx`: User preferences
- `Admin.tsx`: Administrative functions
- `Secrets.tsx`: API key management

#### Component Architecture (`components/`)

**Layout Components**:
- `layout/DashboardLayout.tsx`: Main dashboard container
- `theme-provider.tsx`: Theme context management
- `theme-toggle.tsx`: Dark/light theme switcher

**UI Components** (`ui/`):
- Shadcn/UI component library integration
- Custom form components
- Data display components
- Navigation components

**Feature Components**:
- `news-capsule/`: News Capsule specific components
- `widgets/`: Reusable dashboard widgets
- `custom-alert-dialog.tsx`: Confirmation dialogs
- `delete-alert-dialog.tsx`: Deletion confirmations

#### State Management

**Context** (`context/`):
- `NewsCapsuleContext.tsx`: News Capsule state management

**Store** (`store/`):
- `main-store.ts`: Global application state
- `news-capsule-store.ts`: News Capsule specific state

**Hooks** (`hooks/`):
- `use-auth.ts`: Authentication state
- `use-fetch.ts`: Data fetching utilities
- `use-toast.ts`: Toast notifications
- Authentication-specific hooks for login/logout/signup

#### Utilities (`utils/`, `lib/`)
- `query-client.ts`: TanStack Query configuration
- `utils.ts`: General utility functions
- `server-url.ts`: API endpoint management
- `date-utils.ts`: Date formatting utilities
- `csrf-header.ts`: CSRF token handling

---

## Scraping System

### Multi-Strategy Scraping Architecture

The application implements a sophisticated scraping system with multiple strategies for different scenarios:

#### 1. **Unified Scraping Service** (`backend/services/scraping/`)

**Core Strategy Selection**:
- **Puppeteer**: For JavaScript-heavy sites requiring full browser rendering
- **CycleTLS**: For sites with advanced bot detection (TLS fingerprinting)
- **Direct HTTP**: For simple, static content sites

**Anti-Detection Mechanisms**:
- **User Agent Rotation**: Realistic browser user agents
- **Request Timing**: Randomized delays between requests
- **Header Manipulation**: Proper browser-like headers
- **Cookie Management**: Persistent session handling
- **IP Rotation**: When configured with proxy services

#### 2. **Content Extraction Pipeline**

**Link Discovery**:
- **Pattern Recognition**: Identifies article URL patterns
- **CSS Selector Based**: Uses configured selectors for specific sites
- **AI-Assisted Detection**: Fallback to AI for structure detection

**Content Extraction**:
- **Title Extraction**: Multiple fallback strategies (H1, title, meta tags)
- **Content Extraction**: Article body detection with cleaning
- **Metadata Extraction**: Author, date, publication info
- **Image Extraction**: Featured images and inline media

**Date Extraction** (Threat Tracker specific):
- **Multiple Formats**: Handles various date formats
- **Context-Aware**: Uses surrounding content for date inference
- **Fallback Strategies**: Publication date vs. last modified

#### 3. **AI-Powered Analysis**

**Content Analysis** (OpenAI Integration):
- **Relevance Scoring**: Matches content against user keywords
- **Security Scoring**: (Threat Tracker) Assesses security significance
- **Summary Generation**: Creates concise article summaries
- **Keyword Detection**: Identifies relevant keywords in content
- **Category Classification**: Sorts content by type/importance

**News Capsule Processing**:
- **Threat Analysis**: Identifies cybersecurity threats
- **Impact Assessment**: Evaluates potential business impact
- **Microsoft Connection**: Identifies Microsoft ecosystem relevance
- **Vulnerability Classification**: Categorizes security vulnerabilities

#### 4. **Automated Scheduling**

**Scheduler Architecture**:
- **Cron-based**: Uses node-cron for scheduling
- **Per-Module Scheduling**: Independent schedules for News Radar and Threat Tracker
- **User-Configurable**: Users can set scraping intervals
- **Resource Management**: Prevents overlapping scraping jobs

**Background Job Processing**:
- **Queue Management**: Processes sources sequentially
- **Error Handling**: Continues processing despite individual failures
- **Progress Tracking**: Real-time scraping status
- **Result Aggregation**: Collects and reports scraping statistics

#### 5. **Error Handling & Logging**

**Comprehensive Error Tracking**:
- **Source-Level Errors**: Failed source access
- **Article-Level Errors**: Individual article processing failures
- **Context Preservation**: Maintains user, source, and operation context
- **Error Classification**: Different error types for different failure modes

**Error Recovery**:
- **Retry Mechanisms**: Automatic retries with backoff
- **Fallback Strategies**: Alternative extraction methods
- **Graceful Degradation**: Continues operation despite partial failures

---

## Authentication & Security

### Auth0 Integration

**Configuration**:
- **JWT-based authentication**: Stateless token verification
- **User profile management**: Auth0 handles user data
- **Multi-factor authentication**: Optional 2FA support
- **Social login**: Configurable social providers

**Token Flow**:
1. User authenticates via Auth0
2. JWT token returned to frontend
3. Frontend includes token in API requests
4. Backend verifies JWT signature
5. User context extracted for authorization

### Security Middleware Stack

**Request Processing Order**:
1. **Helmet**: Security headers (CSP, HSTS, etc.)
2. **Call ID**: Request tracking
3. **Rate Limiting**: Request throttling
4. **CORS**: Cross-origin request validation
5. **Auth0 JWT**: Token verification
6. **CSRF Protection**: Double submit cookie (commented in some routes)
7. **Permission Verification**: Role-based access control

**Security Features**:
- **Rate Limiting**: Configurable per-endpoint throttling
- **CORS Configuration**: Restricted origin policies
- **Security Headers**: Comprehensive header security
- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **XSS Prevention**: Content sanitization

### Access Control

**Role-Based Access Control (RBAC)**:
- **User Roles**: Stored in `rbac` table
- **Permission Verification**: Middleware-based role checking
- **Resource Ownership**: Users can only access their own data
- **Default Access**: Basic permissions for authenticated users

**Row-Level Security (RLS)**:
- **PostgreSQL Policies**: Database-level access control
- **User Context**: Current user ID set in database session
- **Automatic Filtering**: Queries automatically filtered by user

---

## Application Modules

### 1. News Radar - General News Monitoring

**Purpose**: Monitor general news sources for relevant articles based on user-defined keywords.

**Core Functionality**:
- **Source Management**: Add/remove news websites to monitor
- **Keyword Filtering**: Define keywords for content relevance
- **Automated Scraping**: Schedule regular source monitoring
- **Content Analysis**: AI-powered article analysis and scoring
- **Article Storage**: Persistent storage of relevant articles

**User Workflow**:
1. **Setup Sources**: Add news websites to monitor
2. **Define Keywords**: Set relevant keywords for filtering
3. **Configure Scraping**: Set automatic scraping schedules
4. **Review Articles**: Browse discovered relevant articles
5. **Manage Content**: Delete unwanted articles, refine keywords

**API Endpoints**:
- `GET /api/news-tracker/sources` - List user sources
- `POST /api/news-tracker/sources` - Add new source
- `GET /api/news-tracker/keywords` - List user keywords  
- `POST /api/news-tracker/keywords` - Add new keyword
- `GET /api/news-tracker/articles` - Get articles (with filtering)
- `POST /api/news-tracker/sources/:id/scrape` - Manual scrape trigger
- `POST /api/news-tracker/sources/bulk-add` - Bulk source addition
- `DELETE /api/news-tracker/articles` - Delete all articles

### 2. Threat Tracker - Cybersecurity Monitoring

**Purpose**: Specialized monitoring of cybersecurity threat information with categorized keyword analysis.

**Core Functionality**:
- **Threat Source Management**: Monitor cybersecurity websites
- **Categorized Keywords**: Keywords grouped by type (threats, vendors, clients, hardware)
- **Security Scoring**: AI-powered security relevance assessment
- **Default Sources**: Pre-configured threat intelligence sources
- **Capsule Integration**: Mark threats for inclusion in News Capsule

**Keyword Categories**:
- **Threats**: Vulnerability types, attack methods
- **Vendors**: Software/hardware manufacturers
- **Clients**: Specific companies or organizations
- **Hardware**: Device types and platforms

**User Workflow**:
1. **Review Default Sources**: Start with pre-configured threat sources
2. **Add Custom Sources**: Include additional threat intelligence feeds
3. **Configure Keywords**: Set up keywords in different categories
4. **Monitor Threats**: Automated threat detection and collection
5. **Assess Security Impact**: Review security scores and relevance
6. **Export to Capsule**: Send important threats to News Capsule for reporting

**API Endpoints**:
- `GET /api/threat-tracker/sources` - List sources (user + default)
- `POST /api/threat-tracker/sources` - Add new threat source
- `GET /api/threat-tracker/keywords` - List keywords by category
- `POST /api/threat-tracker/keywords/bulk` - Bulk keyword creation
- `GET /api/threat-tracker/articles` - Get threat articles
- `POST /api/threat-tracker/sources/:id/scrape` - Manual threat scan

### 3. News Capsule - Report Generation

**Purpose**: Process URLs into structured threat reports with AI analysis for executive briefings.

**Core Functionality**:
- **URL Processing**: Convert article URLs into structured threat data
- **AI Analysis**: Extract threat details, impacts, and Microsoft connections
- **Report Creation**: Organize articles into thematic reports
- **Executive Formatting**: Professional report output
- **Article Management**: Edit, delete, and organize processed articles

**Data Structure** (Capsule Articles):
- **Basic Info**: Title, threat name, vulnerability ID
- **Analysis**: Summary, impacts, attack vectors
- **Context**: Microsoft connection, target OS
- **Metadata**: Source publication, original URL
- **Reporting Flags**: Mark for reports, mark for deletion

**User Workflow**:
1. **Process URLs**: Submit article URLs for AI analysis
2. **Review Analysis**: Verify AI-generated threat details
3. **Create Reports**: Group related articles into reports
4. **Edit Content**: Modify article details as needed
5. **Generate Output**: Export professional threat reports
6. **Manage Articles**: Organize and maintain article database

**API Endpoints**:
- `POST /api/news-capsule/process-url` - Analyze URL with AI
- `GET /api/news-capsule/articles` - List all capsule articles
- `POST /api/news-capsule/add-to-report` - Add articles to report
- `GET /api/news-capsule/reports` - Get reports with articles
- `DELETE /api/news-capsule/reports/:id` - Delete report
- `DELETE /api/news-capsule/articles/:id` - Delete article

---

## API Reference

### Authentication Required
All API endpoints except `/api/auth/*` require valid Auth0 JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### News Radar API (`/api/news-tracker`)

#### Sources Management
```http
GET /api/news-tracker/sources
# Returns: Source[] - List of user's news sources

POST /api/news-tracker/sources  
Content-Type: application/json
{
  "url": "https://example-news.com",
  "name": "Example News Site"
}
# Returns: Source - Created source

PATCH /api/news-tracker/sources/:id
Content-Type: application/json
{
  "name": "Updated Name",
  "active": false
}
# Returns: Source - Updated source

DELETE /api/news-tracker/sources/:id
# Returns: { success: true, id: string, message: string }

POST /api/news-tracker/sources/bulk-add
Content-Type: application/json
{
  "urls": "url1.com, url2.com, url3.com",
  "options": { "concurrency": 5, "timeout": 10000 }
}
# Returns: Bulk operation results with success/failure details

POST /api/news-tracker/sources/bulk-delete
Content-Type: application/json
{
  "sourceIds": ["uuid1", "uuid2", "uuid3"]
}
# Returns: Bulk deletion results
```

#### Keywords Management
```http
GET /api/news-tracker/keywords
# Returns: Keyword[] - List of user's keywords

POST /api/news-tracker/keywords
Content-Type: application/json
{
  "term": "artificial intelligence"
}
# Returns: Keyword - Created keyword

PATCH /api/news-tracker/keywords/:id
DELETE /api/news-tracker/keywords/:id
```

#### Articles
```http
GET /api/news-tracker/articles?search=query&keywordIds=id1,id2&startDate=2024-01-01&endDate=2024-12-31
# Query parameters:
# - search: text search in title/content
# - keywordIds: filter by keyword IDs
# - startDate/endDate: date range filter
# Returns: Article[] - Filtered articles

DELETE /api/news-tracker/articles/:id
DELETE /api/news-tracker/articles  # Delete all user articles
```

#### Scraping Operations
```http
POST /api/news-tracker/sources/:id/scrape
# Triggers manual scraping of specific source
# Returns: { message: string, stats: { processedCount: number, savedCount: number } }

POST /api/news-tracker/sources/:id/stop
# Stops active scraping for source

GET /api/news-tracker/schedule
POST /api/news-tracker/schedule
# Get/update automatic scraping schedule
```

### Threat Tracker API (`/api/threat-tracker`)

#### Sources Management
```http
GET /api/threat-tracker/sources
# Returns: ThreatSource[] - User sources + default sources

POST /api/threat-tracker/sources
Content-Type: application/json
{
  "url": "https://threat-intel.com",
  "name": "Threat Intel Source"
}

PUT /api/threat-tracker/sources/:id
DELETE /api/threat-tracker/sources/:id
# Note: Cannot delete default sources

POST /api/threat-tracker/sources/bulk-add
POST /api/threat-tracker/sources/bulk-delete
# Similar to News Radar bulk operations
```

#### Keywords Management
```http
GET /api/threat-tracker/keywords?category=threat
# Query parameters:
# - category: filter by 'threat', 'vendor', 'client', 'hardware'
# Returns: ThreatKeyword[] - Keywords for category

POST /api/threat-tracker/keywords
Content-Type: application/json
{
  "term": "ransomware",
  "category": "threat"
}

POST /api/threat-tracker/keywords/bulk
Content-Type: application/json
{
  "terms": "malware, ransomware, phishing",
  "category": "threat",
  "active": true
}

PUT /api/threat-tracker/keywords/:id
DELETE /api/threat-tracker/keywords/:id
# Note: Cannot modify/delete default keywords
```

#### Articles & Scraping
```http
GET /api/threat-tracker/articles
# Returns: ThreatArticle[] - Threat articles with security scores

DELETE /api/threat-tracker/articles/:id
DELETE /api/threat-tracker/articles  # Delete all articles

POST /api/threat-tracker/sources/:id/scrape
# Manual threat source scraping

GET /api/threat-tracker/schedule
POST /api/threat-tracker/schedule
# Schedule management
```

### News Capsule API (`/api/news-capsule`)

#### URL Processing
```http
POST /api/news-capsule/process-url
Content-Type: application/json
{
  "url": "https://security-article.com/threat-analysis"
}
# Returns: CapsuleArticle - AI-processed article with threat analysis
```

#### Article Management
```http
GET /api/news-capsule/articles
# Returns: CapsuleArticle[] - All processed articles

DELETE /api/news-capsule/articles/:id
# Delete specific capsule article
```

#### Report Management
```http
GET /api/news-capsule/reports
# Returns: Report[] - All reports with included articles

POST /api/news-capsule/add-to-report
Content-Type: application/json
{
  "articleIds": ["article-uuid1", "article-uuid2"],
  "reportTopic": "Q4 Security Threats",
  "reportId": "existing-report-uuid"  // Optional: add to existing report
}
# Returns: Report - Created or updated report

DELETE /api/news-capsule/reports/:id
# Delete entire report

DELETE /api/news-capsule/reports/:reportId/articles/:articleId
# Remove specific article from report
```

### System APIs

#### Secrets Management
```http
GET /api/secrets
# Returns: decrypted secrets for user

POST /api/secrets
Content-Type: application/json
{
  "keyName": "OPENAI_API_KEY",
  "value": "sk-..."
}

DELETE /api/secrets
Content-Type: application/json
{
  "keyNames": ["OPENAI_API_KEY"]
}
```

#### Sample Data
```http
GET /api/sample-data/status
# Check if sample data exists

POST /api/sample-data/populate
# Populate development sample data
```

### Error Responses
All endpoints return standardized error responses:
```json
{
  "error": "Error description",
  "details": "Additional error context (optional)"
}
```

Common HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

---

## Data Flow

### News Radar Data Flow

```mermaid
graph TD
    A[User adds news sources] --> B[Background scheduler triggers scraping]
    B --> C[Scraping service extracts article links]
    C --> D[For each link: extract content]
    D --> E[AI analyzes content against keywords]
    E --> F[Calculate relevance score]
    F --> G[Save relevant articles to database]
    G --> H[Send email notification if new articles]
    H --> I[User reviews articles in dashboard]
    I --> J[User can delete unwanted articles]
    J --> K[User refines keywords based on results]
```

### Threat Tracker Data Flow

```mermaid
graph TD
    A[Default + user threat sources] --> B[Scheduled threat monitoring]
    B --> C[Scrape threat intelligence sources]
    C --> D[Extract threat article content]
    D --> E[AI analysis with security focus]
    E --> F[Categorize detected keywords]
    F --> G[Calculate security score]
    G --> H[Save threat articles]
    H --> I[User reviews threats in dashboard]
    I --> J[Mark important threats for News Capsule]
    J --> K[Export to reporting system]
```

### News Capsule Data Flow

```mermaid
graph TD
    A[User submits article URL] --> B[AI processes URL content]
    B --> C[Extract threat information]
    C --> D[Identify Microsoft connections]
    D --> E[Assess business impact]
    E --> F[Generate structured threat data]
    F --> G[Save as capsule article]
    G --> H[User creates/selects report]
    H --> I[Add article to report]
    I --> J[Generate executive report]
    J --> K[Export/share report]
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth0
    participant B as Backend
    participant D as Database

    U->>F: Login attempt
    F->>A: Redirect to Auth0
    A->>U: Show login form
    U->>A: Submit credentials
    A->>F: Return JWT token
    F->>B: API request with JWT
    B->>A: Verify JWT signature
    A->>B: Token valid + user info
    B->>D: Query with user context
    D->>B: Return user-specific data
    B->>F: Return response
    F->>U: Display data
```

### Scraping Process Flow

```mermaid
graph TD
    A[Scheduler triggers scraping] --> B{Source active?}
    B -->|No| C[Skip source]
    B -->|Yes| D[Set scraping flag]
    D --> E{Anti-detection strategy}
    E -->|Simple site| F[Direct HTTP request]
    E -->|JS heavy| G[Puppeteer browser]
    E -->|Bot detection| H[CycleTLS]
    F --> I[Extract article links]
    G --> I
    H --> I
    I --> J[For each article link]
    J --> K[Extract content]
    K --> L[AI content analysis]
    L --> M[Save if relevant]
    M --> N[Update last scraped]
    N --> O[Clear scraping flag]
    O --> P[Email notification]
```

---

## Configuration & Deployment

### Environment Variables

#### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Auth0 Configuration  
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=your-api-audience

# API Keys
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG....

# Application Settings
NODE_ENV=development|production
PORT=5000

# Security
JWT_SECRET=your-jwt-secret
CSRF_SECRET=your-csrf-secret
ENCRYPTION_KEY=your-32-char-encryption-key

# Email Configuration
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_TEMPLATE_ID=d-...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

#### Optional Variables
```env
# Scraping Configuration
DEFAULT_REQUEST_TIMEOUT=30000
MAX_CONCURRENT_SCRAPES=5
PUPPETEER_HEADLESS=true

# Development
VITE_DEV_SERVER_PORT=5174
LOG_LEVEL=info|debug|warn|error

# DataDome Bypass (if needed)
DATADOME_BYPASS_ENABLED=false
```

### Database Setup

#### Installation & Migration
```bash
# Install PostgreSQL (if not using managed service)
sudo apt-get install postgresql postgresql-contrib

# Create database
createdb your-database-name

# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/your-database-name"

# Push schema to database (using Drizzle)
npm run db:push
```

#### Row-Level Security Setup
```sql
-- Enable RLS on tables
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies are defined in schema files
-- They use current_setting('app.current_user_id', true) for user filtering
```

### Application Deployment

#### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd web-intelligence-platform

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run db:push

# Start development server
npm run dev
```

#### Production Deployment

**Option 1: Traditional Server**
```bash
# Build application
npm run build

# Start production server
NODE_ENV=production npm start
```

**Option 2: Docker**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

**Option 3: Replit Deployment**
- Use Replit's built-in deployment system
- Configure environment variables in Replit secrets
- Database automatically configured via DATABASE_URL
- Auto-scaling and SSL handled by platform

### Security Configuration

#### HTTPS & SSL
```javascript
// Production HTTPS enforcement
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

#### CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com']
    : ['http://localhost:5174'],
  credentials: true,
  optionsSuccessStatus: 200
};
```

#### Rate Limiting
```javascript
const rateLimitConfig = {
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
};
```

### Monitoring & Logging

#### Error Tracking
- **Database Logging**: All errors stored in `scraping_error_logs`
- **Context Preservation**: User, source, operation context maintained
- **Error Classification**: Different error types for different failure modes

#### Performance Monitoring
- **Request Logging**: All API requests logged with timing
- **Scraping Metrics**: Success/failure rates, processing times
- **Database Performance**: Query optimization and indexing

#### Health Checks
```http
GET /api/test  # Basic server health
GET /api/news-tracker/test  # News Radar module health
GET /api/threat-tracker/test  # Threat Tracker module health
```

### Backup & Recovery

#### Database Backups
```bash
# Automated backup script
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup  
psql $DATABASE_URL < backup_file.sql
```

#### File System Backups
- **Configuration files**: Environment variables, settings
- **User uploads**: Any user-generated content
- **Logs**: Application and error logs for forensic analysis

---

## Maintenance & Operations

### Regular Maintenance Tasks

1. **Database Cleanup**:
   - Archive old articles beyond retention period
   - Clean up expired OTP codes
   - Remove revoked refresh tokens

2. **Performance Optimization**:
   - Monitor slow queries and add indexes
   - Optimize scraping schedules to avoid conflicts
   - Clean up unused secrets and settings

3. **Security Updates**:
   - Regular dependency updates
   - Security patch application
   - Auth0 configuration reviews

4. **Monitoring**:
   - Track scraping success rates
   - Monitor API response times
   - Review error logs for patterns

This documentation provides a comprehensive overview of the Web Intelligence Platform's architecture, functionality, and operational aspects. It serves as both a technical reference and a guide for future development and maintenance activities.