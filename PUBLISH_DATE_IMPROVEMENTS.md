# Threat Tracker Publish Date Extraction Improvements

## Analysis of Previous Issues

1. **Inconsistent Date Extraction**: The original system had basic date selector fallbacks that weren't comprehensive enough
2. **Date/Author Mix-ups**: Dates were often confused with author names in mixed content fields
3. **Poor Date Parsing**: Limited support for different date formats and no validation
4. **Missing Fallback Strategies**: No comprehensive approach when primary selectors failed

## Implemented Solutions

### 1. Enhanced OpenAI Structure Detection (`backend/apps/threat-tracker/services/openai.ts`)
- **Improved Prompt**: Added specific guidance for detecting publish dates including:
  - `<time>` elements with datetime attributes
  - Elements with date-related classes (date, published, publish-date, article-date, timestamp)
  - Data attributes (data-date, data-published, data-timestamp)
  - Meta tags with article:published_time
  - JSON-LD structured data with datePublished
- **Alternative Selectors**: Added `dateAlternatives` array to provide multiple selector options

### 2. Comprehensive Date Extraction Utility (`backend/apps/threat-tracker/services/date-extractor.ts`)
- **Multiple Extraction Strategies**:
  1. HTML structure selectors (primary and alternatives)
  2. Meta tag extraction
  3. JSON-LD structured data parsing
  4. Comprehensive CSS selector fallbacks
  5. Text content pattern matching

- **Robust Date Parsing**:
  - ISO 8601 formats (2024-01-15T10:30:00Z, 2024-01-15)
  - US formats (1/15/2024, 1-15-2024)
  - Written formats (January 15, 2024, Jan 1 2024)
  - European formats (15.01.2024)
  - Relative dates (2 days ago, 1 week ago)
  - Unix timestamps (10 and 13 digit)

- **Date Validation**:
  - Checks for valid date objects
  - Reasonable bounds checking (1990-2030)
  - Filters out non-date strings

- **Date/Author Separation**:
  - Intelligent separation of mixed content
  - Pattern recognition for author names vs dates
  - Cleanup of common author indicators ("by", "author:", "written by")

### 3. Enhanced Scraper Integration (`backend/apps/threat-tracker/services/scraper.ts`)
- **Integrated Date Extraction**: Uses the comprehensive date extraction utility
- **Improved Author Handling**: Applies date/author separation to prevent mix-ups
- **Fallback Processing**: Multiple attempts to extract dates from different sources
- **Enhanced Logging**: Detailed logging for debugging date extraction issues

### 4. Updated Background Jobs (`backend/apps/threat-tracker/services/background-jobs.ts`)
- **Simplified Date Processing**: Leverages the enhanced extraction to provide clean date objects
- **Better Error Handling**: Improved logging for date parsing failures
- **Consistent Format**: All dates are stored as proper Date objects in ISO format

## Date Extraction Strategies (In Order of Priority)

1. **Structure-based**: Uses detected HTML structure selectors
2. **Meta Tags**: Searches for article:published_time and other meta properties
3. **JSON-LD**: Parses structured data for datePublished
4. **Comprehensive Selectors**: 25+ common date selector patterns
5. **Text Pattern Matching**: Searches content areas for date patterns

## Supported Date Formats

- ISO 8601: `2024-01-15T10:30:00Z`, `2024-01-15`
- US: `1/15/2024`, `1-15-2024`
- Written: `January 15, 2024`, `Jan 1 2024`, `15 January 2024`
- European: `15.01.2024`
- Relative: `2 days ago`, `1 week ago`, `3 months ago`
- Timestamps: Unix timestamps (seconds and milliseconds)

## CSS Selectors Attempted

The system now tries 25+ common selectors including:
- `time[datetime]`, `time`
- `.date`, `.publish-date`, `.published`, `.article-date`, `.timestamp`
- `[data-date]`, `[data-published]`, `[data-timestamp]`
- `[itemprop="datePublished"]`, `[itemprop="dateCreated"]`
- Meta areas: `.meta time`, `.byline time`, `.article-meta time`

## Testing and Verification

### Test Endpoint
- Added `/api/threat-tracker/test/date-extraction` endpoint
- Tests various HTML structures and date formats
- Validates date/author separation functionality

### Expected Improvements
1. **Higher Success Rate**: More articles should have valid publish dates extracted
2. **Better Date Quality**: Dates should be more accurate and properly formatted
3. **Reduced Mix-ups**: Fewer instances of dates appearing in author fields
4. **Format Consistency**: All dates stored in consistent ISO format

## Database Impact

The `threat_articles.publish_date` column will now receive:
- More consistent and accurate dates
- Properly parsed Date objects
- Validated dates within reasonable bounds (1990-2030)
- Null values only when no valid date can be found

## Usage Notes

- The system gracefully falls back through multiple strategies
- Invalid dates are filtered out rather than stored as malformed data
- Comprehensive logging helps identify extraction issues
- Date/author separation prevents common content mix-ups