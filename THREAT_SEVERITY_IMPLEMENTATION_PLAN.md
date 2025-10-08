# Enhanced Threat Severity Scoring System - Implementation Plan

## Required Drizzle Schema Updates

**IMPORTANT: Run these schema updates first before proceeding with the implementation**

### New Tables Structure

```typescript
import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, numeric, unique, primaryKey } from 'drizzle-orm/pg-core';

// =====================================================
// COMPANIES TABLE (replaces vendors and clients)
// =====================================================
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(), // For deduplication
  type: text('type'), // 'vendor', 'client', 'both', 'other'
  industry: text('industry'),
  description: text('description'),
  website: text('website'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found (if AI-discovered)
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // Additional flexible data
}, (table) => {
  return {
    normalizedIdx: index('companies_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_companies_name').on(table.name)
  };
});

// =====================================================
// SOFTWARE TABLE
// =====================================================
export const software = pgTable('software', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(), // For deduplication
  // Version removed - now tracked in junction tables
  companyId: uuid('company_id').references(() => companies.id),
  category: text('category'), // 'os', 'application', 'library', 'framework', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // CPE, additional identifiers, etc.
}, (table) => {
  return {
    unq: unique().on(table.normalizedName, table.companyId),
    normalizedIdx: index('software_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_software_name').on(table.name)
  };
});

// =====================================================
// HARDWARE TABLE
// =====================================================
export const hardware = pgTable('hardware', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(), // For deduplication
  model: text('model'),
  manufacturer: text('manufacturer'),
  category: text('category'), // 'router', 'iot', 'server', 'workstation', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    unq: unique().on(table.normalizedName, table.model, table.manufacturer),
    normalizedIdx: index('hardware_normalized_idx').on(table.normalizedName)
  };
});

// =====================================================
// THREAT ACTORS TABLE (AI-discovered only)
// =====================================================
export const threatActors = pgTable('threat_actors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(), // For deduplication
  aliases: text('aliases').array(), // Alternative names
  type: text('type'), // 'apt', 'ransomware', 'hacktivist', 'criminal', 'nation-state'
  origin: text('origin'), // Country/region of origin if known
  firstSeen: timestamp('first_seen'),
  description: text('description'),
  tactics: text('tactics').array(), // MITRE ATT&CK tactics
  targets: text('targets').array(), // Common target industries/countries
  createdAt: timestamp('created_at').defaultNow(),
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // Additional threat intelligence
}, (table) => {
  return {
    normalizedIdx: index('threat_actors_normalized_idx').on(table.normalizedName),
    nameIdx: index('idx_threat_actors_name').on(table.name),
    aliasesIdx: index('idx_threat_actors_aliases').on(table.aliases) // GIN index for array search
  };
});

// =====================================================
// USER ASSOCIATION TABLES
// =====================================================
export const usersSoftware = pgTable('users_software', {
  userId: uuid('user_id').notNull(), // references users.id
  softwareId: uuid('software_id').notNull().references(() => software.id),
  version: text('version'), // Specific version user is running
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  metadata: jsonb('metadata') // User-specific notes, deployment info, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.softwareId] }),
    userIdx: index('idx_users_software_user').on(table.userId)
  };
});

export const usersHardware = pgTable('users_hardware', {
  userId: uuid('user_id').notNull(), // references users.id
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  quantity: integer('quantity').default(1),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.hardwareId] }),
    userIdx: index('idx_users_hardware_user').on(table.userId)
  };
});

export const usersCompanies = pgTable('users_companies', {
  userId: uuid('user_id').notNull(), // references users.id
  companyId: uuid('company_id').notNull().references(() => companies.id),
  relationshipType: text('relationship_type'), // 'vendor', 'client', 'partner', etc.
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.companyId] }),
    userIdx: index('idx_users_companies_user').on(table.userId)
  };
});

// =====================================================
// ARTICLE ASSOCIATION TABLES
// =====================================================
export const articleSoftware = pgTable('article_software', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  softwareId: uuid('software_id').notNull().references(() => software.id),
  versionFrom: text('version_from'), // Start of version range affected (e.g., "2.14.0")
  versionTo: text('version_to'), // End of version range affected (e.g., "2.17.0")
  confidence: numeric('confidence', { precision: 3, scale: 2 }), // AI confidence 0.00-1.00
  context: text('context'), // Snippet where software was mentioned
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // Vulnerability details, patch info, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.softwareId] }),
    articleIdx: index('idx_article_software_article').on(table.articleId),
    softwareIdx: index('idx_article_software_software').on(table.softwareId)
  };
});

export const articleHardware = pgTable('article_hardware', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.hardwareId] }),
    articleIdx: index('idx_article_hardware_article').on(table.articleId),
    hardwareIdx: index('idx_article_hardware_hardware').on(table.hardwareId)
  };
});

export const articleCompanies = pgTable('article_companies', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  mentionType: text('mention_type'), // 'affected', 'vendor', 'client', 'mentioned'
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.companyId] }),
    articleIdx: index('idx_article_companies_article').on(table.articleId),
    companyIdx: index('idx_article_companies_company').on(table.companyId)
  };
});

export const articleCves = pgTable('article_cves', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  cveId: text('cve_id').notNull(), // references cve_data.cve_id
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // CVSS scores mentioned, exploit details, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.cveId] })
  };
});

export const articleThreatActors = pgTable('article_threat_actors', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  threatActorId: uuid('threat_actor_id').notNull().references(() => threatActors.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'), // Snippet where actor was mentioned
  activityType: text('activity_type'), // 'attributed', 'suspected', 'mentioned'
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // Campaign info, TTPs mentioned, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.threatActorId] }),
    articleIdx: index('idx_article_threat_actors_article').on(table.articleId),
    actorIdx: index('idx_article_threat_actors_actor').on(table.threatActorId)
  };
});

// =====================================================
// USER-SPECIFIC RELEVANCE SCORING TABLE
// =====================================================
export const articleRelevanceScore = pgTable('article_relevance_score', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => globalArticles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(), // references users.id
  
  // Relevance scoring components
  relevanceScore: numeric('relevance_score', { precision: 4, scale: 2 }), // 0.00-100.00
  softwareScore: numeric('software_score', { precision: 4, scale: 2 }), // Component score
  clientScore: numeric('client_score', { precision: 4, scale: 2 }), // Component score
  vendorScore: numeric('vendor_score', { precision: 4, scale: 2 }), // Component score
  hardwareScore: numeric('hardware_score', { precision: 4, scale: 2 }), // Component score
  keywordScore: numeric('keyword_score', { precision: 4, scale: 2 }), // Component score
  
  // Metadata for debugging and analysis
  matchedSoftware: text('matched_software').array(), // Software IDs that matched
  matchedCompanies: text('matched_companies').array(), // Company IDs that matched
  matchedHardware: text('matched_hardware').array(), // Hardware IDs that matched
  matchedKeywords: text('matched_keywords').array(), // Keywords that matched
  
  // Tracking
  calculatedAt: timestamp('calculated_at').defaultNow(),
  calculationVersion: text('calculation_version').default('1.0'),
  metadata: jsonb('metadata') // Additional scoring details
}, (table) => {
  return {
    // Unique constraint: one score per user-article combination
    unique: unique().on(table.articleId, table.userId),
    // Indexes for efficient queries
    userArticleIdx: index('idx_relevance_user_article').on(table.userId, table.articleId),
    articleScoreIdx: index('idx_relevance_article_score').on(table.articleId, table.relevanceScore),
    userScoreIdx: index('idx_relevance_user_score').on(table.userId, table.relevanceScore),
    articleDateIdx: index('article_date_idx').on(table.articleId, table.calculatedAt)
  };
});

// =====================================================
// UPDATED GLOBAL ARTICLES TABLE
// =====================================================
// NOTE: Add these columns and indexes to the existing globalArticles table definition
export const globalArticles = pgTable('global_articles', {
  // ... existing columns (id, sourceId, title, content, url, etc.) ...
  
  // Enhanced threat scoring fields
  // NOTE: Relevance scores stored separately in article_relevance_score table
  threatMetadata: jsonb('threat_metadata'), // Detailed scoring components
  threatSeverityScore: numeric('threat_severity_score', { precision: 4, scale: 2 }), // User-independent severity
  threatLevel: text('threat_level'), // 'low', 'medium', 'high', 'critical' - based on severity only
  
  // Attack vectors remain in main table (not entity-based)
  attackVectors: text('attack_vectors').array(),
  
  // Analysis tracking
  lastThreatAnalysis: timestamp('last_threat_analysis'),
  threatAnalysisVersion: text('threat_analysis_version'),
  entitiesExtracted: boolean('entities_extracted').default(false), // Track if entity extraction completed
  
  // Keep existing fields
  isCybersecurity: boolean('is_cybersecurity').default(false),
  securityScore: integer('security_score'), // Backward compatibility
  
  // ... rest of existing columns ...
}, (table) => {
  return {
    // ... existing indexes ...
    // Add these new indexes:
    severityIdx: index('idx_articles_severity').on(table.threatSeverityScore),
    threatLevelIdx: index('idx_articles_threat_level').on(table.threatLevel)
  };
});

// =====================================================
// ENTITY RESOLUTION CACHE TABLE
// =====================================================
export const entityResolutionCache = pgTable('entity_resolution_cache', {
  id: text('id').$defaultFn(() => ulid()).primaryKey(),
  inputName: text('input_name').notNull(),
  entityType: text('entity_type').notNull(), // 'company', 'software', etc.
  resolvedId: text('resolved_id'), // null if new entity
  canonicalName: text('canonical_name').notNull(),
  confidence: real('confidence').notNull(),
  aliases: text('aliases').array().notNull().default(sql`ARRAY[]::text[]`),
  reasoning: text('reasoning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull() // Cache expiry (30 days)
}, (table) => ({
  lookupIdx: index('entity_resolution_lookup_idx').on(
    table.inputName, 
    table.entityType
  ),
  expiryIdx: index('entity_resolution_expiry_idx').on(table.expiresAt)
}));
```

After adding these tables, run the migration:
```bash
# Generate migration files from Drizzle schemas
npx drizzle-kit generate

# Apply migrations to the database
npx drizzle-kit migrate
```

## Architecture Overview

### The Dual-Scoring Philosophy

This system implements a **two-dimensional threat assessment** that separates universal danger from personal impact:

#### **Severity Score (Universal) - "How dangerous is this threat?"**
- **Objective measurement** based on threat characteristics: CVE/CVSS scores, exploitability, impact scope, threat actor sophistication
- **Same for everyone** - A zero-day affecting Apache gets the same severity score whether you use Apache or not
- **Stored once** in `global_articles.threat_severity_score` 
- **Calculated synchronously** during article scraping (immediate enrichment)
- **Scale:** 0-100, mapped to 4-tier threat levels (Low, Medium, High, Critical)

#### **Relevance Score (Personal) - "How much does this affect MY environment?"**
- **User-specific measurement** based on YOUR tech stack: software versions, hardware, vendors, clients
- **Different per user** - Same Apache vulnerability scores high for Apache users, zero for others
- **Stored per user** in `article_relevance_score` table (one row per user-article pair)
- **Calculated asynchronously** on user login or tech stack changes (batch processing)
- **Scale:** 0-100, considering version matching, vendor relationships, priority weights

**Why separate them?** This allows users to see both "this is a critical threat" (severity) AND "it directly affects your systems" (relevance) - two essential but distinct perspectives for threat prioritization.

---

