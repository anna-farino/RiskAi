# Scraper Enhancement Plan

## Current Issues Diagnosed

### 1. HTMX Site Challenges
**Problem**: Sites like foorilla.com/media/cybersecurity use HTMX for dynamic content loading
- Content loads via AJAX calls triggered by HTMX attributes (`hx-get`, `hx-post`)
- Traditional scraping misses dynamically loaded content
- Links may not be present in initial HTML response

**Current Handling**: We detect HTMX attributes but may not wait for content to load

### 2. Protection Detection Limitations
**Problem**: Some sites return empty responses or use advanced protection
- CycleTLS not available in Replit (already handled with fallback)
- Some sites may require more sophisticated browser fingerprinting
- Empty responses from curl suggest aggressive bot protection

### 3. Dynamic Content Loading Issues
**Problem**: Content that loads after initial page render
- Infinite scroll implementations
- Lazy-loaded articles
- Client-side rendered content

## Enhancement Options

### Option 1: Enhanced HTMX Handler
**Priority: HIGH**
```javascript
// Improvements needed:
1. Detect HTMX framework presence
2. Trigger HTMX events programmatically
3. Wait for HTMX content to load
4. Extract dynamically loaded links
```

**Implementation Strategy**:
- Add HTMX event listeners (`htmx:afterSwap`, `htmx:load`)
- Programmatically trigger HTMX requests
- Wait for content containers to populate
- Extract links from dynamically loaded content

### Option 2: Intelligent Wait Strategies
**Priority: HIGH**
```javascript
// Smart waiting for dynamic content:
1. Wait for specific selectors that indicate content loaded
2. Monitor network activity for completion
3. Check for DOM mutations
4. Implement progressive timeout strategy
```

**Benefits**:
- Reduces unnecessary wait times
- Ensures content is fully loaded
- Handles various loading patterns

### Option 3: Enhanced Browser Fingerprinting
**Priority: MEDIUM**
```javascript
// Since CycleTLS isn't available:
1. Enhance Puppeteer stealth configuration
2. Rotate user agents more intelligently
3. Implement viewport and screen resolution randomization
4. Add more realistic mouse movements and interactions
```

**Implementation**:
- Use puppeteer-extra-plugin-stealth (already in use)
- Add random delays between actions
- Implement human-like scrolling patterns
- Randomize browser properties

### Option 4: Multi-Stage Scraping Pipeline
**Priority: HIGH**
```javascript
// Progressive scraping approach:
Stage 1: Initial HTTP request with Chrome headers
Stage 2: If empty/protected, use Puppeteer with basic stealth
Stage 3: If HTMX detected, use HTMX-aware Puppeteer scraping
Stage 4: If still failing, use advanced interaction patterns
Stage 5: Log and mark as protected for manual review
```

**Benefits**:
- Efficient resource usage
- Adaptive to site requirements
- Better success rates

### Option 5: HTMX-Specific Scraping Module
**Priority: HIGH**

Create a dedicated module for HTMX sites with:
1. **HTMX Event Simulation**
   - Programmatically trigger `hx-get` requests
   - Handle `hx-target` replacements
   - Process `hx-swap` operations

2. **Content Assembly**
   - Track all HTMX requests
   - Assemble complete page from fragments
   - Maintain request order and dependencies

3. **Link Extraction from Fragments**
   - Extract links from each HTMX response
   - Merge with main page links
   - Handle relative URLs in fragments

### Option 6: Request Interception and Replay
**Priority: MEDIUM**
```javascript
// Intercept and analyze network requests:
1. Capture all XHR/Fetch requests
2. Identify content-bearing requests
3. Replay requests directly to get data
4. Parse JSON/HTML responses for links
```

**Use Cases**:
- API-driven sites
- Sites that load content via JSON endpoints
- HTMX sites with predictable request patterns

### Option 7: Enhanced Error Recovery
**Priority: MEDIUM**
```javascript
// Better error handling:
1. Classify error types (timeout, protection, empty content)
2. Implement specific recovery strategies per error type
3. Add exponential backoff with jitter
4. Track site-specific failure patterns
```

## Recommended Implementation Order

### Phase 1: HTMX Enhancement (1-2 days)
1. Implement HTMX event detection and waiting
2. Add programmatic HTMX triggering
3. Test with foorilla.com and similar sites

### Phase 2: Intelligent Waiting (1 day)
1. Implement smart wait strategies
2. Add DOM mutation observers
3. Monitor network idle states

### Phase 3: Multi-Stage Pipeline (2 days)
1. Refactor scraper to use progressive stages
2. Add stage-specific optimizations
3. Implement fallback chains

### Phase 4: Request Interception (1 day)
1. Add request interception capabilities
2. Implement request replay logic
3. Parse API responses for content

### Phase 5: Monitoring and Optimization (1 day)
1. Add detailed performance metrics
2. Implement success rate tracking
3. Create site-specific optimization profiles

## Testing Strategy

### Test Sites
1. **foorilla.com/media/cybersecurity** - HTMX-heavy site
2. **techcrunch.com** - JavaScript-heavy with lazy loading
3. **reuters.com** - Traditional news site with some dynamic content
4. **bleepingcomputer.com** - Mixed content loading strategies
5. **thehackernews.com** - Cloudflare protected

### Success Metrics
- Minimum 10 links extracted per source
- 90%+ success rate for non-protected sites
- Proper content extraction from HTMX sites
- Response time under 30 seconds per source

## Implementation Notes

### For HTMX Sites Specifically
```javascript
// Key implementation points:
1. Wait for htmx to be available: await page.waitForFunction(() => window.htmx)
2. Trigger all hx-get elements: await page.evaluate(() => htmx.processElement(document.body))
3. Wait for requests to complete: await page.waitForFunction(() => htmx.requestsInFlight === 0)
4. Extract content after all swaps complete
```

### Browser Configuration Optimizations
```javascript
// Recommended Puppeteer args for better compatibility:
'--disable-blink-features=AutomationControlled',
'--disable-features=IsolateOrigins,site-per-process',
'--disable-setuid-sandbox',
'--disable-accelerated-2d-canvas',
'--disable-gpu',
'--no-first-run',
'--no-zygote',
'--single-process', // Important for resource-constrained environments
'--disable-web-security', // For CORS issues with HTMX
'--disable-features=VizDisplayCompositor'
```

## Alternative Approaches

### If HTMX handling remains problematic:
1. **Direct API Discovery**: Analyze network traffic to find data APIs
2. **Headless Browser Pools**: Maintain persistent browser sessions
3. **External Scraping Service**: Use services like ScraperAPI for difficult sites
4. **Site-Specific Adapters**: Create custom scrapers for high-value sources

## Conclusion

The primary focus should be on enhancing HTMX handling and implementing intelligent wait strategies. This will significantly improve success rates for modern JavaScript-heavy news sites. The multi-stage pipeline approach will ensure efficient resource usage while maintaining high success rates.