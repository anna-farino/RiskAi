# Scraping System Fix Plan
## Global Sources Migration Error Resolution

### Executive Summary
After migrating to the global sources architecture, the scraping system has encountered critical errors preventing Puppeteer-based scraping from functioning. This document outlines the identified issues and provides a comprehensive fix plan.

---

## 1. Problem Analysis

### 1.1 Primary Issue: Puppeteer Library Conflict
**Severity:** Critical  
**Impact:** All Puppeteer-based scraping fails

The system currently uses two incompatible Puppeteer libraries:
- **puppeteer-extra** (with standard puppeteer) - Used by BrowserManager
- **rebrowser-puppeteer** - Used for type definitions

#### Type Mismatch Locations:
1. `backend/services/scraping/core/browser-manager.ts`
   - Imports: `type { Browser, Page } from 'rebrowser-puppeteer'`
   - Launches with: `puppeteer-extra`
   
2. `backend/services/scraping/core/page-setup.ts`
   - Imports: `type { Page } from 'puppeteer'`
   - Functions expect standard Puppeteer Page type
   
3. `backend/services/scraping/scrapers/puppeteer-scraper/main-scraper.ts`
   - Imports: `type { Page } from 'rebrowser-puppeteer'`
   - Functions expect rebrowser-puppeteer Page type

### 1.2 Secondary Code Issues

#### Issue A: Const Reassignment Error
**File:** `backend/services/scraping/scrapers/puppeteer-scraper/main-scraper.ts`  
**Line:** 311  
**Error:** Cannot assign to 'html' because it is a constant
```javascript
const html = await page.content(); // Line 248
// ... later ...
html = dynamicHtml; // Line 311 - ERROR: Can't reassign const
```

#### Issue B: Missing Interface Property
**File:** `backend/services/scraping/scrapers/http-scraper.ts`  
**Line:** 305  
**Error:** 'requiresPuppeteer' does not exist in type 'ScrapingResult'
```javascript
return {
  // ... other properties ...
  requiresPuppeteer: true, // This property doesn't exist in interface
};
```

---

## 2. Root Cause Analysis

### Why It Broke After Global Migration

1. **Unified Code Path**: Global scraper directly calls `unifiedScraper.scrapeSourceUrl()` and `unifiedScraper.scrapeArticleUrl()`, creating a single execution path that exposes all type conflicts

2. **No Fallback Paths**: User-specific scrapers had alternative paths that avoided these conflicts

3. **Increased Dynamic Content**: Global scraping encounters more sites requiring Puppeteer, surfacing the incompatibilities more frequently

### Current Execution Flow
```
Global Scheduler 
  → runUnifiedGlobalScraping()
    → scrapeGlobalSource() [for each source]
      → unifiedScraper.scrapeSourceUrl() [extract links]
        → getContent() [decides HTTP vs Puppeteer]
          → scrapeWithPuppeteer() [TYPE ERROR HERE]
            → setupArticlePage/setupSourcePage [TYPE MISMATCH]
      → unifiedScraper.scrapeArticleUrl() [for each article]
        → Same flow, same errors
```

---

## 3. Proposed Solution

### 3.1 Standardize on Single Puppeteer Library

**Decision: Use `rebrowser-puppeteer` throughout**

Rationale:
- Already installed and configured
- Provides better anti-detection features
- Minimal code changes required

### 3.2 Fix Implementation Plan

#### Step 1: Update Type Imports
**Files to modify:**
1. `backend/services/scraping/core/page-setup.ts`
   - Change: `import type { Page } from 'puppeteer'`
   - To: `import type { Page } from 'rebrowser-puppeteer'`

2. `backend/services/scraping/core/browser-manager.ts`
   - Change: `import puppeteer from 'puppeteer-extra'`
   - To: Use rebrowser-puppeteer directly
   - Remove puppeteer-extra and stealth plugin dependencies

#### Step 2: Update Browser Launch Code
**File:** `backend/services/scraping/core/browser-manager.ts`

Replace puppeteer-extra launch with rebrowser-puppeteer:
```javascript
import puppeteer from 'rebrowser-puppeteer';

// In createNewBrowser():
const browser = await puppeteer.launch({
  headless: true,
  args: BROWSER_ARGS,
  executablePath: chromePath,
  // ... other options
});
```

#### Step 3: Fix Const Reassignment
**File:** `backend/services/scraping/scrapers/puppeteer-scraper/main-scraper.ts`

Change from:
```javascript
const html = await page.content();
// ... later ...
html = dynamicHtml; // ERROR
```

To:
```javascript
let html = await page.content();
// ... later ...
html = dynamicHtml; // OK
```

#### Step 4: Add Missing Interface Property
**File:** `backend/services/scraping/scrapers/http-scraper.ts`

Update ScrapingResult interface:
```javascript
export interface ScrapingResult {
  html: string;
  success: boolean;
  method: "http" | "puppeteer";
  responseTime: number;
  protectionDetected?: ProtectionInfo;
  statusCode?: number;
  finalUrl?: string;
  requiresPuppeteer?: boolean; // Add this optional property
}
```