### Complete Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRAPING PHASE (Synchronous)                  │
└─────────────────────────────────────────────────────────────────┘
    RSS Article Scraped
           ↓
    [Global Scraper] AI flags as cybersecurity = true
           ↓
    [Article Processor] Extract article content
           ↓
    [EntityManager] AI extracts entities:
      • Software (with versions/ranges)
      • Hardware (with models)
      • Companies (vendors/clients)
      • CVEs (with CVSS)
      • Threat Actors (APTs, ransomware groups)
      • Attack Vectors
           ↓
    [Entity Resolution Service] Deduplicate with AI + 30-day cache:
      • "Microsoft" = "MSFT" = "MS" → Same entity
      • Check entity_resolution_cache for past decisions
      • Create new entities or link to existing
           ↓
    [ThreatAnalyzer] Calculate severity score (0-100):
      • Weight: 25% CVE severity + 20% exploitability + 20% impact
      • + 10% hardware impact + 10% attack vector + 10% threat actor
      • + 5% each: patch status, detection difficulty, recency
      • Handle partial data with confidence multipliers
           ↓
    Store in Database:
      • Article → global_articles (with threat_severity_score)
      • Entities → junction tables (article_software, article_hardware, etc.)
      • Cache → entity_resolution_cache

┌─────────────────────────────────────────────────────────────────┐
│              RELEVANCE PHASE (Asynchronous, Per User)            │
└─────────────────────────────────────────────────────────────────┘
    User logs in OR modifies tech stack
           ↓
    [RelevanceScorer] Batch process (up to 2000 articles):
      • Get user's tech stack (users_software, users_hardware, etc.)
      • For each article, match entities against user's stack
      • Version-aware matching (user's v2.15.0 ∈ article's 2.14-2.17 range)
      • Calculate relevance score with priority weights
      • Support soft matching for partial entity data
           ↓
    Store in article_relevance_score table:
      • One row per (user, article) pair
      • Includes matched entities, individual scores, total relevance
           ↓
    [Frontend] Display combined assessment:
      • Threat Level badge (severity-based)
      • Relevance indicators on user's tech stack
      • Expandable details with confidence/evidence meters
```

---

### Execution Timing Model

#### **Synchronous Operations (During Scraping)**
**What:** Entity extraction → Resolution → Severity scoring  
**When:** Immediately after article flagged as cybersecurity  
**Why:** Every article enriched and ready to display instantly  
**Trade-off:** Adds ~2-5 seconds to scraping per article, but ensures complete data

**Services involved:**
- `EntityManager.extractEntitiesFromArticle()` - AI entity extraction
- `EntityManager.findOrCreate*()` - Entity resolution with caching
- `ThreatAnalyzer.calculateSeverityScore()` - Severity calculation
- Database writes to junction tables and global_articles

#### **Asynchronous Operations (User-Triggered)**
**What:** Relevance score calculation  
**When:** User login, tech stack changes, or on-demand request  
**Why:** User-specific, can't pre-calculate for all users. Batched for efficiency  
**Trade-off:** Slight delay on first login, but cached thereafter

**Services involved:**
- `RelevanceScorer.batchCalculateRelevance()` - Batch processing
- `RelevanceScorer.calculateRelevanceScore()` - Individual article scoring
- Database writes to article_relevance_score table

**Batch Limits:**
- Max 2000 articles per batch (performance ceiling)
- Max 1 year of articles (relevance window)
- Older articles: on-demand via "Calculate Score" button

---

### Key Design Justifications

#### **Database Storage vs Runtime Calculation**

**✅ Chosen:** Pre-calculate and store scores in database tables  
**❌ Rejected:** Calculate scores on every page load or API request

**Rationale:**
- **Performance:** 2000 articles × complex scoring (entity matching, version checks, AI calls) = 10-30 second queries
- **Caching:** Pre-calculated scores retrieved in <100ms via indexed queries
- **Consistency:** Same score across all views/sessions until tech stack changes
- **Scalability:** Database handles concurrent users; runtime calculation doesn't

**Storage Locations:**
- Severity: `global_articles.threat_severity_score` (one per article)
- Relevance: `article_relevance_score` table (one per user-article pair)
- Update triggers: Article scraping (severity), user login/tech change (relevance)

#### **AI Entity Resolution with 30-Day Caching**

**✅ Chosen:** AI-powered entity matching + persistent cache  
**❌ Rejected:** Exact string matching or manual deduplication

**Rationale:**
- **Intelligence needed:** "Microsoft" = "MSFT" = "MS Corp" = "Microsoft Corporation" requires semantic understanding
- **Cost optimization:** Cache decisions for 30 days to avoid redundant AI calls
- **Accuracy:** AI handles abbreviations, typos, subsidiaries, acquisitions (e.g., "YouTube" → Google subsidiary)
- **Maintenance:** Self-improving through cached decisions and alias tracking

**Implementation:**
- `entity_resolution_cache` table: stores (input_name, entity_type) → (resolved_id, confidence)
- TTL: 30 days (balance between accuracy and cost)
- Confidence thresholds: 0.85 (companies/software), 0.75 (threat actors - more aliases)

#### **Version Tracking in Junction Tables**

**✅ Chosen:** Store versions in junction tables (article_software, users_software)  
**❌ Rejected:** Version as attribute in software table

**Rationale:**
- **Flexibility:** Same software (Apache HTTP) can have different versions per article
- **Accurate matching:** Article mentions "2.14.0-2.17.0" range, user runs "2.15.0" → Match detected
- **Historical tracking:** Multiple articles can reference different version ranges of same software
- **Normalization:** Software entities unique by (name, company), not version

**Schema:**
- `article_software`: version_from, version_to (ranges)
- `users_software`: version (specific version user runs)
- Matching logic handles: version ∈ [from, to] range checks

---

### Partial Data Handling Strategy

Real-world threat articles often lack complete information. This system gracefully handles incomplete data:

#### **Specificity Levels (Added to Entities)**
- **`specific`**: Full details (e.g., "Cisco Catalyst 9300 v16.12") → 100% weight
- **`partial`**: Some details (e.g., "Cisco Catalyst switches") → 65% weight  
- **`generic`**: Broad mention (e.g., "network routers") → 40% weight

#### **Confidence-Adjusted Scoring**
```
Final Score = Base Score × Specificity Multiplier × Confidence Multiplier

Specificity Multiplier:
  specific → 1.00
  partial  → 0.65
  generic  → 0.40

Confidence Multiplier:
  ≥0.60 → use confidence value
  <0.60 → use (confidence × 0.5) [heavy penalty]
```

#### **Soft Matching for Relevance**
**Example:** Article mentions "Cisco Routers" (no model/version)

- ✅ **Match IF:** User has ANY Cisco hardware + confidence ≥ 0.55
- ✅ **Match IF:** User lists "Cisco" as vendor + article category = hardware
- ❌ **No match:** Generic mention with confidence < 0.55
- **UI Badge:** 🟡 "May be relevant to Cisco devices"

**Example:** Article mentions "Amazon zero-day" (no specific service)

- ✅ **Match IF:** User lists Amazon as vendor/client + confidence ≥ 0.55
- ✅ **Match IF:** User has AWS services in tech stack
- **UI Badge:** 🟠 "Likely affects your Amazon infrastructure"

#### **Conservative Scoring Philosophy**
- **Default:** Missing data → Lower severity (cautious)
- **Exception:** Escalate if article contains: "zero-day", "actively exploited", "in-the-wild", "public exploit"
- **Threshold:** Entities with confidence <0.60 flagged for manual review, contribute reduced weight

---

### Performance Optimizations

#### **Caching Layers**
1. **Entity Resolution Cache:** 30-day TTL for AI deduplication decisions
2. **Pre-calculated Scores:** Severity and relevance stored, not recomputed
3. **Database Indexes:** All foreign keys + query columns indexed in Drizzle schema

#### **Batch Processing**
- **Entity Extraction:** Process software/hardware/companies/CVEs in parallel
- **Relevance Scoring:** Batch up to 100 articles at a time in loops
- **User Limits:** Max 2000 articles per relevance batch (bounded computation)

#### **Query Optimization**
- **Single Join Queries:** Fetch article + relevance score in one query
- **Pre-filtering:** Use EXISTS clauses before expensive scoring
- **Lazy Loading:** Calculate relevance only for articles user will view (1-year window)

#### **Index Strategy (Drizzle Schema)**
All indexes defined declaratively in schema (no manual SQL):
```typescript
// Example from article_software junction table
{
  articleIdx: index('article_software_article_idx').on(table.articleId),
  softwareIdx: index('article_software_software_idx').on(table.softwareId),
  versionIdx: index('article_software_version_idx').on(table.versionFrom, table.versionTo)
}
```

---

### Integration with Existing Scraper

**Minimal Disruption Design:**

1. **Hook Point:** After `is_cybersecurity = true` flag set in `processArticle()`
2. **Addition:** Call entity extraction + severity scoring as final enrichment step
3. **Backward Compatibility:** 
   - Existing `security_score` column still populated (severity × 10)
   - Old queries unchanged
   - New tables isolated from legacy schema
4. **Error Handling:** If entity extraction fails:
   - Article still saved with `is_cybersecurity = true`
   - `entities_extracted = false` flag set
   - Background job can retry later
   - Severity score defaults to null

**Integration Flow:**
```typescript
// Existing scraper: processArticle()
if (cyberAnalysis.isCybersecurity) {
  // ... existing code to save article ...
  
  // NEW: Entity extraction and scoring
  const entities = await entityManager.extractEntitiesFromArticle(newArticle);
  const severityAnalysis = await threatAnalyzer.calculateSeverityScore(newArticle, entities);
  
  await db.update(globalArticles)
    .set({
      threatSeverityScore: severityAnalysis.severityScore,
      threatLevel: severityAnalysis.threatLevel,
      entitiesExtracted: true
    });
}
```

**No Breaking Changes:**
- Existing threat tracker queries work as-is
- New relevance features opt-in (user must configure tech stack)
- Gradual rollout: old articles can be backfilled with "Calculate Score" button

## Implementation Overview

This enhanced threat severity scoring system will:
1. Extract entities (software, hardware, companies, CVEs, threat actors) into normalized tables
2. Calculate **severity scores** based on threat characteristics (stored in DB)
3. Calculate **relevance scores** per user in batches (stored in DB):
   - When a user loads application frontend, on per user basis
   - When user changes technology stack
   - On-demand for older articles
4. Display combined threat assessment to users
5. Maintain high performance through database storage and batch processing

## Processing Workflow

```
Article marked as is_cybersecurity=true
↓
Extract structured data (CVEs, vendors, software, etc.)
↓
Score each component using AI + pattern matching
↓
Calculate weighted severity scores using rubric formulas
↓
Store all metadata in database
↓
Generate relevance score when a user loads application frontend, on per user basis, or when they modify their tech stack keywords
↓
Display appropriate threat severity and relevance level to users on article cards
```

## Detailed Implementation Steps

### Step 1: Entity Management Services

**File:** `backend/services/entity-manager.ts` (new file)

This service handles all entity extraction and management:

```typescript
export class EntityManager {
  
  async extractEntitiesFromArticle(article: GlobalArticle): Promise<ExtractedEntities> {
    // Use AI to extract all entities including threat actors
    const entities = await extractArticleEntities({
      title: article.title,
      content: article.content,
      url: article.url
    });
    
    return {
      software: entities.software,
      hardware: entities.hardware,
      companies: entities.companies,
      cves: entities.cves,
      threatActors: entities.threatActors, // Now handled separately
      attackVectors: entities.attackVectors  // Stays in main article table
    };
  }
  
  async findOrCreateSoftware(data: SoftwareData): Promise<string> {
    // Check if software exists with same name and company
    let software = await db.select()
      .from(softwareTable)
      .where(and(
        eq(softwareTable.name, data.name),
        data.companyId ? eq(softwareTable.companyId, data.companyId) : isNull(softwareTable.companyId)
      ))
      .limit(1);
    
    // Create if doesn't exist
    if (software.length === 0) {
      const [newSoftware] = await db.insert(softwareTable)
        .values({
          name: data.name,
          // Version removed - now tracked in junction tables
          companyId: data.companyId,
          category: data.category,
          description: data.description,
          createdBy: data.createdBy,
          discoveredFrom: data.discoveredFrom,
          isVerified: data.isVerified || false,
          metadata: data.metadata
        })
        .returning();
      return newSoftware.id;
    }
    
    return software[0].id;
  }
  
