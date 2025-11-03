# 2025-10-27 ANALYSIS: SQL Aggregation - Threat Counts with Article IDs

Understanding how to aggregate threat level counts while simultaneously collecting article IDs for software items in a user's tech stack.

---

## 📊 The Problem

We need to query `usersSoftware` to get:
1. **Count** of articles per threat level (critical, high, medium, low)
2. **Article IDs** for each threat level
3. Group results by software

---

## 🔍 Breaking Down the Current Count Logic

### Original Query Pattern
```sql
COALESCE(
  SUM(
    CASE
      WHEN usersSoftware.isActive = true
        AND globalArticles.threatLevel = 'critical'
      THEN 1
      ELSE 0
    END
  ),
  0
)
```

### How It Works (Step-by-Step)

1. **JOIN Creates Multiple Rows**
   - Each software item joins to multiple articles
   - Example: "Apache" with 10 related articles → 10 rows in result set

2. **CASE Statement Evaluates Per Row**
   ```
   Row 1: Apache + Article-1 (critical) → Returns 1
   Row 2: Apache + Article-2 (high)     → Returns 0
   Row 3: Apache + Article-3 (critical) → Returns 1
   Row 4: Apache + Article-4 (medium)   → Returns 0
   ...
   ```

3. **SUM Aggregates**
   - Adds up all 1s and 0s for that software
   - Example: `1 + 0 + 1 + 0 + 0 + ... = 2 critical articles`

4. **GROUP BY Consolidates**
   - Groups all rows by software
   - Each software gets one result row with its total count

5. **COALESCE Handles NULLs**
   - If no articles exist (LEFT JOIN returns NULL), default to `0`

---

## ⚠️ Issues with Original Query

### Problem 1: Redundant `isActive` Check
```sql
-- ❌ BAD: Checking isActive in EVERY CASE statement
CASE WHEN usersSoftware.isActive = true AND threatLevel = 'critical' THEN 1 ELSE 0 END
```

Since we're grouping by software, `isActive` is the same for all rows of that software. It should be filtered earlier:

```sql
-- ✅ GOOD: Filter inactive software in WHERE clause
WHERE usersSoftware.userId = $1 AND usersSoftware.isActive = true
```

### Problem 2: Verbose Syntax
`SUM(CASE WHEN...)` is harder to read than PostgreSQL's `COUNT(*) FILTER (WHERE ...)` syntax.

---

## ✅ Improved Solution: Using FILTER with ARRAY_AGG

### Complete Query
```typescript
const softwareResults = await db
  .select({
    id: software.id,
    name: software.name,
    version: usersSoftware.version,
    priority: usersSoftware.priority,
    company: companies.name,
    isActive: usersSoftware.isActive,

    // Counts using FILTER (cleaner syntax)
    criticalCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'), 0)
    `,
    highCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'high'), 0)
    `,
    mediumCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'medium'), 0)
    `,
    lowCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'low'), 0)
    `,

    // Article IDs arrays using ARRAY_AGG
    criticalArticleIds: sql<string[]>`
      COALESCE(
        ARRAY_AGG(DISTINCT ${globalArticles.id}) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'),
        ARRAY[]::uuid[]
      )
    `,
    highArticleIds: sql<string[]>`
      COALESCE(
        ARRAY_AGG(DISTINCT ${globalArticles.id}) FILTER (WHERE ${globalArticles.threatLevel} = 'high'),
        ARRAY[]::uuid[]
      )
    `,
    mediumArticleIds: sql<string[]>`
      COALESCE(
        ARRAY_AGG(DISTINCT ${globalArticles.id}) FILTER (WHERE ${globalArticles.threatLevel} = 'medium'),
        ARRAY[]::uuid[]
      )
    `,
    lowArticleIds: sql<string[]>`
      COALESCE(
        ARRAY_AGG(DISTINCT ${globalArticles.id}) FILTER (WHERE ${globalArticles.threatLevel} = 'low'),
        ARRAY[]::uuid[]
      )
    `,
  })
  .from(usersSoftware)
  .innerJoin(software, eq(usersSoftware.softwareId, software.id))
  .leftJoin(companies, eq(software.companyId, companies.id))
  .leftJoin(articleSoftware, eq(articleSoftware.softwareId, software.id))
  .leftJoin(
    globalArticles,
    and(
      eq(globalArticles.id, articleSoftware.articleId),
      eq(globalArticles.isCybersecurity, true)
    )
  )
  .where(
    and(
      eq(usersSoftware.userId, userId),
      eq(usersSoftware.isActive, true) // ✅ Filter here, not in aggregation
    )
  )
  .groupBy(
    software.id,
    software.name,
    usersSoftware.version,
    usersSoftware.priority,
    usersSoftware.isActive,
    companies.name
  );
```

---

## 🎯 Key PostgreSQL Functions Explained

### `COUNT(*) FILTER (WHERE condition)`
- **Purpose**: Count rows that match a condition
- **Advantage over SUM(CASE)**: Cleaner syntax, better optimization
- **Example**:
  ```sql
  COUNT(*) FILTER (WHERE threat_level = 'critical')
  -- Equivalent to:
  SUM(CASE WHEN threat_level = 'critical' THEN 1 ELSE 0 END)
  ```

### `ARRAY_AGG(DISTINCT column) FILTER (WHERE condition)`
- **Purpose**: Collect values into an array, only for rows matching condition
- **DISTINCT**: Prevents duplicate IDs
- **FILTER**: Only includes IDs where condition is true
- **Example**:
  ```sql
  ARRAY_AGG(DISTINCT article_id) FILTER (WHERE threat_level = 'critical')
  -- Returns: ['uuid-1', 'uuid-2', 'uuid-3']
  ```