---

## 4. Alternative Solutions Considered

### Option B: Standardize on puppeteer-extra
- **Pros:** Better plugin ecosystem, stealth plugin
- **Cons:** Would require more extensive refactoring
- **Decision:** Not recommended due to larger scope

### Option C: Use Playwright Instead
- **Pros:** Better API, built-in anti-detection
- **Cons:** Complete rewrite required
- **Decision:** Consider for future, not immediate fix

---

## 5. Testing Strategy

### 5.1 Unit Tests
1. Test Page type compatibility across all functions
2. Verify browser launch and page creation
3. Test HTTP to Puppeteer fallback logic

### 5.2 Integration Tests
1. Test complete scraping flow for:
   - Static HTML sites (HTTP only)
   - Dynamic sites (Puppeteer required)
   - HTMX sites (advanced extraction)
   - Protected sites (DataDome, CloudFlare)

### 5.3 Global Scraping Tests
1. Run global scheduler with test sources
2. Verify article extraction and storage
3. Check error logging for any new issues

---

## 6. Implementation Order

### Phase 1: Critical Fixes (Immediate)
1. Fix const reassignment error
2. Add missing interface property
3. Standardize Puppeteer imports

### Phase 2: Browser Manager Update (Same Day)
1. Update browser launch code
2. Remove puppeteer-extra dependencies
3. Test browser creation and page setup

### Phase 3: Validation (Next Day)
1. Run comprehensive tests
2. Monitor error logs
3. Verify global scraping performance

---

## 7. Risk Assessment

### Risks
1. **Breaking existing scrapers**: LOW - Changes are type-level mostly
2. **Performance degradation**: LOW - Same underlying Chrome engine
3. **Anti-detection issues**: MEDIUM - May need to re-implement stealth features

### Mitigation
1. Keep backup of current code
2. Test on subset of sources first
3. Monitor scraping success rates

---

## 8. Success Metrics

### Immediate (After Fix)
- [ ] No TypeScript errors in scraping modules
- [ ] Puppeteer scraping functions without crashes
- [ ] Global scheduler completes full cycle

### Short-term (1 Week)
- [ ] 95%+ scraping success rate restored
- [ ] Error logs show no Puppeteer-related failures
- [ ] All dynamic content sites loading properly

### Long-term (1 Month)
- [ ] Stable global scraping performance
- [ ] Reduced error rate compared to pre-migration
- [ ] Improved content extraction quality

---

## 9. Rollback Plan

If fixes cause unexpected issues:

1. **Immediate Rollback**
   - Revert git commits
   - Restart services
   - Monitor for stability

2. **Partial Rollback**
   - Keep code fixes (const, interface)
   - Revert only Puppeteer library changes
   - Use temporary type assertions as workaround

3. **Emergency Bypass**
   - Force HTTP-only scraping temporarily
   - Disable Puppeteer path in getContent()
   - Log sites requiring manual review

---

## 10. Post-Fix Improvements

### Recommended Enhancements
1. **Add Puppeteer connection pool** - Reuse browser instances
2. **Implement retry with backoff** - Handle transient failures
3. **Add scraping method metrics** - Track HTTP vs Puppeteer usage
4. **Create health check endpoint** - Monitor scraper status

### Technical Debt to Address
1. Remove unused puppeteer-extra imports
2. Consolidate duplicate browser configuration
3. Standardize error handling patterns
4. Add comprehensive logging for debugging

---

## Appendix A: File List

### Files Requiring Changes
```
backend/services/scraping/
├── core/
│   ├── browser-manager.ts      [Major changes]
│   └── page-setup.ts           [Import change]
├── scrapers/
│   ├── http-scraper.ts         [Interface update]
│   └── puppeteer-scraper/
│       └── main-scraper.ts     [Const fix, import change]
└── extractors/
    └── structure-detection/
        └── structure-detector.ts [Import verification]
```

### Dependencies to Update
```json
{
  "dependencies": {
    "rebrowser-puppeteer": "^[current]",
    // Remove:
    // "puppeteer": "^[version]",
    // "puppeteer-extra": "^[version]",
    // "puppeteer-extra-plugin-stealth": "^[version]"
  }
}
```

---

## Appendix B: Error Examples

### Current Error Output
```
Type 'import("puppeteer").Page' is not assignable to type 'import("rebrowser-puppeteer").Page'
Property '#private' in type 'Page' refers to a different member
```

### Expected After Fix
```
✓ All TypeScript checks pass
✓ Browser launches successfully
✓ Pages created without type errors
✓ Scraping completes for all content types
```

---

## Document Version
- **Created:** January 2025
- **Author:** System Analysis
- **Status:** Proposed
- **Review Required:** Yes

---

## Next Steps
1. Review and approve this plan
2. Create backup of current system
3. Implement Phase 1 fixes
4. Test and validate
5. Proceed with remaining phases

---

*End of Document*