  async findOrCreateCompany(data: CompanyData): Promise<string> {
    // Check if company exists by name (case-insensitive)
    let company = await db.select()
      .from(companiesTable)
      .where(ilike(companiesTable.name, data.name))
      .limit(1);
    
    // Create if not found
    if (company.length === 0) {
      const [newCompany] = await db.insert(companiesTable)
        .values({
          name: data.name,
          type: data.type,
          industry: data.industry,
          website: data.website,
          createdBy: data.createdBy,
          discoveredFrom: data.discoveredFrom,
          isVerified: data.isVerified || false,
          metadata: data.metadata
        })
        .returning();
      return newCompany.id;
    }
    
    return company[0].id;
  }
  
  async findOrCreateHardware(data: HardwareData): Promise<string> {
    // Check if hardware exists with same name, model, and manufacturer
    let hardware = await db.select()
      .from(hardwareTable)
      .where(and(
        eq(hardwareTable.name, data.name),
        data.model ? eq(hardwareTable.model, data.model) : isNull(hardwareTable.model),
        data.manufacturer ? eq(hardwareTable.manufacturer, data.manufacturer) : isNull(hardwareTable.manufacturer)
      ))
      .limit(1);
    
    // Create if not found
    if (hardware.length === 0) {
      const [newHardware] = await db.insert(hardwareTable)
        .values({
          name: data.name,
          model: data.model,
          manufacturer: data.manufacturer,
          category: data.category,
          description: data.description,
          createdBy: data.createdBy,
          discoveredFrom: data.discoveredFrom,
          isVerified: data.isVerified || false,
          metadata: data.metadata
        })
        .returning();
      return newHardware.id;
    }
    
    return hardware[0].id;
  }
  
  async findOrCreateThreatActor(data: ThreatActorData): Promise<string> {
    // Check if threat actor exists by name
    let actor = await db.select()
      .from(threatActors)
      .where(eq(threatActors.name, data.name))
      .limit(1);
    
    if (actor.length === 0) {
      // Check aliases for existing actor
      actor = await db.select()
        .from(threatActors)
        .where(sql`${data.name} = ANY(${threatActors.aliases})`)
        .limit(1);
    }
    
    // Create if doesn't exist
    if (actor.length === 0) {
      const [newActor] = await db.insert(threatActors)
        .values({
          name: data.name,
          aliases: data.aliases,
          type: data.type,
          origin: data.origin,
          description: data.description,
          discoveredFrom: data.articleId,
          metadata: data.metadata
        })
        .returning();
      return newActor.id;
    }
    
    // Update aliases if we have new ones
    if (data.aliases?.length > 0) {
      const currentAliases = actor[0].aliases || [];
      const newAliases = [...new Set([...currentAliases, ...data.aliases])];
      if (newAliases.length > currentAliases.length) {
        await db.update(threatActors)
          .set({ aliases: newAliases })
          .where(eq(threatActors.id, actor[0].id));
      }
    }
    
    return actor[0].id;
  }
  
  async linkArticleToEntities(articleId: string, entities: ExtractedEntities): Promise<void> {
    // Process all entity types in parallel for efficiency
    await Promise.all([
      // Link software
      this.linkArticleToSoftware(articleId, entities.software),
      
      // Link hardware
      this.linkArticleToHardware(articleId, entities.hardware),
      
      // Link companies
      this.linkArticleToCompanies(articleId, entities.companies),
      
      // Link CVEs
      this.linkArticleToCVEs(articleId, entities.cves),
      
      // Link threat actors
      this.linkArticleToThreatActors(articleId, entities.threatActors)
    ]);
  }
  
