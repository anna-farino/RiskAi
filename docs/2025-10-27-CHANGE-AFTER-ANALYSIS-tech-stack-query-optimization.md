# 2025-10-27 CHANGE AFTER ANALYSIS: Tech Stack Query Optimization

Following the analysis documented in `2025-10-27-ANALYSIS-sql-aggregation-counts-with-article-ids.md`, we applied consistent optimizations across all tech stack queries in the `/api/tech-stack` endpoint.

---

## 📍 File Changed

**File**: `backend/apps/threat-tracker/router/tech-stack.ts`
**Function**: `GET /` (Fetch user's tech stack with threat counts)
**Lines**: 320-509

---

## 🎯 Changes Applied

Updated three queries to match the optimized `softwareResults` pattern:
1. **hardwareResults** (lines 370-416)
2. **vendorResults** (lines 420-466)
3. **clientResults** (lines 470-509)

---

## 🔄 What Changed

### 1. Aggregation Syntax: SUM(CASE WHEN...) → COUNT(*) FILTER

**Before:**
```typescript
criticalCount: sql<number>`COALESCE(SUM(CASE WHEN ${usersHardware.isActive} = true AND ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END), 0)`
```

**After:**
```typescript
criticalCount: sql<number>`
  COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'), 0)
`
```

**Benefits:**
- ✅ Cleaner, more readable SQL
- ✅ Better PostgreSQL optimization
- ✅ Follows PostgreSQL best practices (9.4+)

---

### 2. Moved isActive Filter to WHERE Clause

**Before:**
```typescript
// isActive checked in EVERY aggregation
criticalCount: sql<number>`COALESCE(SUM(CASE WHEN ${usersHardware.isActive} = true AND ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END), 0)`
highCount: sql<number>`COALESCE(SUM(CASE WHEN ${usersHardware.isActive} = true AND ${globalArticles.threatLevel} = 'high' THEN 1 ELSE 0 END), 0)`
// ... repeated for all threat levels

.where(eq(usersHardware.userId, userId))
```

**After:**
```typescript
// isActive checked ONCE in WHERE clause
criticalCount: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'), 0)`
highCount: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'high'), 0)`
// ... clean aggregations

.where(
  and(
    eq(usersHardware.userId, userId),
    eq(usersHardware.isActive, true)  // ✅ Filter early
  )
)
```

**Benefits:**
- ✅ Eliminates redundant checks (4 checks per row → 1 check per row)
- ✅ Faster query execution
- ✅ Database can filter rows before aggregation

---

### 3. Added globalSources Join for Subscription Tier Filtering

**Before:**
```typescript
.leftJoin(
  globalArticles,
  and(
    eq(globalArticles.id, articleHardware.articleId),
    eq(globalArticles.isCybersecurity, true)
  ),
)
// No globalSources join - users could see articles from sources above their tier
.where(eq(usersHardware.userId, userId))
```

**After:**
```typescript
.leftJoin(
  globalArticles,
  and(
    eq(globalArticles.id, articleHardware.articleId),
    eq(globalArticles.isCybersecurity, true)
  ),
)
.leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))  // ✅ Join sources
.where(
  and(
    eq(usersHardware.userId, userId),
    eq(usersHardware.isActive, true),
    lte(globalSources.requiredTierLevel, userTierLevel)  // ✅ Filter by tier
  )
)
```

**Benefits:**
- ✅ Enforces subscription tier access control
- ✅ Users only see articles from sources their plan allows
- ✅ Consistent with softwareResults implementation

---

## 📊 Impact Summary

### Query: hardwareResults (lines 370-416)

| Change | Before | After |
|--------|--------|-------|
| Aggregation syntax | `SUM(CASE WHEN...)` | `COUNT(*) FILTER` |
| isActive filter location | In each aggregation (4×) | In WHERE clause (1×) |
| globalSources join | ❌ Missing | ✅ Added |
| Tier filtering | ❌ None | ✅ `lte(globalSources.requiredTierLevel, userTierLevel)` |

### Query: vendorResults (lines 420-466)

| Change | Before | After |
|--------|--------|-------|
| Aggregation syntax | `SUM(CASE WHEN...)` | `COUNT(*) FILTER` |
| isActive filter location | In each aggregation (4×) | In WHERE clause (1×) |
| globalSources join | ❌ Missing | ✅ Added |
| Tier filtering | ❌ None | ✅ `lte(globalSources.requiredTierLevel, userTierLevel)` |

### Query: clientResults (lines 470-509)

| Change | Before | After |
|--------|--------|-------|
| Aggregation syntax | `SUM(CASE WHEN...)` | `COUNT(*) FILTER` |
| isActive filter location | In each aggregation (4×) | In WHERE clause (1×) |
| globalSources join | ❌ Missing | ✅ Added |
| Tier filtering | ❌ None | ✅ `lte(globalSources.requiredTierLevel, userTierLevel)` |

---

## 🔍 Code Examples

### Example 1: hardwareResults

**Before:**
```typescript
const hardwareResults = await db
  .select({
    id: hardware.id,
    name: hardware.name,
    criticalCount: sql<number>`COALESCE(SUM(CASE WHEN ${usersHardware.isActive} = true AND ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END), 0)`,
    // ... other counts
  })
  .from(usersHardware)
  .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
  .leftJoin(articleHardware, eq(articleHardware.hardwareId, hardware.id))
  .leftJoin(globalArticles, and(...))
  .where(eq(usersHardware.userId, userId))
  .groupBy(...);
```

