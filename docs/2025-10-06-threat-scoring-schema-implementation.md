# Enhanced Threat Scoring Schema Implementation

**Date:** 2025-10-06
**Status:** Schemas Created - Ready for Migration

## Overview

Created comprehensive database schemas for the enhanced threat severity scoring system, implementing a multi-entity architecture with proper indexing, relations, and type safety. This replaces the simplified keyword-based approach with a sophisticated entity extraction and relevance scoring system.

## Files Created

### 1. Core Entity Tables
**File:** `shared/db/schema/threat-tracker/entities.ts` (162 lines)

#### Tables Created:
- **companies** - Centralized company table (replaces separate vendors/clients)
- **software** - Software products with vendor associations
- **hardware** - Hardware devices with manufacturer tracking
- **threatActors** - Threat actor groups with aliases

#### Key Design Decisions:
- **UUID Primary Keys:** Replaced ULID with UUID for consistency
- **Normalized Names:** Each entity has `normalizedName` field for deduplication
- **Flexible Metadata:** JSONB fields for extensibility
- **Discovery Tracking:** Records who/what discovered each entity (user vs AI)

### 2. User Tech Stack Associations
**File:** `shared/db/schema/threat-tracker/user-associations.ts` (120 lines)

#### Tables Created:
- **users_software** - User's software inventory with versions
- **users_hardware** - User's hardware inventory with quantities
- **users_companies** - User's vendor/client relationships

#### Key Features:
- **Priority Scoring:** 1-100 priority field for relevance weighting
- **Active Tracking:** `isActive` flag for temporary disabling
- **Composite Primary Keys:** (userId, entityId) for efficient lookups

### 3. Article Entity Associations
**File:** `shared/db/schema/threat-tracker/entity-associations.ts` (186 lines)

#### Tables Created:
- **article_software** - Links articles to affected software (with version ranges)
- **article_hardware** - Links articles to affected hardware
- **article_companies** - Links articles to mentioned companies
- **article_cves** - Links articles to CVE identifiers
- **article_threat_actors** - Links articles to threat actor groups

#### Key Features:
- **Version Range Support:** `versionFrom` and `versionTo` for vulnerability tracking
- **Confidence Scores:** AI confidence (0.00-1.00) for each extraction
- **Context Snippets:** Stores text where entity was mentioned
- **Activity Types:** For threat actors (attributed, suspected, mentioned)

### 4. Relevance Scoring
**File:** `shared/db/schema/threat-tracker/relevance-scoring.ts` (73 lines)

#### Table Created:
- **article_relevance_scores** - Pre-calculated user-specific relevance scores

#### Key Features:
- **Component Breakdown:** Separate scores for software, client, vendor, hardware, keyword
- **Matched Entities Tracking:** Arrays of matched entity IDs for debugging
- **Calculation Versioning:** Tracks which algorithm version calculated the score
- **Unique Per User-Article:** One relevance score per user-article combination

### 5. Entity Resolution Cache
**File:** `shared/db/schema/threat-tracker/entity-resolution.ts` (44 lines)

#### Table Created:
- **entity_resolution_cache** - AI entity resolution decisions cache

#### Key Features:
- **30-Day TTL:** Automatic expiry for cache invalidation
- **Confidence Tracking:** Records AI's confidence in match decisions
- **Alias Storage:** Maintains known variations and aliases
- **Reasoning Field:** Stores AI's explanation for debugging

### 6. Global Articles Update
**File:** `shared/db/schema/global-tables.ts` (Updated)

#### Columns Added:
- `threatMetadata` (jsonb) - Detailed scoring components
- `threatSeverityScore` (numeric 4,2) - User-independent severity (0.00-10.00)
- `threatLevel` (text) - Categorical level: low, medium, high, critical
- `attackVectors` (text[]) - Array of attack vectors
- `lastThreatAnalysis` (timestamp) - When last analyzed
- `threatAnalysisVersion` (text) - Which algorithm version
- `entitiesExtracted` (boolean) - Extraction completion flag

---

## Index Strategy and How They Work

### Understanding Database Indexes

An index is like a book's index - it allows the database to quickly find rows without scanning the entire table. However, indexes come with tradeoffs:
- ✅ **Pro:** Dramatically faster queries on indexed columns
- ❌ **Con:** Slower writes (index must be updated)
- ❌ **Con:** Additional storage space

### Index Types Used

#### 1. B-Tree Indexes (Default)
Used for equality and range queries on single columns.

```sql
-- Example from companies table
CREATE INDEX companies_normalized_idx ON companies(normalized_name);
CREATE INDEX idx_companies_name ON companies(name);
```