  async linkArticleToSoftware(articleId: string, softwareList: SoftwareExtraction[]) {
    for (const sw of softwareList) {
      // Find or create company if vendor is specified
      let companyId = null;
      if (sw.vendor) {
        companyId = await this.findOrCreateCompany({
          name: sw.vendor,
          type: 'vendor',
          discoveredFrom: articleId
        });
      }
      
      // Find or create software (without version - now tracked in junction)
      const softwareId = await this.findOrCreateSoftware({
        name: sw.name,
        companyId,
        category: sw.category,
        discoveredFrom: articleId
      });
      
      // Link to article with version range information
      await db.insert(articleSoftware)
        .values({
          articleId,
          softwareId,
          versionFrom: sw.versionFrom || sw.version, // Single version or range start
          versionTo: sw.versionTo || sw.version, // Single version or range end
          confidence: sw.confidence,
          context: sw.context,
          metadata: sw.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToHardware(articleId: string, hardwareList: HardwareExtraction[]) {
    for (const hw of hardwareList) {
      const hardwareId = await this.findOrCreateHardware({
        name: hw.name,
        model: hw.model,
        manufacturer: hw.manufacturer,
        category: hw.category,
        discoveredFrom: articleId
      });
      
      await db.insert(articleHardware)
        .values({
          articleId,
          hardwareId,
          confidence: hw.confidence,
          context: hw.context,
          metadata: hw.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToCompanies(articleId: string, companiesList: CompanyExtraction[]) {
    for (const company of companiesList) {
      const companyId = await this.findOrCreateCompany({
        name: company.name,
        type: company.type,
        discoveredFrom: articleId
      });
      
      await db.insert(articleCompanies)
        .values({
          articleId,
          companyId,
          mentionType: company.type,
          confidence: company.confidence,
          context: company.context,
          metadata: company.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToCVEs(articleId: string, cveList: CVEExtraction[]) {
    for (const cve of cveList) {
      // Check if CVE exists in cve_data table (optional)
      const existingCve = await db.select()
        .from(cveData)
        .where(eq(cveData.cveId, cve.id))
        .limit(1);
      
      // Link to article (even if not in cve_data table yet)
      await db.insert(articleCves)
        .values({
          articleId,
          cveId: cve.id,
          confidence: cve.confidence,
          context: cve.context,
          metadata: { 
            cvss: cve.cvss,
            inCveDatabase: existingCve.length > 0 
          }
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToThreatActors(articleId: string, actors: ThreatActorExtraction[]) {
    for (const actor of actors) {
      const actorId = await this.findOrCreateThreatActor({
        name: actor.name,
        type: actor.type,
        aliases: actor.aliases,
        articleId
      });
      
      await db.insert(articleThreatActors)
        .values({
          articleId,
          threatActorId: actorId,
          confidence: actor.confidence,
          context: actor.context,
          activityType: actor.activityType,
          metadata: actor.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async getUserEntities(userId: string): Promise<UserEntities> {
    // Get all software, hardware, companies associated with user
    const [software, hardware, companies] = await Promise.all([
      db.select({
        id: softwareTable.id,
        name: softwareTable.name,
        version: usersSoftware.version, // Version from junction table
        company: companiesTable.name,
        priority: usersSoftware.priority
      })
        .from(usersSoftware)
        .innerJoin(softwareTable, eq(usersSoftware.softwareId, softwareTable.id))
        .leftJoin(companiesTable, eq(softwareTable.companyId, companiesTable.id))
        .where(and(
          eq(usersSoftware.userId, userId),
          eq(usersSoftware.isActive, true)
        )),
      
      db.select({
        id: hardwareTable.id,
        name: hardwareTable.name,
        model: hardwareTable.model,
        manufacturer: hardwareTable.manufacturer,
        priority: usersHardware.priority
      })
        .from(usersHardware)
        .innerJoin(hardwareTable, eq(usersHardware.hardwareId, hardwareTable.id))
        .where(and(
          eq(usersHardware.userId, userId),
          eq(usersHardware.isActive, true)
        )),
      
      db.select({
        id: companiesTable.id,
        name: companiesTable.name,
        type: companiesTable.type,
        relationshipType: usersCompanies.relationshipType,
        priority: usersCompanies.priority
      })
        .from(usersCompanies)
        .innerJoin(companiesTable, eq(usersCompanies.companyId, companiesTable.id))
        .where(and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.isActive, true)
        ))
    ]);
    
    return { software, hardware, companies };
  }
}
```

### Step 2: Update OpenAI Integration for Entity Extraction

**File:** `backend/services/openai.ts`

Add new comprehensive entity extraction function:

```typescript
export async function extractArticleEntities(article: {
  title: string;
  content: string;
  url?: string;
}): Promise<{
  software: Array<{
    name: string;
    version?: string; // Single version if no range
    versionFrom?: string; // Start of version range
    versionTo?: string; // End of version range
    vendor?: string;
    category?: string;
    specificity: 'generic' | 'partial' | 'specific'; // NEW: How specific is this mention?
    confidence: number;
    context: string;
  }>;
  hardware: Array<{
    name: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    specificity: 'generic' | 'partial' | 'specific'; // NEW: How specific is this mention?
    confidence: number;
    context: string;
  }>;
  companies: Array<{
    name: string;
    type: 'vendor' | 'client' | 'affected' | 'mentioned';
    specificity: 'generic' | 'specific'; // NEW: Is this a broad mention or specific reference?
    confidence: number;
    context: string;
  }>;
  cves: Array<{
    id: string;
    cvss?: string;
    confidence: number;
    context: string;
  }>;
  threatActors: Array<{
    name: string;
    type?: 'apt' | 'ransomware' | 'hacktivist' | 'criminal' | 'nation-state' | 'unknown';
    aliases?: string[];
    activityType?: 'attributed' | 'suspected' | 'mentioned';
    confidence: number;
    context: string;
  }>;
  attackVectors: string[];
}> {
  const prompt = `
    Analyze this article and extract ALL mentioned entities with high precision.
    
    **IMPORTANT: Extract PARTIAL entities too - don't skip mentions just because they lack details.**
    
    For SOFTWARE, extract:
    - Product names (e.g., "Windows 10", "Apache Log4j 2.14.1")
    - Versions if specified - distinguish between:
      * Single versions (e.g., "version 2.14.1")
      * Version ranges (e.g., "versions 2.14.0 through 2.17.0", "2.x before 2.17.1")
    - For ranges, extract versionFrom (start) and versionTo (end)
    - Vendor/company that makes it
    - Category (os, application, library, framework, etc.)
    - Specificity level:
      * "generic" - Broad mention (e.g., "Microsoft products", "routers", "cloud services")
      * "partial" - Some details (e.g., "Cisco Catalyst switches", "Apache web server")
      * "specific" - Full details (e.g., "Cisco Catalyst 9300 v16.12", "Apache HTTP Server 2.4.49")
    - The sentence/context where mentioned
    
    For HARDWARE, extract:
    - Device names/models (e.g., "Cisco ASA 5500", "Netgear R7000")
    - Manufacturer
    - Category (router, iot, server, workstation, etc.)
    - Specificity level:
      * "generic" - Broad mention (e.g., "routers", "IoT devices", "network equipment")
      * "partial" - Brand/series (e.g., "Cisco routers", "Netgear devices")
      * "specific" - Exact model (e.g., "Cisco ASA 5500-X", "Netgear R7000")
    - The context where mentioned
    
    For COMPANIES, extract:
    - Company names and classify as:
      - vendor (makes products/services)
      - client (affected organization)
      - affected (impacted by issue)
      - mentioned (referenced but not directly affected)
    - Specificity level:
      * "generic" - Broad mention (e.g., "cloud providers", "tech companies")
      * "specific" - Named entity (e.g., "Amazon", "Microsoft Azure")
    
    For CVEs, extract:
    - CVE identifiers (format: CVE-YYYY-NNNNN)
    - CVSS scores if mentioned
    - Context of the vulnerability
    
    For THREAT ACTORS, extract:
    - Actor/group names (e.g., "APT28", "Lazarus Group", "LockBit")
    - Type (apt, ransomware, hacktivist, criminal, nation-state)
    - Any aliases mentioned
    - Activity type (attributed, suspected, mentioned)
    - Context where mentioned
    
    Also identify:
    - Attack vectors used (network, email, physical, supply chain, etc.)
    
    Be very precise - only extract entities explicitly mentioned, not implied.
    Include confidence score (0-1) for each extraction.
    
    Article Title: ${article.title}
    Article Content: ${article.content}
    
    Return as structured JSON with this exact format:
    {
      "software": [
        {
          "name": "product name",
          "version": "single version if not a range",
          "versionFrom": "start of range (e.g., 2.14.0)",
          "versionTo": "end of range (e.g., 2.17.0)",
          "vendor": "company that makes it",
          "category": "category type",
          "specificity": "generic|partial|specific",
          "confidence": 0.95,
          "context": "sentence where mentioned"
        }
      ],
      "hardware": [
        {
          "name": "device name",
          "model": "model number",
          "manufacturer": "company name",
          "category": "device type",
          "specificity": "generic|partial|specific",
          "confidence": 0.9,
          "context": "sentence where mentioned"
        }
      ],
      "companies": [
        {
          "name": "company name",
          "type": "vendor|client|affected|mentioned",
          "specificity": "generic|specific",
          "confidence": 0.85,
          "context": "sentence where mentioned"
        }
      ],
      "cves": [
        {
          "id": "CVE-YYYY-NNNNN",
          "cvss": "score if mentioned",
          "confidence": 1.0,
          "context": "sentence where mentioned"
        }
      ],
      "threatActors": [
        {
          "name": "actor name",
          "type": "apt|ransomware|etc",
          "aliases": ["alias1", "alias2"],
          "activityType": "attributed|suspected|mentioned",
          "confidence": 0.9,
          "context": "sentence where mentioned"
        }
      ],
      "attackVectors": ["vector1", "vector2"]
    }
  `;
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity analyst extracting entities from articles with high precision. Only extract entities that are explicitly mentioned in the text."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo-preview", // Use GPT-4 for better entity recognition
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 4000
    });
    
    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent || responseContent.trim() === '') {
      console.error('Empty response from OpenAI API in extractArticleEntities');
      return {
        software: [],
        hardware: [],
        companies: [],
        cves: [],
        threatActors: [],
        attackVectors: []
      };
    }
    
    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse JSON response from OpenAI:', parseError);
      console.error('Response content:', responseContent);
      return {
        software: [],
        hardware: [],
        companies: [],
        cves: [],
        threatActors: [],
        attackVectors: []
      };
    }
    
    // Validate and normalize the response
    return {
      software: Array.isArray(result.software) ? result.software : [],
      hardware: Array.isArray(result.hardware) ? result.hardware : [],
      companies: Array.isArray(result.companies) ? result.companies : [],
      cves: Array.isArray(result.cves) ? result.cves : [],
      threatActors: Array.isArray(result.threatActors) ? result.threatActors : [],
      attackVectors: Array.isArray(result.attackVectors) ? result.attackVectors : []
    };
    
  } catch (error) {
    console.error('Error extracting entities with OpenAI:', error);
    // Return empty arrays if extraction fails
    return {
      software: [],
      hardware: [],
      companies: [],
      cves: [],
      threatActors: [],
      attackVectors: []
    };
  }
}
```

### Step 3: AI Entity Resolution Service

**File:** `backend/services/openai.ts`

Add dedicated entity resolution function for deduplication:

```typescript
/**
 * AI-powered entity resolution to match new entities against existing ones
 * Handles variations, abbreviations, typos, and aliases
 */
export async function resolveEntity(
  newName: string,
  existingEntities: Array<{
    id: string;
    name: string; 
    aliases?: string[];
  }>,
  entityType: 'company' | 'software' | 'hardware' | 'threat_actor'
): Promise<{
  matchedId: string | null;
  canonicalName: string;
  confidence: number;
  aliases: string[];
  reasoning: string;
}> {
  const prompt = `
    Determine if the new ${entityType} name matches any existing entities.
    
    New name: "${newName}"
    
    Existing entities:
    ${existingEntities.map(e => `- ID: ${e.id}, Name: ${e.name}${e.aliases ? `, Aliases: ${e.aliases.join(', ')}` : ''}`).join('\n')}
    
    Consider:
    - Abbreviations (e.g., MSFT → Microsoft, GCP → Google Cloud Platform)
    - Common variations (e.g., MS → Microsoft, Chrome → Google Chrome)
    - Subsidiaries and acquisitions (e.g., YouTube → Google subsidiary)
    - Typos and common misspellings
    - Different legal entity suffixes (Inc, Corp, Ltd, LLC)
    - Version-less references (e.g., "Windows" matches "Windows 10")
    ${entityType === 'threat_actor' ? '- Known APT group aliases and campaign names' : ''}
    ${entityType === 'software' ? '- Product suite relationships (Office 365 → Microsoft Office)' : ''}
    
    Return a JSON object with:
    {
      "matchedId": "existing entity ID if match found, null if new entity",
      "canonicalName": "most official/common form of the name",
      "confidence": 0.0 to 1.0 confidence in the match,
      "aliases": ["list", "of", "known", "variations"],
      "reasoning": "brief explanation of the decision"
    }
    
    Be conservative - only match if confidence is high. When in doubt, treat as new entity.
  `;
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an entity resolution expert specializing in cybersecurity entities. Your job is to accurately determine if entities are the same while avoiding false matches."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for consistent matching
      max_tokens: 1000
    });
    
    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      matchedId: result.matchedId || null,
      canonicalName: result.canonicalName || newName,
      confidence: result.confidence || 0,
      aliases: result.aliases || [],
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error in entity resolution:', error);
    // Fallback to treating as new entity
    return {
      matchedId: null,
      canonicalName: newName,
      confidence: 0,
      aliases: [],
      reasoning: 'Error in resolution, treating as new entity'
    };
  }
}
```

**Updated EntityManager findOrCreate methods:**

```typescript
export class EntityManager {
  private readonly RESOLUTION_CONFIDENCE_THRESHOLD = 0.85;
  private readonly CACHE_DURATION_DAYS = 30;
  
  async findOrCreateCompany(data: {
    name: string;
    type?: string;
    articleId?: string;
  }): Promise<string> {
    // Check cache first
    const cached = await this.getCachedResolution(data.name, 'company');
    if (cached) {
      if (cached.resolvedId) return cached.resolvedId;
      // Cached as new entity, create with canonical name
      return this.createCompany({
        ...data,
        name: cached.canonicalName
      });
    }
    
    // Get top existing companies for comparison
    const existingCompanies = await db.select({
      id: companiesTable.id,
      name: companiesTable.name
    })
    .from(companiesTable)
    .limit(50); // Get reasonable sample for comparison
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      data.name,
      existingCompanies,
      'company'
    );
    
    // Cache the resolution
    await this.cacheResolution(data.name, 'company', resolution);
    
    // Use matched entity or create new
    if (resolution.matchedId && resolution.confidence >= this.RESOLUTION_CONFIDENCE_THRESHOLD) {
      return resolution.matchedId;
    }
    
    // Create new company with canonical name
    const [company] = await db.insert(companiesTable)
      .values({
        name: resolution.canonicalName,
        type: data.type,
        normalizedName: this.normalize(resolution.canonicalName)
      })
      .returning({ id: companiesTable.id });
    
    // Store original name as alias if different
    if (data.name !== resolution.canonicalName) {
      await this.addAlias(company.id, 'company', data.name);
    }
    
    return company.id;
  }
  
  private async getCachedResolution(
    inputName: string, 
    entityType: string
  ): Promise<ResolutionResult | null> {
    const [cached] = await db.select()
      .from(entityResolutionCache)
      .where(and(
        eq(entityResolutionCache.inputName, this.normalize(inputName)),
        eq(entityResolutionCache.entityType, entityType),
        gt(entityResolutionCache.expiresAt, new Date())
      ))
      .limit(1);
    
    return cached || null;
  }
  
  private async cacheResolution(
    inputName: string,
    entityType: string,
    resolution: ResolutionResult
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CACHE_DURATION_DAYS);
    
    await db.insert(entityResolutionCache)
      .values({
        inputName: this.normalize(inputName),
        entityType,
        resolvedId: resolution.matchedId,
        canonicalName: resolution.canonicalName,
        confidence: resolution.confidence,
        aliases: resolution.aliases,
        reasoning: resolution.reasoning,
        expiresAt
      })
      .onConflictDoNothing(); // Avoid duplicates
  }
  
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }
  
  async findOrCreateSoftware(data: {
    name: string;
    companyId?: string;
    category?: string;
  }): Promise<string> {
    // Check cache first
    const cached = await this.getCachedResolution(data.name, 'software');
    if (cached && cached.resolvedId) {
      return cached.resolvedId;
    }
    
    // Build query with optional company filter
    let query = db.select({
      id: softwareTable.id,
      name: softwareTable.name
    }).from(softwareTable);
    
    if (data.companyId) {
      query = query.where(eq(softwareTable.companyId, data.companyId));
    }
    
    const existingSoftware = await query.limit(50);
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      data.name,
      existingSoftware,
      'software'
    );
    
    // Cache the resolution
    await this.cacheResolution(data.name, 'software', resolution);
    
    // Use matched entity or create new
    if (resolution.matchedId && resolution.confidence >= this.RESOLUTION_CONFIDENCE_THRESHOLD) {
      return resolution.matchedId;
    }
    
    // Create new software with canonical name
    const [software] = await db.insert(softwareTable)
      .values({
        name: resolution.canonicalName,
        companyId: data.companyId,
        category: data.category,
        normalizedName: this.normalize(resolution.canonicalName)
      })
      .returning({ id: softwareTable.id });
    
    return software.id;
  }
  
  async findOrCreateHardware(data: {
    name: string;
    model?: string;
    manufacturer?: string;
    category?: string;
  }): Promise<string> {
    const lookupName = data.model || data.name;
    
    // Check cache
    const cached = await this.getCachedResolution(lookupName, 'hardware');
    if (cached && cached.resolvedId) {
      return cached.resolvedId;
    }
    
    // Get existing hardware for comparison
    const existingHardware = await db.select({
      id: hardwareTable.id,
      name: hardwareTable.name
    })
    .from(hardwareTable)
    .limit(50);
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      lookupName,
      existingHardware,
      'hardware'
    );
    
    // Cache the resolution
    await this.cacheResolution(lookupName, 'hardware', resolution);
    
    // Use matched entity or create new
    if (resolution.matchedId && resolution.confidence >= this.RESOLUTION_CONFIDENCE_THRESHOLD) {
      return resolution.matchedId;
    }
    
    // Create new hardware with canonical name
    const [hardware] = await db.insert(hardwareTable)
      .values({
        name: resolution.canonicalName,
        model: data.model,
        manufacturer: data.manufacturer,
        category: data.category,
        normalizedName: this.normalize(resolution.canonicalName)
      })
      .returning({ id: hardwareTable.id });
    
    return hardware.id;
  }
  
  async findOrCreateThreatActor(data: {
    name: string;
    type?: string;
    aliases?: string[];
    articleId?: string;
  }): Promise<string> {
    // Check cache
    const cached = await this.getCachedResolution(data.name, 'threat_actor');
    if (cached && cached.resolvedId) {
      return cached.resolvedId;
    }
    
    // Get existing threat actors with their aliases
    const existingActors = await db.select({
      id: threatActorsTable.id,
      name: threatActorsTable.name,
      aliases: threatActorsTable.aliases
    })
    .from(threatActorsTable)
    .limit(100); // More samples for threat actors due to many aliases
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      data.name,
      existingActors,
      'threat_actor'
    );
    
    // Cache the resolution
    await this.cacheResolution(data.name, 'threat_actor', resolution);
    
    // Use matched entity or create new
    if (resolution.matchedId && resolution.confidence >= 0.75) { // Lower threshold for threat actors
      // Update aliases if we have new ones
      if (data.aliases && data.aliases.length > 0) {
        await this.updateThreatActorAliases(resolution.matchedId, data.aliases);
      }
      return resolution.matchedId;
    }
    
    // Combine aliases from AI and data
    const allAliases = [...new Set([
      ...(resolution.aliases || []),
      ...(data.aliases || [])
    ])];
    
    // Create new threat actor with canonical name
    const [actor] = await db.insert(threatActorsTable)
      .values({
        name: resolution.canonicalName,
        type: data.type,
        aliases: allAliases,
        normalizedName: this.normalize(resolution.canonicalName),
        firstSeenAt: new Date(),
        metadata: {
          originalName: data.name,
          createdFromArticle: data.articleId
        }
      })
      .returning({ id: threatActorsTable.id });
    
    return actor.id;
  }
  
  private async updateThreatActorAliases(actorId: string, newAliases: string[]) {
    const [existing] = await db.select()
      .from(threatActorsTable)
      .where(eq(threatActorsTable.id, actorId))
      .limit(1);
    
    if (existing) {
      const combinedAliases = [...new Set([
        ...(existing.aliases || []),
        ...newAliases
      ])];
      
      await db.update(threatActorsTable)
        .set({ aliases: combinedAliases })
        .where(eq(threatActorsTable.id, actorId));
    }
  }
}
```

### Step 4: User-Specific Relevance Scoring with Database Storage

**File:** `backend/apps/threat-tracker/services/relevance-scorer.ts`

```typescript
export class RelevanceScorer {
  private readonly MAX_BATCH_SIZE = 2000;
  private readonly MAX_AGE_DAYS = 365; // 1 year
  
  /**
   * Batch calculate and store relevance scores for new articles
   * Called when user logs in or changes technology stack
   */
  async batchCalculateRelevance(
    userId: string,
    options?: { 
      forceRecalculate?: boolean; // For tech stack changes
      articleIds?: string[]; // Specific articles to calculate
    }
  ): Promise<void> {
    // Get user's current technology stack
    const userEntities = await this.getUserEntities(userId);
    
    // Find articles that need scoring
    const articlesToScore = await this.getArticlesNeedingScores(userId, options);
    
    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < articlesToScore.length; i += batchSize) {
      const batch = articlesToScore.slice(i, i + batchSize);
      await this.processBatch(batch, userId, userEntities);
    }
  }
  
  /**
   * Get articles that need relevance scores
   */
  private async getArticlesNeedingScores(
    userId: string,
    options?: { forceRecalculate?: boolean; articleIds?: string[] }
  ): Promise<Article[]> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (options?.articleIds) {
      // Specific articles requested (e.g., for one-off scoring)
      return db.select()
        .from(globalArticles)
        .where(and(
          inArray(globalArticles.id, options.articleIds),
          eq(globalArticles.isCybersecurity, true)
        ))
        .limit(this.MAX_BATCH_SIZE);
    }
    
    if (options?.forceRecalculate) {
      // Tech stack changed - recalculate all scores within limits
      return db.select()
        .from(globalArticles)
        .where(and(
          eq(globalArticles.isCybersecurity, true),
          gte(globalArticles.publishedAt, oneYearAgo)
        ))
        .orderBy(desc(globalArticles.publishedAt))
        .limit(this.MAX_BATCH_SIZE);
    }
    
    // Normal case - only calculate missing scores
    return db.select()
      .from(globalArticles)
      .leftJoin(
        articleRelevanceScore,
        and(
          eq(articleRelevanceScore.articleId, globalArticles.id),
          eq(articleRelevanceScore.userId, userId)
        )
      )
      .where(and(
        eq(globalArticles.isCybersecurity, true),
        gte(globalArticles.publishedAt, oneYearAgo),
        isNull(articleRelevanceScore.id) // No existing score
      ))
      .orderBy(desc(globalArticles.publishedAt))
      .limit(this.MAX_BATCH_SIZE);
  }
  
  /**
   * Process a batch of articles and calculate relevance scores
   */
  private async processBatch(
    articles: Article[], 
    userId: string, 
    userEntities: UserEntities
  ): Promise<void> {
    const scores = [];
    
    for (const article of articles) {
      const score = await this.calculateRelevanceScore(article.id, userId, userEntities);
      scores.push({
        articleId: article.id,
        userId,
        relevanceScore: score.total,
        softwareScore: score.software,
        clientScore: score.client,
        vendorScore: score.vendor,
        hardwareScore: score.hardware,
        keywordScore: score.keyword,
        matchedSoftware: score.matchedSoftware,
        matchedCompanies: score.matchedCompanies,
        matchedHardware: score.matchedHardware,
        matchedKeywords: score.matchedKeywords,
        calculatedAt: new Date(),
        calculationVersion: '1.0',
        metadata: score.metadata
      });
    }
    
    // Bulk insert/update scores
    if (scores.length > 0) {
      await db.insert(articleRelevanceScore)
        .values(scores)
        .onConflictDoUpdate({
          target: [articleRelevanceScore.articleId, articleRelevanceScore.userId],
          set: {
            relevanceScore: excluded.relevanceScore,
            softwareScore: excluded.softwareScore,
            clientScore: excluded.clientScore,
            vendorScore: excluded.vendorScore,
            hardwareScore: excluded.hardwareScore,
            keywordScore: excluded.keywordScore,
            matchedSoftware: excluded.matchedSoftware,
            matchedCompanies: excluded.matchedCompanies,
            matchedHardware: excluded.matchedHardware,
            matchedKeywords: excluded.matchedKeywords,
            calculatedAt: excluded.calculatedAt,
            calculationVersion: excluded.calculationVersion,
            metadata: excluded.metadata
          }
        });
    }
  }
  
  /**
   * Calculate relevance score for a single article
   * Used both in batch processing and one-off calculations
   */
  async calculateRelevanceScore(
    articleId: string, 
    userId: string, 
    userEntities?: UserEntities
  ): Promise<RelevanceScoreResult> {
    // Get user entities if not provided
    if (!userEntities) {
      userEntities = await this.getUserEntities(userId);
    }
    
    // Get article's entities
    const articleEntities = await this.getArticleEntities(articleId);
    
    // Calculate component scores
    const scores = {
      software: this.scoreSoftwareRelevance(articleEntities.software, userEntities.software),
      client: this.scoreClientRelevance(articleEntities.companies, userEntities.companies),
      vendor: this.scoreVendorRelevance(articleEntities.companies, userEntities.companies),
      hardware: this.scoreHardwareRelevance(articleEntities.hardware, userEntities.hardware),
      keyword: await this.scoreKeywordActivity(articleId, userId)
    };
    
    // Apply rubric weights
    const totalScore = (
      (0.25 * scores.software) +
      (0.25 * scores.client) +
      (0.20 * scores.vendor) +
      (0.15 * scores.hardware) +
      (0.15 * scores.keyword)
    );
    
    return {
      total: totalScore,
      ...scores,
      matchedSoftware: this.getMatchedIds(articleEntities.software, userEntities.software),
      matchedCompanies: this.getMatchedIds(articleEntities.companies, userEntities.companies),
      matchedHardware: this.getMatchedIds(articleEntities.hardware, userEntities.hardware),
      matchedKeywords: await this.getMatchedKeywords(articleId, userId),
      metadata: {
        userEntityCounts: {
          software: userEntities.software.length,
          companies: userEntities.companies.length,
          hardware: userEntities.hardware.length
        },
        articleEntityCounts: {
          software: articleEntities.software.length,
          companies: articleEntities.companies.length,
          hardware: articleEntities.hardware.length
        }
      }
    };
  }
  
  /**
   * Handle one-off score generation for old articles
   */
  async generateOneOffScore(articleId: string, userId: string): Promise<void> {
    await this.batchCalculateRelevance(userId, { articleIds: [articleId] });
  }
  
  /**
   * Trigger recalculation when tech stack changes
   */
  async onTechStackChange(userId: string): Promise<void> {
    // Delete existing scores to force recalculation
    await db.delete(articleRelevanceScore)
      .where(eq(articleRelevanceScore.userId, userId));
    
    // Recalculate scores with current tech stack
    await this.batchCalculateRelevance(userId, { forceRecalculate: true });
  }
  
  /**
   * Efficient single query to get all relevance data
   */
  private async getRelevanceData(articleId: string, userId: string) {
    // Use a single complex query with CTEs for efficiency
    const result = await db.execute(sql`
      WITH user_software AS (
        SELECT s.*, us.priority
        FROM users_software us
        JOIN software s ON s.id = us.software_id
        WHERE us.user_id = ${userId} AND us.is_active = true
      ),
      user_hardware AS (
        SELECT h.*, uh.priority
        FROM users_hardware uh
        JOIN hardware h ON h.id = uh.hardware_id
        WHERE uh.user_id = ${userId} AND uh.is_active = true
      ),
      user_companies AS (
        SELECT c.*, uc.relationship_type, uc.priority
        FROM users_companies uc
        JOIN companies c ON c.id = uc.company_id
        WHERE uc.user_id = ${userId} AND uc.is_active = true
      )
      SELECT 
        -- Software matches
        (SELECT json_agg(json_build_object(
          'match_type', CASE 
            WHEN us.id = s.id THEN 'exact'
            WHEN us.company_id = s.company_id THEN 'same_vendor'
            WHEN us.category = s.category THEN 'same_category'
            ELSE 'none'
          END,
          'priority', us.priority,
          'name', s.name
        ))
        FROM article_software ars
        JOIN software s ON s.id = ars.software_id
        LEFT JOIN user_software us ON us.id = s.id
        WHERE ars.article_id = ${articleId}
        ) as software_matches,
        
        -- Hardware matches
        (SELECT json_agg(json_build_object(
          'match_type', CASE 
            WHEN uh.id = h.id THEN 'exact'
            WHEN uh.manufacturer = h.manufacturer THEN 'same_manufacturer'
            WHEN uh.category = h.category THEN 'same_category'
            ELSE 'none'
          END,
          'priority', uh.priority,
          'name', h.name
        ))
        FROM article_hardware arh
        JOIN hardware h ON h.id = arh.hardware_id
        LEFT JOIN user_hardware uh ON uh.id = h.id
        WHERE arh.article_id = ${articleId}
        ) as hardware_matches,
        
        -- Company matches (clients and vendors)
        (SELECT json_agg(json_build_object(
          'match_type', CASE 
            WHEN uc.company_id = c.id THEN 'exact'
            ELSE 'none'
          END,
          'relationship_type', uc.relationship_type,
          'priority', uc.priority,
          'name', c.name,
          'mention_type', arc.mention_type
        ))
        FROM article_companies arc
        JOIN companies c ON c.id = arc.company_id
        LEFT JOIN user_companies uc ON uc.company_id = c.id
        WHERE arc.article_id = ${articleId}
        ) as company_matches
    `);
    
    return this.parseRelevanceQueryResult(result);
  }
  
  /**
   * Calculate software relevance score based on matches
   * NOW WITH SOFT MATCHING for partial entity data
   */
  private scoreSoftwareRelevance(
    matches: SoftwareMatch[],
    articleSoftware: Array<{ specificity: string; confidence: number }>
  ): number {
    if (!matches || matches.length === 0) return 0;
    
    let maxScore = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const entityData = articleSoftware[i];
      
      let score = 0;
      switch (match.match_type) {
        case 'exact':
          score = 10;
          break;
        case 'same_vendor':
          score = 7;
          break;
        case 'same_category':
          score = 4;
          break;
        default:
          score = 0;
      }
      
      // SOFT MATCH HANDLING
      if (entityData) {
        // Apply specificity dampening
        if (entityData.specificity === 'partial') {
          score *= 0.70; // 70% weight for partial matches
        } else if (entityData.specificity === 'generic') {
          // Generic matches only count if confidence is decent
          if (entityData.confidence >= 0.55) {
            score *= 0.45; // 45% weight for generic but confident
          } else {
            score = 0; // Too vague and low confidence - skip
          }
        }
        
        // Confidence threshold: Below 0.55 significantly reduces score
        if (entityData.confidence < 0.55) {
          score *= 0.3;
        }
      }
      
      // Apply user priority weight (0.5 to 1.5 multiplier)
      if (match.priority) {
        score *= (0.5 + (match.priority / 100));
      }
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10); // Cap at 10
  }
  
  /**
   * Determine match badge type based on specificity and confidence
   * Used for UI display
   */
  private getMatchBadgeType(
    specificity: 'generic' | 'partial' | 'specific',
    confidence: number
  ): 'confirmed' | 'likely' | 'possible' {
    if (specificity === 'specific' && confidence >= 0.80) {
      return 'confirmed'; // 🔴 High confidence, full details
    } else if (specificity === 'partial' || (specificity === 'specific' && confidence >= 0.60)) {
      return 'likely'; // 🟠 Medium confidence or partial details
    } else {
      return 'possible'; // 🟡 Low confidence or generic mention
    }
  }
  
}
```

### Step 5: Optimized Query Strategies for Articles with Relevance

**File:** `backend/apps/threat-tracker/queries/threat-tracker.ts`

```typescript
/**
 * Get articles with pre-calculated relevance scores for a specific user
 * Relevance scores are retrieved from the article_relevance_score table
 */
export async function getArticlesWithRelevance(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    minSeverity?: number;
    sortBy?: 'severity' | 'relevance' | 'date';
  } = {}
): Promise<ArticleWithRelevance[]> {
  const { limit = 50, offset = 0, minSeverity = 0, sortBy = 'relevance' } = options;
  
  // Join articles with pre-calculated relevance scores
  const query = db
    .select({
      article: globalArticles,
      relevanceData: articleRelevanceScore
    })
    .from(globalArticles)
    .leftJoin(
      articleRelevanceScore,
      and(
        eq(articleRelevanceScore.articleId, globalArticles.id),
        eq(articleRelevanceScore.userId, userId)
      )
    )
    .where(and(
      eq(globalArticles.isCybersecurity, true),
      gte(globalArticles.threatSeverityScore, minSeverity)
    ));
  
  // Apply sorting based on user preference
  if (sortBy === 'relevance') {
    query.orderBy(
      desc(articleRelevanceScore.relevanceScore),
      desc(globalArticles.threatSeverityScore)
    );
  } else if (sortBy === 'severity') {
    query.orderBy(
      desc(globalArticles.threatSeverityScore),
      desc(articleRelevanceScore.relevanceScore)
    );
  } else {
    query.orderBy(desc(globalArticles.publishedAt));
  }
  
  const results = await query.limit(limit).offset(offset);
  
  // Transform results to include relevance score
  return results.map(row => ({
    ...row.article,
    relevanceScore: row.relevanceData?.relevanceScore || 0,
    softwareScore: row.relevanceData?.softwareScore || 0,
    clientScore: row.relevanceData?.clientScore || 0,
    vendorScore: row.relevanceData?.vendorScore || 0,
    hardwareScore: row.relevanceData?.hardwareScore || 0,
    keywordScore: row.relevanceData?.keywordScore || 0,
    matchedSoftware: row.relevanceData?.matchedSoftware || [],
    matchedCompanies: row.relevanceData?.matchedCompanies || [],
    matchedHardware: row.relevanceData?.matchedHardware || [],
    matchedKeywords: row.relevanceData?.matchedKeywords || []
  }));
}