**After:**
```typescript
const hardwareResults = await db
  .select({
    id: hardware.id,
    name: hardware.name,
    criticalCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'), 0)
    `,
    // ... other counts
  })
  .from(usersHardware)
  .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
  .leftJoin(articleHardware, eq(articleHardware.hardwareId, hardware.id))
  .leftJoin(globalArticles, and(...))
  .leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))  // ✅ NEW
  .where(
    and(
      eq(usersHardware.userId, userId),
      eq(usersHardware.isActive, true),                                    // ✅ NEW
      lte(globalSources.requiredTierLevel, userTierLevel)                  // ✅ NEW
    )
  )
  .groupBy(...);
```

### Example 2: vendorResults

**Before:**
```typescript
const vendorResults = await db
  .select({
    id: companies.id,
    name: companies.name,
    criticalCount: sql<number>`COALESCE(SUM(CASE WHEN ${usersCompanies.isActive} = true AND ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END), 0)`,
    // ... other counts
  })
  .from(usersCompanies)
  .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
  .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
  .leftJoin(globalArticles, and(...))
  .where(
    and(
      eq(usersCompanies.userId, userId),
      eq(usersCompanies.relationshipType, "vendor")
    )
  )
  .groupBy(...);
```

**After:**
```typescript
const vendorResults = await db
  .select({
    id: companies.id,
    name: companies.name,
    criticalCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'), 0)
    `,
    // ... other counts
  })
  .from(usersCompanies)
  .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
  .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
  .leftJoin(globalArticles, and(...))
  .leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))  // ✅ NEW
  .where(
    and(
      eq(usersCompanies.userId, userId),
      eq(usersCompanies.relationshipType, "vendor"),
      eq(usersCompanies.isActive, true),                                   // ✅ NEW
      lte(globalSources.requiredTierLevel, userTierLevel)                  // ✅ NEW
    )
  )
  .groupBy(...);
```

### Example 3: clientResults

**Before:**
```typescript
const clientResults = await db
  .select({
    id: companies.id,
    name: companies.name,
    criticalCount: sql<number>`COALESCE(SUM(CASE WHEN ${usersCompanies.isActive} = true AND ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END), 0)`,
    // ... other counts
  })
  .from(usersCompanies)
  .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
  .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
  .leftJoin(globalArticles, and(...))
  .where(
    and(
      eq(usersCompanies.userId, userId),
      eq(usersCompanies.relationshipType, "client")
    )
  )
  .groupBy(...);
```

**After:**
```typescript
const clientResults = await db
  .select({
    id: companies.id,
    name: companies.name,
    criticalCount: sql<number>`
      COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical'), 0)
    `,
    // ... other counts
  })
  .from(usersCompanies)
  .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
  .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
  .leftJoin(globalArticles, and(...))
  .leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))  // ✅ NEW
  .where(
    and(
      eq(usersCompanies.userId, userId),
      eq(usersCompanies.relationshipType, "client"),
      eq(usersCompanies.isActive, true),                                   // ✅ NEW
      lte(globalSources.requiredTierLevel, userTierLevel)                  // ✅ NEW
    )
  )
  .groupBy(...);
```

---

## ✅ Consistency Achieved

All four queries now follow the same pattern:

```typescript
// ✅ softwareResults  (lines 320-366)
// ✅ hardwareResults  (lines 370-416)
// ✅ vendorResults    (lines 420-466)
// ✅ clientResults    (lines 470-509)
```

### Common Pattern:
1. **Clean aggregations** using `COUNT(*) FILTER (WHERE...)`
2. **Early filtering** with `isActive = true` in WHERE clause
3. **Subscription enforcement** via `globalSources` join
4. **Tier access control** using `lte(globalSources.requiredTierLevel, userTierLevel)`

---

## 🚀 Performance Benefits

### Query Optimization
- **Fewer redundant checks**: 4 `isActive` checks per row → 1 check per row
- **Database-level filtering**: PostgreSQL can optimize `FILTER` clauses better than `SUM(CASE WHEN...)`
- **Earlier row elimination**: WHERE clause filtering happens before aggregation

### Subscription Compliance
- **Prevents tier bypass**: Users can't see articles from premium sources on lower tiers
- **Consistent enforcement**: All tech stack categories now respect subscription limits
- **Proper access control**: Articles are filtered at query level, not post-processing

---

## 🎯 Testing Considerations

### What to Test

1. **Inactive Items**
   - Verify inactive hardware/vendors/clients don't appear in results
   - Confirm `isActive = false` items are filtered out

2. **Subscription Tiers**
   - Test with different user tier levels (free, basic, premium)
   - Verify users only see articles from allowed sources
   - Confirm article counts are accurate per tier

3. **Threat Level Counts**
   - Validate critical/high/medium/low counts are correct
   - Check counts match the articles actually displayed
   - Verify COALESCE returns 0 for items with no articles

4. **Edge Cases**
   - Items with no articles (should show 0 counts)
   - Users with no tech stack items
   - Articles without associated sources

---

## 📚 Related Documentation

- **Analysis**: `docs/2025-10-27-ANALYSIS-sql-aggregation-counts-with-article-ids.md`
- **Implementation**: `backend/apps/threat-tracker/router/tech-stack.ts`

---

## 🏁 Summary

These changes bring consistency, performance improvements, and proper subscription enforcement across all tech stack queries. By following the optimized pattern established in `softwareResults`, we've improved code maintainability and ensured all users receive appropriate content based on their subscription tier.

**Key Takeaway**: When one query is optimized, apply the same pattern across all similar queries for consistency and maintainability.