**How It Works:**
- Creates a balanced tree structure
- Allows O(log n) lookups instead of O(n)
- Perfect for `WHERE normalized_name = 'microsoft'` or `ORDER BY name`

**Query Optimization:**
```sql
-- Fast (uses index):
SELECT * FROM companies WHERE normalized_name = 'microsoft';

-- Still fast (uses index):
SELECT * FROM companies WHERE name LIKE 'Micro%';

-- Slow (no index can help):
SELECT * FROM companies WHERE name LIKE '%soft';
```

#### 2. Composite (Multi-Column) Indexes
Used when queries filter on multiple columns together.

```sql
-- Example from user_associations
CREATE INDEX idx_relevance_user_article ON article_relevance_scores(user_id, article_id);
```

**How It Works:**
- Index is sorted first by `user_id`, then by `article_id` within each user
- Efficient for queries that filter on user_id (with or without article_id)
- **NOT efficient** for queries that only filter on article_id

**Query Performance:**
```sql
-- Fast (uses index):
SELECT * FROM article_relevance_scores WHERE user_id = 'abc-123';

-- Fast (uses index):
SELECT * FROM article_relevance_scores WHERE user_id = 'abc-123' AND article_id = 'def-456';

-- Slow (index order doesn't match):
SELECT * FROM article_relevance_scores WHERE article_id = 'def-456';
```

**Why This Order Matters:**
We query "find scores for this user" more often than "find scores for this article," so `user_id` comes first.

#### 3. GIN (Generalized Inverted) Indexes
Used for array and JSONB searches.

```sql
-- Example from threat_actors table
CREATE INDEX idx_threat_actors_aliases ON threat_actors(aliases);
```

**How It Works:**
- Creates an inverted index: maps each array element to rows containing it
- Perfect for `ANY`, `@>` (contains), and `&&` (overlaps) operators

**Query Performance:**
```sql
-- Fast (uses GIN index):
SELECT * FROM threat_actors WHERE 'APT28' = ANY(aliases);

-- Fast (uses GIN index):
SELECT * FROM threat_actors WHERE aliases @> ARRAY['Fancy Bear'];

-- Fast (uses GIN index):
SELECT * FROM threat_actors WHERE aliases && ARRAY['Pawn Storm', 'Sofacy'];
```

#### 4. Unique Constraints with Composite Indexes
Enforces uniqueness while providing query performance.

```sql
-- Example from software table
CREATE UNIQUE INDEX ON software(normalized_name, company_id);
```

**How It Works:**
- Prevents duplicate entries (same software + company)
- Also serves as a query index (two benefits in one)
- Faster than separate unique constraint + index

### Comprehensive Index Breakdown

#### Companies Table
```sql
companies_normalized_idx: normalized_name
  Purpose: Fast deduplication checks
  Query: "Does Microsoft already exist?"

idx_companies_name: name
  Purpose: Fast lookups and autocomplete
  Query: "Find companies starting with 'Micro'"
```

#### Software Table
```sql
UNIQUE(normalized_name, company_id)
  Purpose: Prevent duplicates + fast lookups
  Query: "Does 'Windows 10' by Microsoft exist?"

software_normalized_idx: normalized_name
  Purpose: Search across all vendors
  Query: "Find all software named 'Chrome' (any vendor)"

idx_software_name: name
  Purpose: Autocomplete and name searches
  Query: "Software starting with 'Wind'"
```

#### Hardware Table
```sql
UNIQUE(normalized_name, model, manufacturer)
  Purpose: Prevent duplicates
  Query: "Does 'ASA 5500' by Cisco exist?"

hardware_normalized_idx: normalized_name
  Purpose: Fast name searches
  Query: "Find all 'Router 5000' devices"
```

#### Threat Actors Table
```sql
threat_actors_normalized_idx: normalized_name
  Purpose: Fast name lookups
  Query: "Does 'APT28' exist?"

idx_threat_actors_name: name
  Purpose: Display name searches
  Query: "Show threat actors starting with 'Lazarus'"

idx_threat_actors_aliases: aliases (GIN)
  Purpose: Search by any alias
  Query: "Find actor with alias 'Fancy Bear'"
```

#### User Association Tables
```sql
-- users_software
idx_users_software_user: user_id
  Purpose: Load user's tech stack
  Query: "Show all software for user X"

-- users_hardware
idx_users_hardware_user: user_id
  Purpose: Load user's hardware
  Query: "Show all hardware for user X"

-- users_companies
idx_users_companies_user: user_id
  Purpose: Load user's companies
  Query: "Show all vendors/clients for user X"
```