### `COALESCE(value, fallback)`
- **Purpose**: Return first non-NULL value
- **Use case 1**: When COUNT returns NULL (no matches)
  ```sql
  COALESCE(COUNT(*) FILTER (...), 0)  -- Returns 0 instead of NULL
  ```
- **Use case 2**: When ARRAY_AGG returns NULL (no matches)
  ```sql
  COALESCE(ARRAY_AGG(...), ARRAY[]::uuid[])  -- Returns empty array instead of NULL
  ```

---

## 📊 Visual Example

### Data Before Aggregation (Individual Rows)
```
software_id | article_id | threat_level
-----------------------------------------
Apache      | art-1      | critical
Apache      | art-2      | critical
Apache      | art-3      | high
Apache      | art-4      | medium
MySQL       | art-5      | critical
MySQL       | art-6      | low
```

### Data After GROUP BY with Aggregation
```typescript
[
  {
    name: "Apache",
    criticalCount: 2,
    criticalArticleIds: ["art-1", "art-2"],
    highCount: 1,
    highArticleIds: ["art-3"],
    mediumCount: 1,
    mediumArticleIds: ["art-4"],
    lowCount: 0,
    lowArticleIds: []
  },
  {
    name: "MySQL",
    criticalCount: 1,
    criticalArticleIds: ["art-5"],
    highCount: 0,
    highArticleIds: [],
    mediumCount: 0,
    mediumArticleIds: [],
    lowCount: 1,
    lowArticleIds: ["art-6"]
  }
]
```

---

## 🎨 Alternative Approach: Separate Queries

If you have **many articles per software**, aggregating IDs in one query can be slow. Consider fetching counts first, then IDs on-demand:

```typescript
// Step 1: Get software with counts (fast)
const softwareWithCounts = await db
  .select({
    id: software.id,
    name: software.name,
    criticalCount: sql<number>`COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical')`,
    // ... other counts
  })
  .from(usersSoftware)
  // ... joins and filters
  .groupBy(software.id, software.name);

// Step 2: Get article IDs for specific software when user expands details
async function getArticleIdsForSoftware(
  softwareId: string,
  threatLevel: 'critical' | 'high' | 'medium' | 'low'
) {
  return db
    .select({ articleId: globalArticles.id })
    .from(articleSoftware)
    .innerJoin(globalArticles, eq(globalArticles.id, articleSoftware.articleId))
    .where(
      and(
        eq(articleSoftware.softwareId, softwareId),
        eq(globalArticles.threatLevel, threatLevel),
        eq(globalArticles.isCybersecurity, true)
      )
    );
}
```

**When to use this approach:**
- ✅ You have 1000+ articles per software item
- ✅ Users only expand details for a few software items
- ✅ Initial page load speed is critical

---

## 📋 Comparison Table

| Aspect | SUM(CASE WHEN...) | COUNT(*) FILTER | ARRAY_AGG + FILTER |
|--------|-------------------|-----------------|---------------------|
| **Readability** | ⚠️ Verbose | ✅ Clear | ✅ Clear |
| **Performance** | ⚠️ Good | ✅ Better (optimized) | ✅ Good (one query) |
| **Gets Counts** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Gets IDs** | ❌ No | ❌ No | ✅ Yes |
| **NULL Handling** | Manual COALESCE | Manual COALESCE | Manual COALESCE |
| **PostgreSQL Specific** | ❌ No (standard SQL) | ✅ Yes (Postgres 9.4+) | ✅ Yes |

---

## 🔑 Key Takeaways

1. **Use `FILTER`** instead of `SUM(CASE WHEN...)` for cleaner, faster aggregations
2. **Use `ARRAY_AGG(DISTINCT ...) FILTER`** to collect IDs matching specific conditions
3. **Always use `DISTINCT`** in ARRAY_AGG to prevent duplicate IDs
4. **Handle NULLs** with COALESCE:
   - Counts: `COALESCE(COUNT(*), 0)`
   - Arrays: `COALESCE(ARRAY_AGG(...), ARRAY[]::uuid[])`
5. **Filter inactive items in WHERE** clause, not in aggregation functions
6. **Consider separate queries** for large datasets to optimize initial load time

---

## 💡 Type-Safe Implementation

```typescript
type SoftwareWithThreats = {
  id: string;
  name: string;
  version: string | null;
  priority: string | null;
  company: string | null;
  isActive: boolean;
  criticalCount: number;
  criticalArticleIds: string[];
  highCount: number;
  highArticleIds: string[];
  mediumCount: number;
  mediumArticleIds: string[];
  lowCount: number;
  lowArticleIds: string[];
};

export async function getSoftwareWithThreatCounts(
  userId: string
): Promise<SoftwareWithThreats[]> {
  // ... implementation shown above
}
```

---

## 🚀 Performance Considerations

1. **Indexes Required:**
   ```sql
   CREATE INDEX idx_article_software_software_id ON article_software(software_id);
   CREATE INDEX idx_global_articles_threat_level ON global_articles(threat_level);
   CREATE INDEX idx_global_articles_cybersecurity ON global_articles(is_cybersecurity);
   ```

2. **Query Cost**: O(n) where n = number of article-software associations
   - For 100 software items with 50 articles each = 5,000 rows to aggregate
   - PostgreSQL handles this efficiently with proper indexes

3. **Result Size**: Each software returns ~8 fields + 4 arrays
   - Keep array sizes reasonable (< 1000 IDs per array)
   - If arrays are huge, use pagination or separate queries

---

## 📚 References

- [PostgreSQL FILTER clause documentation](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES)
- [PostgreSQL ARRAY_AGG function](https://www.postgresql.org/docs/current/functions-aggregate.html)
- [Drizzle ORM sql tagged template](https://orm.drizzle.team/docs/sql)