```

### Step 6: Severity Scoring Implementation (User-Independent)

**File:** `backend/services/threat-analysis.ts`

```typescript
export class ThreatAnalyzer {
  
  /**
   * Calculate severity score based ONLY on threat characteristics
   * This is user-independent and stored in the database
   */
  async calculateSeverityScore(
    article: GlobalArticle,
    entities: ExtractedEntities
  ): Promise<SeverityAnalysis> {
    
    // Get all severity components from the article
    const components = await this.extractSeverityComponents(article, entities);
    
    // Score each component (0-10) based on rubric
    const scores = {
      cvss_severity: await this.scoreCVSSSeverity(entities.cves),
      exploitability: await this.scoreExploitability(article, entities),
      impact: await this.scoreImpact(article, entities),
      hardware_impact: await this.scoreHardwareImpact(entities.hardware),
      attack_vector: await this.scoreAttackVector(article.attackVectors),
      threat_actor_use: await this.scoreThreatActorUse(entities.threatActors),
      patch_status: await this.scorePatchStatus(article, entities),
      detection_difficulty: await this.scoreDetectionDifficulty(article),
      recency: this.scoreRecency(article.publishDate),
      system_criticality: await this.scoreSystemCriticality(entities)
    };
    
    // Apply rubric formula for severity
    const severityScore = (
      (0.25 * scores.cvss_severity) +
      (0.20 * scores.exploitability) +
      (0.20 * scores.impact) +
      (0.10 * scores.hardware_impact) +
      (0.10 * scores.attack_vector) +
      (0.10 * scores.threat_actor_use) +
      (0.05 * scores.patch_status) +
      (0.05 * scores.detection_difficulty) +
      (0.05 * scores.recency) +
      (0.10 * scores.system_criticality)
    ) / 1.20; // Normalize by total weight
    
    // Determine threat level based on severity alone
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (severityScore >= 9.0) threatLevel = 'critical';
    else if (severityScore >= 7.0) threatLevel = 'high';
    else if (severityScore >= 4.0) threatLevel = 'medium';
    else threatLevel = 'low';
    
    return {
      severityScore,
      threatLevel,
      metadata: {
        severity_components: scores,
        calculation_version: '2.0',
        calculated_at: new Date()
      }
    };
  }
  