#### Article Association Tables
```sql
-- article_software
idx_article_software_article: article_id
  Purpose: Show software in article
  Query: "What software does this article mention?"

idx_article_software_software: software_id
  Purpose: Find articles about software
  Query: "Which articles mention Windows 10?"

-- article_hardware (similar pattern)
idx_article_hardware_article: article_id
idx_article_hardware_hardware: hardware_id

-- article_companies (similar pattern)
idx_article_companies_article: article_id
idx_article_companies_company: company_id

-- article_threat_actors
idx_article_threat_actors_article: article_id
  Purpose: Threat actors in article

idx_article_threat_actors_actor: threat_actor_id
  Purpose: Articles about specific threat actor
  Query: "Show all APT28 activity"
```

#### Relevance Scoring Table
```sql
UNIQUE(article_id, user_id)
  Purpose: One score per user-article pair
  Prevents: Duplicate calculations

idx_relevance_user_article: user_id, article_id
  Purpose: Fast lookup of specific score
  Query: "Get relevance for user X on article Y"

idx_relevance_article_score: article_id, relevance_score
  Purpose: Find most relevant users for an article
  Query: "Which users find this article most relevant?"

idx_relevance_user_score: user_id, relevance_score
  Purpose: Top articles for user
  Query: "Most relevant articles for user X"
  Most Common: This is the primary query pattern!

article_date_idx: article_id, calculated_at
  Purpose: Track calculation freshness
  Query: "Find stale scores that need recalculation"
```

#### Entity Resolution Cache
```sql
entity_resolution_lookup_idx: input_name, entity_type
  Purpose: Fast cache lookups
  Query: "Have we resolved 'MSFT' as a company before?"
  Most Common: This is used on every entity extraction!

entity_resolution_expiry_idx: expires_at
  Purpose: Cleanup expired entries
  Query: "Delete cache entries older than 30 days"
```

#### Global Articles Table (Updated)
```sql
idx_articles_severity: threat_severity_score
  Purpose: Sort by severity
  Query: "Show most severe threats"

idx_articles_threat_level: threat_level
  Purpose: Filter by categorical level
  Query: "Show all 'critical' threats"
```

---

## Index Performance Examples

### Scenario 1: User Opens Threat Dashboard

**Without Indexes:**
```sql
-- Scan entire article_relevance_scores table (millions of rows)
SELECT * FROM article_relevance_scores
WHERE user_id = 'abc-123'
ORDER BY relevance_score DESC
LIMIT 50;

-- Performance: ~5-10 seconds (full table scan)
```

**With Indexes:**
```sql
-- Uses idx_relevance_user_score index
-- Jumps directly to user's scores, already sorted
SELECT * FROM article_relevance_scores
WHERE user_id = 'abc-123'
ORDER BY relevance_score DESC
LIMIT 50;

-- Performance: ~10-50ms (index seek)
```

### Scenario 2: AI Entity Resolution

**Without Indexes:**
```sql
-- Scan entire cache table for each extraction
SELECT * FROM entity_resolution_cache
WHERE input_name = 'Microsoft Corporation'
  AND entity_type = 'company';

-- With 50 entities per article, 1000 rows in cache:
-- 50 × 1000 = 50,000 row checks (slow!)
```

**With Indexes:**
```sql
-- Uses entity_resolution_lookup_idx composite index
SELECT * FROM entity_resolution_cache
WHERE input_name = 'Microsoft Corporation'
  AND entity_type = 'company';

-- With 50 entities per article:
-- 50 × log(1000) ≈ 500 comparisons (fast!)
```

### Scenario 3: Finding Articles About Specific Software

**Without Indexes:**
```sql
-- Scan entire article_software junction table
SELECT a.*
FROM global_articles a
JOIN article_software ars ON ars.article_id = a.id
WHERE ars.software_id = 'windows-10-uuid';

-- Performance: ~2-5 seconds (full scan of junction table)
```

**With Indexes:**
```sql
-- Uses idx_article_software_software index
SELECT a.*
FROM global_articles a
JOIN article_software ars ON ars.article_id = a.id
WHERE ars.software_id = 'windows-10-uuid';

-- Performance: ~20-100ms (index seek + join)
```

---

## Why These Specific Indexes?

### Based on Query Patterns

Our indexes are designed around these common queries:

1. **Most Common: User Dashboard Load**
   - Query: "Show most relevant articles for this user"
   - Index: `idx_relevance_user_score (user_id, relevance_score)`
   - Frequency: Every page load (high priority!)

2. **Common: Entity Deduplication**
   - Query: "Does this company/software already exist?"
   - Index: Unique constraints on normalized_name
   - Frequency: Every entity extraction

