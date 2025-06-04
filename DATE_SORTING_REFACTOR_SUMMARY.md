# Threat Tracker Date Sorting Complete Refactor

## Issues Addressed

1. **Mixed Date Logic**: Previous system incorrectly mixed publish dates and scrape dates in sorting
2. **Client-Side Conflicts**: Frontend sorting conflicted with backend sorting
3. **Inconsistent Results**: June 04 appearing below May 20 when sorting newest first
4. **Complex Fallback Logic**: Overly complicated COALESCE logic caused sorting confusion

## Complete Solution Implemented

### Backend Changes (`backend/apps/threat-tracker/queries/threat-tracker.ts`)

**OLD LOGIC (REMOVED):**
```sql
-- Complex, problematic logic that mixed dates
CASE 
  WHEN ${threatArticles.publishDate} IS NULL AND ${threatArticles.scrapeDate} IS NULL THEN 0
  WHEN ${threatArticles.publishDate} IS NOT NULL THEN 1 
  WHEN ${threatArticles.scrapeDate} IS NOT NULL THEN 2
  ELSE 3
END ASC,
COALESCE(${threatArticles.publishDate}, ${threatArticles.scrapeDate}) DESC
```

**NEW LOGIC (CLEAN):**
```sql
-- Publish Date Sort: ONLY consider publish dates
${threatArticles.publishDate} DESC NULLS LAST

-- Scrape Date Sort: ONLY consider scrape dates  
${threatArticles.scrapeDate} DESC NULLS LAST
```

### Key Improvements

1. **Clean Separation**: Publish date sorting ignores scrape dates completely
2. **Proper NULL Handling**: `NULLS LAST` ensures articles without dates appear at the end
3. **Default Behavior**: Default sort is publish date newest first
4. **No Mixed Logic**: Each sort type uses only its respective date field

### Frontend Changes (`frontend/src/pages/dashboard/threat-tracker/home.tsx`)

**REMOVED:**
- Complex client-side `sortArticles()` function
- Duplicate sorting logic that conflicted with backend
- Mixed date comparison logic

**ADDED:**
- `formatDateForDisplay()` for proper local timezone conversion
- Simplified state management relying on backend sorting
- Clean article display without sorting conflicts

### Sorting Behavior

**Publish Date Sort (Default):**
- Uses ONLY `publish_date` column
- Newest dates first (DESC)
- Articles without publish dates appear last
- June 04, 2025 > May 20, 2025 ✓

**Scrape Date Sort:**
- Uses ONLY `scrape_date` column  
- Newest dates first (DESC)
- Articles without scrape dates appear last

**Title Sort:**
- Alphabetical sorting
- Independent of any date considerations

### Date Display

- All dates converted to local timezone for display
- Consistent formatting: "Jun 4, 2025"
- Invalid dates show as "Invalid date"
- Missing dates show as "No date"

## Test Results

The refactored system now provides:

1. **Correct Date Ordering**: June 04 appears above May 20 when sorting newest first
2. **Clean Separation**: No mixing of publish dates and scrape dates
3. **Consistent Behavior**: Backend and frontend sorting aligned
4. **Proper NULL Handling**: Articles without dates consistently placed at end
5. **Local Timezone Support**: Dates display in user's local timezone

## Database Query Examples

**Publish Date Sort (Newest First):**
```sql
SELECT * FROM threat_articles 
ORDER BY publish_date DESC NULLS LAST;
```

**Scrape Date Sort (Oldest First):**
```sql  
SELECT * FROM threat_articles 
ORDER BY scrape_date ASC NULLS LAST;
```

## Files Modified

1. `backend/apps/threat-tracker/queries/threat-tracker.ts` - Complete sorting rewrite
2. `frontend/src/pages/dashboard/threat-tracker/home.tsx` - Removed client sorting, added date formatting

The date sorting functionality has been completely rewritten from scratch with clean, predictable behavior that ensures proper chronological ordering.