  private async scoreThreatActorUse(threatActors: ThreatActorExtraction[]): Promise<number> {
    if (!threatActors || threatActors.length === 0) return 0;
    
    let maxScore = 0;
    for (const actor of threatActors) {
      let score = 0;
      
      // Check actor type and sophistication
      switch (actor.type) {
        case 'nation-state':
          score = 9;
          break;
        case 'apt':
          score = 8;
          break;
        case 'ransomware':
          score = 7;
          break;
        case 'criminal':
          score = 6;
          break;
        case 'hacktivist':
          score = 5;
          break;
        default:
          score = 3;
      }
      
      // Adjust based on activity type
      if (actor.activityType === 'attributed') {
        score += 1; // Confirmed attribution
      } else if (actor.activityType === 'suspected') {
        score -= 0.5; // Suspected only
      }
      
      // Weight by confidence
      score *= actor.confidence || 1;
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
  
  // ===== PARTIAL DATA HANDLING =====
  
  /**
   * Handles scoring when only partial entity information is available
   * Applies confidence-adjusted multipliers based on specificity level
   */
  private applyPartialDataMultiplier(
    baseScore: number,
    specificity: 'generic' | 'partial' | 'specific',
    confidence: number
  ): number {
    // Specificity multipliers
    const specificityMultiplier = {
      'specific': 1.0,    // Full details → 100% weight
      'partial': 0.65,    // Some details → 65% weight
      'generic': 0.40     // Broad mention → 40% weight
    }[specificity];
    
    // Confidence threshold: Low confidence entities contribute less
    const confidenceMultiplier = confidence >= 0.6 ? confidence : confidence * 0.5;
    
    return baseScore * specificityMultiplier * confidenceMultiplier;
  }
  
  /**
   * Software impact scoring with partial data handling
   * Examples:
   * - "Apache 2.4.49" (specific) → Full score
   * - "Apache web server" (partial) → Dampened score
   * - "web servers" (generic) → Heuristic base score only
   */
  private async scoreSoftwareImpact(
    software: Array<{
      name: string;
      specificity: 'generic' | 'partial' | 'specific';
      confidence: number;
      version?: string;
    }>
  ): Promise<number> {
    if (!software || software.length === 0) return 0;
    
    let maxScore = 0;
    
    for (const item of software) {
      let baseScore = 5; // Default mid-range score
      
      // Increase score if version info available (indicates specific vulnerability)
      if (item.version) {
        baseScore = 7;
      }
      
      // Apply partial data multiplier
      const adjustedScore = this.applyPartialDataMultiplier(
        baseScore,
        item.specificity,
        item.confidence
      );
      
      maxScore = Math.max(maxScore, adjustedScore);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Conservative severity scoring strategy:
   * - Missing data → Lower severity unless corroborating evidence exists
   * - Confidence < 0.6 → Flag for manual review, reduced weight
   * - Explicit exploit activity or zero-day → Can escalate despite missing details
   */
  private shouldEscalatePartialData(article: GlobalArticle, entities: ExtractedEntities): boolean {
    const escalationKeywords = [
      'zero-day', '0-day', 'actively exploited', 'in-the-wild',
      'proof-of-concept', 'poc available', 'public exploit'
    ];
    
    const contentLower = (article.content || '').toLowerCase();
    return escalationKeywords.some(keyword => contentLower.includes(keyword));
  }
}
```

---

## 📊 PARTIAL DATA HANDLING STRATEGY

### **Confidence Thresholds Per Entity Type**

| Entity Type | Minimum Confidence | Full Weight Threshold | Notes |
|------------|-------------------|----------------------|-------|
| **CVE** | 0.85 | 0.90 | Must be certain—no false alarms |
| **Software + Version** | 0.80 | 0.85 | Version info critical for relevance |
| **Software (no version)** | 0.70 | 0.80 | Broader match acceptable |
| **Hardware** | 0.75 | 0.85 | Model specificity matters |
| **Vendor/Company** | 0.55 | 0.70 | Broader matching OK for awareness |
| **Threat Actor** | 0.75 | 0.85 | Attribution needs confidence |

### **Specificity-Based Weight Multipliers**

```typescript
// Applied to severity component scores based on entity specificity
const SPECIFICITY_WEIGHTS = {
  'specific': 1.00,   // Full details (e.g., "Cisco Catalyst 9300 v16.12") → 100% weight
  'partial': 0.65,    // Some details (e.g., "Cisco Catalyst switches") → 65% weight  
  'generic': 0.40     // Broad mention (e.g., "network routers") → 40% weight
};
```

### **Relevance Matching with Partial Data**

**Soft Match Logic:**

1. **Generic Vendor Mention** (e.g., "Cisco Routers" - no version/model)
   - ✅ **Match IF:** User has ANY Cisco hardware + confidence ≥ 0.55
   - ✅ **Match IF:** User lists "Cisco" as vendor + article category = hardware/infrastructure
   - ❌ **Don't match:** Cisco mentioned in passing (confidence < 0.55)
   - **Badge:** 🟡 "May be relevant to Cisco devices"

2. **Generic Service Mention** (e.g., "Amazon zero-day" - no specific service)
   - ✅ **Match IF:** User lists Amazon as vendor/client + confidence ≥ 0.55
   - ✅ **Match IF:** User has AWS services in tech stack + cloud category
   - ❌ **Don't match:** Generic Amazon mention without security context
   - **Badge:** 🟠 "Likely affects your Amazon infrastructure"

3. **CVE without Product**
   - ❌ **Don't trigger** on standalone CVE if no product mapped
   - ✅ **Allow reverse lookup:** Check CVE database metadata (NVD) for affected products
   - If products found in CVE metadata → Create soft match with medium confidence

4. **Partial Software Match** (e.g., "Apache" - no version)
   - ✅ **Match IF:** User has Apache (any version) + confidence ≥ 0.70
   - **Badge:** 🟠 "May affect Apache HTTP (version TBD)"

### **Conservative vs Warning Strategy**

**Default: Conservative Scoring**
- Missing entities → Lower severity components
- Incomplete data → Reduced weight multipliers
- Below threshold confidence (<0.6) → Flag for review

**Exception: Escalate Despite Missing Data**
- Article contains explicit exploit activity indicators:
  - "zero-day", "actively exploited", "in-the-wild"
  - "proof-of-concept available", "public exploit"
- Corroborating threat actor attribution (high sophistication)
- Multiple CVEs mentioned (pattern of widespread impact)

---

### Step 7: Article Processing Pipeline Update

---

## 🔄 INTEGRATION POINT: When & Where Entity Extraction and Scoring Happens

**CRITICAL TIMING:** All entity extraction and severity scoring happens **synchronously during the article scraping/saving process**. This ensures every cybersecurity article is immediately analyzed and scored before being shown to users.

### **Execution Flow in the Scraper:**

```
1. Article Scraped from RSS Feed
   ↓
2. AI determines is_cybersecurity = true
   ↓
3. Article saved to global_articles table (initial save)
   ↓
4. [IMMEDIATE] Extract entities using AI
   - Software (with version ranges)
   - Hardware
   - Companies (vendors/clients)
   - CVEs
   - Threat Actors
   - Attack Vectors
   ↓
5. [IMMEDIATE] Resolve entities (find or create in database)
   - Check entity_resolution_cache for known variations
   - Create new entities if needed
   - Link to article via junction tables
   ↓
6. [IMMEDIATE] Calculate severity score (user-independent)
   - Analyze CVE scores
   - Check exploitability
   - Assess impact
   - Evaluate threat actors
   - Calculate weighted score
   ↓
7. [IMMEDIATE] Update article with severity data
   - threatSeverityScore (0-100)
   - threatLevel (low/medium/high/critical)
   - threatMetadata (detailed breakdown)
   - entitiesExtracted = true
   ↓
8. Article now complete and ready for users

[LATER] Relevance scoring happens separately:
   - When user logs in (batch process for new articles)
   - When user modifies tech stack
   - On-demand for older articles
```

### **Performance Considerations:**

- **Parallel processing**: Entity types processed concurrently
- **Cached AI decisions**: Entity resolution uses 30-day cache
- **Batch operations**: Database inserts batched where possible
- **Non-blocking**: Scraper can continue with next article

### **Error Handling:**

If entity extraction fails:
- Article still saved with is_cybersecurity=true
- entitiesExtracted remains false
- Background job can retry later
- Severity score defaults to null

---

**File:** `backend/apps/threat-tracker/services/background-jobs.ts`

```typescript
async function processArticle(
  articleUrl: string,
  source: any,
  htmlStructure: any,
) {
  // ... existing article extraction code ...
  
  if (cyberAnalysis.isCybersecurity) {
    // Extract all entities including threat actors
    const entities = await extractArticleEntities({
      title: articleData.title,
      content: articleData.content,
      url: articleUrl
    });
    
    // Store the article first
    const newArticle = await storage.createArticle({
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: articleUrl,
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      isCybersecurity: true,
      attackVectors: entities.attackVectors, // Store directly in article
      entitiesExtracted: false,
      userId: undefined,
    });
    
    const entityManager = new EntityManager();
    
    // Process all entity types including threat actors
    await Promise.all([
      // Software processing
      processSoftwareEntities(newArticle.id, entities.software, entityManager),
      
      // Hardware processing
      processHardwareEntities(newArticle.id, entities.hardware, entityManager),
      
      // Company processing
      processCompanyEntities(newArticle.id, entities.companies, entityManager),
      
      // CVE processing
      processCVEEntities(newArticle.id, entities.cves),
      
      // Threat actor processing (NEW)
      entityManager.linkArticleToThreatActors(newArticle.id, entities.threatActors)
    ]);
    
    // Calculate severity score (user-independent)
    const threatAnalyzer = new ThreatAnalyzer();
    const severityAnalysis = await threatAnalyzer.calculateSeverityScore(
      newArticle,
      entities
    );
    
    // Update article with severity score (NOT relevance - that's calculated per user)
    await db.update(globalArticles)
      .set({
        threatMetadata: severityAnalysis.metadata,
        threatSeverityScore: severityAnalysis.severityScore,
        threatLevel: severityAnalysis.threatLevel, // Based on severity only
        entitiesExtracted: true,
        lastThreatAnalysis: new Date(),
        threatAnalysisVersion: '2.0',
        securityScore: Math.round(severityAnalysis.severityScore * 10) // Backward compatibility
      })
      .where(eq(globalArticles.id, newArticle.id));
    
    log(
      `[Global ThreatTracker] Processed article with severity score: ${severityAnalysis.severityScore.toFixed(2)} (${severityAnalysis.threatLevel})`,
      "scraper"
    );
    log(
      `[Global ThreatTracker] Extracted: ${entities.software.length} software, ` +
      `${entities.hardware.length} hardware, ${entities.companies.length} companies, ` +
      `${entities.cves.length} CVEs, ${entities.threatActors.length} threat actors`,
      "scraper"
    );
  }
}
```

### Step 8: Frontend Display Updates

**File:** `frontend/src/pages/dashboard/threat-tracker/components/threat-article-card.tsx`

Update the existing threat-article-card component to display the new scoring system:

#### 1. Threat Level Badge Color Function

```tsx
const getThreatLevelColor = (level: string) => {
  switch(level) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};
```

#### 2. Threat Score Display

Repurpose the existing threat severity and relevance scales on the card:

```tsx
<div className="flex items-center gap-2">
  <span className={`px-2 py-1 rounded ${getThreatLevelColor(article.threatLevel)}`}>
    {article.threatLevel?.toUpperCase()}
  </span>
  <span className="text-sm text-gray-600">
    Severity: {article.threatSeverityScore?.toFixed(1)}/10
  </span>
</div>
```

#### 3. Detailed Threat Information with Partial Data Indicators

Add an expandable section showing extracted metadata **with confidence/evidence indicators**:

```tsx
// Expandable section showing:
<Collapsible>
  <CollapsibleTrigger>
    View Threat Details
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="space-y-2 mt-2">
      {/* Evidence Completeness Meter */}
      {article.threatMetadata?.entityCompleteness && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Evidence Completeness</span>
            <span className="font-medium">{article.threatMetadata.entityCompleteness.score}/5</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full" 
              style={{ width: `${(article.threatMetadata.entityCompleteness.score / 5) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {article.threatMetadata.entityCompleteness.missing?.length > 0 && (
              <>Missing: {article.threatMetadata.entityCompleteness.missing.join(', ')}</>
            )}
          </div>
        </div>
      )}
      
      {/* CVEs list */}
      {article.cves?.length > 0 && (
        <div>
          <strong>CVEs:</strong> {article.cves.join(', ')}
        </div>
      )}
      
      {/* Affected software/vendors WITH CONFIDENCE BADGES */}
      {article.affectedSoftware?.length > 0 && (
        <div>
          <strong>Affected Software:</strong>
          <div className="flex flex-wrap gap-2 mt-1">
            {article.affectedSoftware.map((sw, i) => {
              const badge = getMatchBadgeForEntity(sw);
              return (
                <Tooltip key={i}>
                  <TooltipTrigger>
                    <Badge 
                      variant={badge.variant}
                      className="cursor-help"
                    >
                      {badge.icon} {sw.name}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium">{badge.label}</div>
                      <div>Confidence: {(sw.confidence * 100).toFixed(0)}%</div>
                      <div>Specificity: {sw.specificity}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Attack vectors */}
      {article.attackVectors?.length > 0 && (
        <div>
          <strong>Attack Vectors:</strong> {article.attackVectors.join(', ')}
        </div>
      )}
      
      {/* Threat actors */}
      {article.threatActors?.length > 0 && (
        <div>
          <strong>Threat Actors:</strong> {article.threatActors.join(', ')}
        </div>
      )}
      
      {/* Partial Data Warning */}
      {article.threatMetadata?.hasPartialData && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-amber-800">
            Some threat details are incomplete or uncertain. Review article for full context.
          </span>
        </div>
      )}
      
      {/* Mitigation status */}
      {article.patchAvailable && (
        <div className="text-green-600">
          <strong>Status:</strong> Patch Available
        </div>
      )}
    </div>
  </CollapsibleContent>
</Collapsible>

{/* Helper function for badge display */}
function getMatchBadgeForEntity(entity: { 
  specificity: string; 
  confidence: number 
}): { 
  icon: string; 
  variant: string; 
  label: string 
} {
  if (entity.specificity === 'specific' && entity.confidence >= 0.80) {
    return { 
      icon: '🔴', 
      variant: 'destructive', 
      label: 'Confirmed impact' 
    };
  } else if (entity.specificity === 'partial' || (entity.specificity === 'specific' && entity.confidence >= 0.60)) {
    return { 
      icon: '🟠', 
      variant: 'default', 
      label: 'Likely affects this' 
    };
  } else {
    return { 
      icon: '🟡', 
      variant: 'secondary', 
      label: 'May be relevant' 
    };
  }
}
```

#### 4. Technology Stack Threat Indicators (Inline Badges)

**File:** `frontend/src/pages/dashboard/threat-tracker/tech-stack.tsx`

```tsx
// Component for displaying tech item with inline threat indicator
function TechStackItem({ 
  item, 
  type 
}: { 
  item: TechItem; 
  type: 'software' | 'hardware' | 'vendor' | 'client' 
}) {
  const threatBadge = item.threatCount > 0 ? getThreatBadge(item.threatLevel, item.threatCount) : null;
  
  return (
    <div 
      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
      data-testid={`${type}-item-${item.id}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">{item.name}</span>
        {item.version && (
          <span className="text-sm text-gray-500">v{item.version}</span>
        )}
      </div>
      
      {/* Inline threat indicator - only shows if affected */}
      {threatBadge && (
        <Link 
          href={`/threat-tracker?filter=${type}:${item.id}`}
          className="flex items-center gap-2"
          data-testid={`threat-indicator-${item.id}`}
        >
          <Badge 
            variant={threatBadge.variant}
            className="cursor-pointer hover:opacity-80"
          >
            {threatBadge.icon} {item.threatCount} {threatBadge.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      )}
      
      <button 
        onClick={() => removeItem(item.id)}
        data-testid={`button-remove-${type}-${item.id}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function getThreatBadge(level: string, count: number) {
  switch(level) {
    case 'critical':
      return { icon: '🔴', label: 'Critical threats', variant: 'destructive' };
    case 'high':
      return { icon: '🟠', label: 'High threats', variant: 'default' };
    case 'medium':
      return { icon: '🟡', label: 'Medium threats', variant: 'secondary' };
    case 'low':
      return { icon: '🟢', label: 'Low threats', variant: 'outline' };
    default:
      return null;
  }
}
```

### Step 9: Performance Optimization Strategies

**File:** `backend/apps/threat-tracker/services/performance-optimizer.ts`

```typescript
export class PerformanceOptimizer {
  
  /**
   * Ensure all active users have up-to-date relevance scores
   * Run this as a background job periodically
   */
  async updateRelevanceScores(activeUserIds: string[]) {
    const scorer = new RelevanceScorer();
    
    // Process each user's missing scores
    for (const userId of activeUserIds) {
      await scorer.batchCalculateRelevance(userId);
    }
  }
  
  // Note: All database indexes are defined in the Drizzle schema (Step 1)
  // No manual index creation is needed or allowed
}
```

## Database Query Optimization Guidelines

### For Best Performance:

1. **Use Batch Queries**: When displaying multiple articles, fetch relevance in batches
2. **Batch Processing**: Process relevance scores in batches during login or tech stack changes
3. **Pre-filter**: Use EXISTS queries to pre-filter articles before calculating relevance
4. **Index Properly**: Ensure all foreign keys and frequently queried columns are indexed
5. **Limit Calculations**: Only calculate relevance for articles user will actually see

### Query Patterns:

```sql
-- Fast pattern: Pre-filter with EXISTS
SELECT * FROM global_articles a
WHERE EXISTS (
  SELECT 1 FROM article_software ars
  JOIN users_software us ON us.software_id = ars.software_id
  WHERE ars.article_id = a.id AND us.user_id = ?
)

-- Avoid: Calculating relevance for all articles
-- Instead: Calculate only for top N severity articles or recent articles
```

## Testing Strategy

### Unit Tests:
```typescript
describe('Severity Scoring', () => {
  test('severity score is user-independent', async () => {
    const article = await createTestArticle();
    const user1Score = await calculateSeverityScore(article);
    const user2Score = await calculateSeverityScore(article);
    expect(user1Score).toBe(user2Score);
  });
});

describe('Relevance Scoring', () => {
  test('relevance score is user-specific', async () => {
    const article = await createTestArticle();
    await scorer.batchCalculateRelevance(user1.id, { articleIds: [article.id] });
    await scorer.batchCalculateRelevance(user2.id, { articleIds: [article.id] });
    
    const user1Score = await db.select()
      .from(articleRelevanceScore)
      .where(and(
        eq(articleRelevanceScore.articleId, article.id),
        eq(articleRelevanceScore.userId, user1.id)
      ));
    
    const user2Score = await db.select()
      .from(articleRelevanceScore)
      .where(and(
        eq(articleRelevanceScore.articleId, article.id),
        eq(articleRelevanceScore.userId, user2.id)
      ));
    
    expect(user1Score[0].relevanceScore).not.toBe(user2Score[0].relevanceScore);
  });
  
  test('relevance is stored in database per user', async () => {
    const article = await createTestArticle();
    await scorer.batchCalculateRelevance(user1.id, { articleIds: [article.id] });
    
    const storedScore = await db.select()
      .from(articleRelevanceScore)
      .where(and(
        eq(articleRelevanceScore.articleId, article.id),
        eq(articleRelevanceScore.userId, user1.id)
      ))
      .limit(1);
    
    expect(storedScore.length).toBe(1);
    expect(storedScore[0].relevanceScore).toBeDefined();
    expect(storedScore[0].articleId).toBe(article.id);
    expect(storedScore[0].userId).toBe(user1.id);
  });
});
```

### Step 10: User Interface - Keywords Page & Technology Stack Page

This final step implements the new user-facing configuration pages for managing threat monitoring preferences.

---

#### A. Keywords Page Updates

**File:** `frontend/src/pages/dashboard/threat-tracker/keywords.tsx`

**Changes:** Simplify to only handle **Threat Keywords** and **Threat Actors** (remove hardware/software/vendors/clients)

```tsx
export default function KeywordsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Threat Keyword Management</h2>
        <p className="text-gray-600">
          Manage keywords for threat monitoring across security categories
        </p>
      </div>

      {/* Threat Keywords Section */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Keywords</CardTitle>
          <CardDescription>
            Keywords related to cybersecurity threats (e.g., malware, breach, zero-day)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Search & add threat keywords..." 
                data-testid="input-threat-keyword"
              />
              <Button data-testid="button-add-keyword">
                + Add
              </Button>
            </div>
            
            {/* Keyword list */}
            <div className="flex flex-wrap gap-2">
              {threatKeywords.map(keyword => (
                <Badge 
                  key={keyword.id} 
                  variant="secondary"
                  data-testid={`badge-keyword-${keyword.id}`}
                >
                  {keyword.text}
                  <button 
                    className="ml-2"
                    data-testid={`button-remove-keyword-${keyword.id}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Threat Actors Section (Read-only, AI-populated) */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Actors</CardTitle>
          <CardDescription>
            APT groups, ransomware gangs, and threat actors automatically detected from articles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {threatActors.map(actor => (
              <div 
                key={actor.id}
                className="flex items-center justify-between p-2 border rounded"
                data-testid={`threat-actor-${actor.id}`}
              >
                <div>
                  <div className="font-medium">{actor.name}</div>
                  {actor.aliases?.length > 0 && (
                    <div className="text-sm text-gray-500">
                      Also known as: {actor.aliases.join(', ')}
                    </div>
                  )}
                </div>
                <Badge variant="outline" data-testid={`badge-actor-type-${actor.id}`}>
                  {actor.type}
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            ℹ️ Threat actors are automatically extracted from articles using AI
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

#### B. Technology Stack Page (NEW)

**File:** `frontend/src/pages/dashboard/threat-tracker/tech-stack.tsx`

**Design:** Unified configuration with inline threat indicators

```tsx
export default function TechStackPage() {
  const { data: techStack, isLoading } = useQuery({
    queryKey: ['/api/tech-stack'],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Technology Stack</h2>
        <p className="text-gray-600">
          Configure your software, hardware, vendors, and clients for personalized threat monitoring
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Software Section */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <ChevronDown className="h-4 w-4" />
              <h3 className="text-lg font-semibold">
                Software ({techStack?.software?.length || 0})
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Search software..." 
                  data-testid="input-search-software"
                />
                <Button data-testid="button-add-software">+ Add</Button>
              </div>
              
              {techStack?.software?.map(item => (
                <TechStackItem
                  key={item.id}
                  item={item}
                  type="software"
                  data-testid={`software-item-${item.id}`}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-6" />

          {/* Hardware Section */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <ChevronDown className="h-4 w-4" />
              <h3 className="text-lg font-semibold">
                Hardware ({techStack?.hardware?.length || 0})
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Search hardware..." 
                  data-testid="input-search-hardware"
                />
                <Button data-testid="button-add-hardware">+ Add</Button>
              </div>
              
              {techStack?.hardware?.map(item => (
                <TechStackItem
                  key={item.id}
                  item={item}
                  type="hardware"
                  data-testid={`hardware-item-${item.id}`}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-6" />

          {/* Vendors Section */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <ChevronDown className="h-4 w-4" />
              <h3 className="text-lg font-semibold">
                Vendors ({techStack?.vendors?.length || 0})
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Search vendors..." 
                  data-testid="input-search-vendors"
                />
                <Button data-testid="button-add-vendor">+ Add</Button>
              </div>
              
              {techStack?.vendors?.map(item => (
                <TechStackItem
                  key={item.id}
                  item={item}
                  type="vendor"
                  data-testid={`vendor-item-${item.id}`}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-6" />

          {/* Clients Section */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <ChevronDown className="h-4 w-4" />
              <h3 className="text-lg font-semibold">
                Clients ({techStack?.clients?.length || 0})
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Search clients..." 
                  data-testid="input-search-clients"
                />
                <Button data-testid="button-add-client">+ Add</Button>
              </div>
              
              {techStack?.clients?.map(item => (
                <TechStackItem
                  key={item.id}
                  item={item}
                  type="client"
                  data-testid={`client-item-${item.id}`}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}

// Reusable component for tech stack items with threat indicators
function TechStackItem({ item, type }: { item: TechStackItemType; type: string }) {
  const getThreatColor = (level: string) => {
    switch(level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getThreatLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  return (
    <div 
      className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded"
      data-testid={`tech-item-${item.id}`}
    >
      <div className="flex items-center gap-2">
        <span data-testid={`text-item-name-${item.id}`}>• {item.name}</span>
        {item.version && (
          <span className="text-gray-500" data-testid={`text-item-version-${item.id}`}>
            | {item.version}
          </span>
        )}
      </div>

      {/* Threat indicator - only shows if threats exist */}
      {item.threats && item.threats.count > 0 && (
        <button
          onClick={() => {
            // Navigate to threats page with filter or open modal
            window.location.href = `/dashboard/threat-tracker?filter=${type}:${item.id}`;
          }}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          data-testid={`button-threat-indicator-${item.id}`}
        >
          <span 
            className={`w-3 h-3 rounded-full ${getThreatColor(item.threats.highestLevel)}`}
            data-testid={`indicator-threat-${item.id}`}
          />
          <span className="text-sm" data-testid={`text-threat-count-${item.id}`}>
            {item.threats.count} {getThreatLabel(item.threats.highestLevel)} threats
          </span>
        </button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeTechItem(item.id, type)}
        data-testid={`button-remove-${item.id}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

---

#### C. API Endpoints for Tech Stack

**File:** `backend/apps/threat-tracker/routes/tech-stack.ts`

```typescript
// GET /api/tech-stack - Fetch user's tech stack with threat counts
router.get('/tech-stack', async (req, res) => {
  const userId = req.user.id;
  
  // Fetch software with threat counts
  const software = await db
    .select({
      id: usersSoftware.softwareId,
      name: softwareTable.name,
      version: usersSoftware.version,
      threatCount: sql<number>`COUNT(DISTINCT ga.id)`,
      highestLevel: sql<string>`
        CASE 
          WHEN COUNT(*) FILTER (WHERE ga.threat_level = 'critical') > 0 THEN 'critical'
          WHEN COUNT(*) FILTER (WHERE ga.threat_level = 'high') > 0 THEN 'high'
          WHEN COUNT(*) FILTER (WHERE ga.threat_level = 'medium') > 0 THEN 'medium'
          WHEN COUNT(*) FILTER (WHERE ga.threat_level = 'low') > 0 THEN 'low'
          ELSE NULL
        END
      `
    })
    .from(usersSoftware)
    .innerJoin(softwareTable, eq(usersSoftware.softwareId, softwareTable.id))
    .leftJoin(articleSoftware, eq(articleSoftware.softwareId, usersSoftware.softwareId))
    .leftJoin(globalArticles, eq(globalArticles.id, articleSoftware.articleId))
    .where(and(
      eq(usersSoftware.userId, userId),
      eq(usersSoftware.isActive, true)
    ))
    .groupBy(usersSoftware.softwareId, softwareTable.name, usersSoftware.version);

  // Similar queries for hardware, vendors, clients...

  res.json({
    software: software.map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      threats: s.threatCount > 0 ? {
        count: s.threatCount,
        highestLevel: s.highestLevel
      } : null
    })),
    hardware: [...],
    vendors: [...],
    clients: [...]
  });
});

// POST /api/tech-stack/add - Add item to tech stack
router.post('/tech-stack/add', async (req, res) => {
  const { type, itemId, version, priority } = req.body;
  const userId = req.user.id;
  
  // Add to appropriate junction table based on type
  // Trigger relevance score recalculation
});

// DELETE /api/tech-stack/:itemId - Remove item from tech stack
router.delete('/tech-stack/:itemId', async (req, res) => {
  // Remove from junction table
  // Trigger relevance score recalculation
});
```

---

#### D. Navigation Updates

Update the Threat Tracker navigation to include the new Technology Stack page:

```tsx
// In threat-tracker layout/navigation
const tabs = [
  { name: 'Detected Threats', href: '/dashboard/threat-tracker' },
  { name: 'Technology Stack', href: '/dashboard/threat-tracker/tech-stack' }, // NEW
  { name: 'Keywords', href: '/dashboard/threat-tracker/keywords' },
  { name: 'Sources', href: '/dashboard/threat-tracker/sources' }
];
```

---

#### E. Type Definitions

**File:** `shared/types/tech-stack.ts`

```typescript
export interface TechStackItemType {
  id: string;
  name: string;
  version?: string;
  threats?: {
    count: number;
    highestLevel: 'critical' | 'high' | 'medium' | 'low';
  } | null;
}

export interface TechStackResponse {
  software: TechStackItemType[];
  hardware: TechStackItemType[];
  vendors: TechStackItemType[];
  clients: TechStackItemType[];
}
```

---

## Summary of Key Decisions

1. **Threat Actors**: Separate table, AI-discovered only, linked via junction table
2. **Relevance Scoring**: Pre-calculated in batches per user, stored in article_relevance_score table
3. **Severity Scoring**: User-independent, based purely on threat characteristics, stored in DB
4. **Keywords Page**: Simplified to only threat keywords and threat actors (read-only)
5. **Technology Stack Page**: Unified configuration with inline threat indicators for software/hardware/vendors/clients

This architecture ensures:
- Accurate, up-to-date relevance scores
- Fast query performance through strategic caching
- Clear separation between universal threat severity and user-specific relevance
- Intuitive UI for managing technology stack and monitoring threats
- Scalability as user and article counts grow