3. **Common: Cache Lookups**
   - Query: "Have we resolved this entity name before?"
   - Index: `entity_resolution_lookup_idx (input_name, entity_type)`
   - Frequency: Every entity extraction

4. **Frequent: Tech Stack Display**
   - Query: "Show user's software/hardware/companies"
   - Index: `idx_users_*_user (user_id)`
   - Frequency: Profile views, relevance calculations

5. **Occasional: Article Entity Exploration**
   - Query: "What entities does this article mention?"
   - Index: `idx_article_*_article (article_id)`
   - Frequency: Article detail views

6. **Rare: Threat Actor Research**
   - Query: "Find articles mentioning specific threat actor"
   - Index: `idx_article_threat_actors_actor (threat_actor_id)`
   - Frequency: Security research queries

### Indexes We Deliberately Did NOT Create

**No index on `article_cves.article_id`:**
- Reason: Small table, sequential scans are fast enough
- Trade-off: Avoid index maintenance overhead

**No index on `users_software.version`:**
- Reason: Rarely queried alone (always with userId)
- Trade-off: Version searches are infrequent

**No index on `article_relevance_scores.calculated_at` alone:**
- Reason: Always queried with article_id (composite index covers it)
- Trade-off: Avoid redundant index

---

## Migration Strategy

### Step 1: Generate Migrations
```bash
npx drizzle-kit generate
```

This will create SQL files in `backend/db/migrations/` with:
- CREATE TABLE statements
- CREATE INDEX statements
- Foreign key constraints

### Step 2: Review Generated SQL
Check that:
- All indexes are named correctly
- No duplicate indexes
- Constraints are properly defined

### Step 3: Apply Migrations
```bash
npx drizzle-kit migrate
```

### Step 4: Verify Schema
```sql
-- Check table creation
\dt

-- Check indexes
\di

-- Verify specific index
\d article_relevance_scores
```

---

## Performance Impact Estimates

### Storage Overhead
- **Entity tables:** ~50MB for 10K companies, 20K software, 5K hardware
- **Junction tables:** ~200MB for 50K article-entity associations
- **Relevance scores:** ~500MB for 100 users × 50K articles
- **Indexes:** ~30% overhead (~250MB for above data)
- **Total estimate:** ~1.25GB for moderate usage

### Query Performance Improvements
- **User dashboard:** 5000ms → 30ms (167x faster)
- **Entity deduplication:** 500ms → 5ms (100x faster)
- **Cache lookups:** 100ms → 2ms (50x faster)
- **Tech stack loading:** 200ms → 10ms (20x faster)

### Write Performance Impact
- **Article processing:** +10% time (entity extraction + storage)
- **User tech stack updates:** +5% time (index updates)
- **Relevance calculation:** Negligible (batch operations)

**Trade-off Verdict:** ✅ Worth it! Read queries far outnumber writes.

---

## Drizzle Relations Benefits

All tables include Drizzle relations definitions, enabling:

### Type-Safe Queries
```typescript
// Automatic joins with full type safety
const articlesWithSoftware = await db.query.globalArticles.findMany({
  with: {
    articleSoftware: {
      with: {
        software: {
          with: {
            company: true
          }
        }
      }
    }
  }
});
// TypeScript knows the exact shape!
```

### Simplified Queries
```typescript
// Instead of manual joins:
const results = await db
  .select()
  .from(articleSoftware)
  .innerJoin(software, eq(articleSoftware.softwareId, software.id))
  .innerJoin(companies, eq(software.companyId, companies.id));

// Use relations:
const results = await db.query.articleSoftware.findMany({
  with: {
    software: {
      with: { company: true }
    }
  }
});
```

---

## Summary

**Created:**
- 5 new schema files (585 lines)
- 13 new tables
- 31 indexes (B-Tree, GIN, Unique)
- Complete type safety with Drizzle
- Full relational mapping

**Key Achievements:**
- ✅ ULID replaced with UUID for consistency
- ✅ All foreign keys properly referenced
- ✅ Indexes optimized for query patterns
- ✅ Relations enable powerful Drizzle queries
- ✅ Type exports for full TypeScript support
- ✅ Ready for immediate migration

**Next Steps:**
1. Generate migrations: `npx drizzle-kit generate`
2. Review SQL output
3. Apply migrations: `npx drizzle-kit migrate`
4. Implement service layer (EntityManager, RelevanceScorer)
5. Update article processing pipeline

---

**Document Version:** 1.0
**Last Updated:** 2025-10-06
**Schema Version:** 2.0 (Enhanced Threat Scoring)
