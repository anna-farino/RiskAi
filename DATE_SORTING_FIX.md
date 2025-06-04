# Threat Tracker Date Sorting Fix

## Issues Identified
1. **Mixed Date Sorting**: Backend was mixing publish dates and scrape dates when sorting by publishDate
2. **Incorrect Prioritization**: Articles without publish dates were appearing before those with valid dates
3. **Default Sorting**: No clear default to publishDate newest-to-oldest
4. **Frontend Inconsistency**: Frontend sorting logic didn't match backend behavior

## Fixes Implemented

### Backend Changes (`backend/apps/threat-tracker/queries/threat-tracker.ts`)

**Before:**
```sql
-- Mixed publish and scrape dates with complex COALESCE logic
COALESCE(publish_date, scrape_date) DESC
```

**After:**
```sql
-- Pure date-specific sorting
-- When sortBy = "publishDate":
publish_date DESC NULLS LAST

-- When sortBy = "scrapeDate": 
scrape_date DESC

-- Default (no sortBy specified):
publish_date DESC NULLS LAST
```

### Frontend Changes (`frontend/src/pages/dashboard/threat-tracker/home.tsx`)

**Updated Logic:**
- `sortBy = 'publishDate'`: Sort ONLY by publish date, nulls go to end
- `sortBy = 'scrapeDate'`: Sort ONLY by scrape date
- Default: Always sort by publish date DESC

### Key Improvements

1. **Pure Date Sorting**: 
   - publishDate sorting uses ONLY publish_date column
   - scrapeDate sorting uses ONLY scrape_date column
   - No more mixing of different date types

2. **Correct Chronological Order**:
   - June 04, 2025 now appears above May 20, 2025
   - Newest dates first when sorting DESC
   - Oldest dates first when sorting ASC

3. **Null Handling**:
   - Articles without publish dates appear at the end when sorting by publishDate
   - Uses PostgreSQL `NULLS LAST` for consistent behavior

4. **Default Behavior**:
   - Default sort: publishDate DESC NULLS LAST
   - Most recent articles appear first by default

## Expected Results

### Before Fix:
- Inconsistent date ordering
- Articles with scrape dates mixed with publish dates
- June 04 might appear below May 20 due to fallback logic

### After Fix:
- June 04, 2025 appears above May 20, 2025 ✓
- Articles without publish dates appear at the bottom ✓
- Clean separation between publish date and scrape date sorting ✓
- Consistent chronological ordering ✓

## Testing Scenarios

1. **Publish Date DESC (Default)**:
   - Most recent publish dates first
   - Articles without publish dates at end

2. **Publish Date ASC**:
   - Oldest publish dates first
   - Articles without publish dates at end

3. **Scrape Date DESC**:
   - Most recent scrape dates first
   - Only scrape dates considered

4. **Scrape Date ASC**:
   - Oldest scrape dates first
   - Only scrape dates considered

## Database Impact

No schema changes required. The fix only affects:
- SQL ORDER BY clauses
- Query logic for date prioritization
- Frontend sorting consistency

Articles retain all their existing date data - the fix only changes how that data is sorted and displayed.