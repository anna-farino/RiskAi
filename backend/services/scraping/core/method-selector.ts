import { log } from "backend/utils/log";
import { scrapeWithHTTP } from '../scrapers/http-scraper';
import { scrapeWithPuppeteer } from '../scrapers/puppeteer-scraper/main-scraper';

/**
 * Smart method selection
 * HTTP first, but switch to Puppeteer for dynamic content sites
 */
export async function getContent(url: string, isArticle: boolean = false): Promise<{ html: string, method: 'http' | 'puppeteer' }> {
  // Try HTTP first
  const httpResult = await scrapeWithHTTP(url, { timeout: 12000 }); // Reduced to 12s

  // If HTTP succeeds, check if content looks dynamic/incomplete
  if (httpResult.success && httpResult.html.length > 1000) {
    log(`[SimpleScraper] HTTP successful (${httpResult.html.length} chars)`, "scraper");
    
    // For source pages (not articles), check if we need dynamic content loading
    // Only switch to Puppeteer if HTTP content is insufficient (< 50KB) or has strong HTMX indicators
    if (!isArticle) {
      const needsDynamicLoading = detectDynamicContentNeeds(httpResult.html, url);
      const hasSubstantialContent = httpResult.html.length > 50000; // 50KB threshold
      
      if (needsDynamicLoading && !hasSubstantialContent) {
        log(`[SimpleScraper] Dynamic content detected with minimal content (${httpResult.html.length} chars), switching to Puppeteer`, "scraper");

        const puppeteerResult = await scrapeWithPuppeteer(url, {
          timeout: 60000,
          isArticlePage: false,
          handleHTMX: true,
          scrollToLoad: true,
          protectionBypass: true
        });
        
        if (puppeteerResult.success) {
          log(`[SimpleScraper] Puppeteer dynamic content successful (${puppeteerResult.html.length} chars)`, "scraper");
          return { html: puppeteerResult.html, method: 'puppeteer' };
        }

      } else if (needsDynamicLoading && hasSubstantialContent) {
        log(`[SimpleScraper] Dynamic content detected but substantial content already extracted (${httpResult.html.length} chars), staying with HTTP`, "scraper");
      }
    }
    
    if (httpResult.protectionDetected?.hasProtection) {
      log(`[SimpleScraper] Protection detected but HTTP content sufficient, proceeding with HTTP`, "scraper");
    }
    return { html: httpResult.html, method: 'http' };
  }
  
  // Only use Puppeteer if HTTP truly failed or returned insufficient content
  log(`[SimpleScraper] HTTP insufficient (success: ${httpResult.success}, length: ${httpResult.html.length}), using Puppeteer fallback`, "scraper");
  
  // Retry Puppeteer up to 2 times if browser disconnection occurs
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const puppeteerResult = await scrapeWithPuppeteer(url, {
        timeout: 60000,
        isArticlePage: isArticle,
        handleHTMX: !isArticle,
        scrollToLoad: !isArticle,
        protectionBypass: true
      });
      
      if (puppeteerResult.success) {
        log(`[SimpleScraper] Puppeteer successful on attempt ${attempt} (${puppeteerResult.html.length} chars)`, "scraper");
        return { html: puppeteerResult.html, method: 'puppeteer' };
      }
      
      // If Puppeteer didn't succeed but didn't throw, save the error
      lastError = new Error(`Puppeteer returned unsuccessful result`);
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a browser disconnection error
      const isBrowserError = error.message?.includes('Navigating frame was detached') ||
                            error.message?.includes('Protocol error') ||
                            error.message?.includes('Connection closed') ||
                            error.message?.includes('Target closed') ||
                            error.message?.includes('Browser disconnected');
      
      if (isBrowserError && attempt < 2) {
        log(`[SimpleScraper] Browser error on attempt ${attempt}, will retry: ${error.message}`, "scraper");
        // Give browser time to restart (handled in puppeteer-scraper)
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      // For non-browser errors or final attempt, break the loop
      break;
    }
  }
  
  // If we got here, all attempts failed
  throw new Error(`Both HTTP and Puppeteer failed for: ${url}${lastError ? ` - ${lastError.message}` : ''}`);
}

/**
 * Detect if a page needs dynamic content loading (HTMX, JavaScript, etc.)
 * Enhanced to reduce false positives while maintaining HTMX functionality
 * More conservative when substantial content already exists
 */
export function detectDynamicContentNeeds(html: string, url: string): boolean {
  const htmlLower = html.toLowerCase();
  const htmlLength = html.length;
  
  // PRIMARY: Strong HTMX indicators (high confidence)
  const strongHTMXIndicators = [
    'hx-get=', 'hx-post=', 'hx-trigger=', 'data-hx-get=', 'data-hx-post=',
    'htmx.min.js', 'htmx.js', 'unpkg.com/htmx'
  ];
  
  const hasStrongHTMX = strongHTMXIndicators.some(indicator => 
    htmlLower.includes(indicator)
  );
  
  // SECONDARY: Dynamic loading patterns (medium confidence)
  const dynamicLoadingIndicators = [
    'load-more', 'lazy-load', 'infinite-scroll', 'ajax-load',
    'data-react-root', 'ng-app=', 'v-app', '@click='
  ];
  
  const hasDynamicLoading = dynamicLoadingIndicators.some(indicator => 
    htmlLower.includes(indicator)
  );
  
  // TERTIARY: Content loading states (low confidence - need multiple signals)
  const contentLoadingStates = [
    'content-skeleton', 'article-skeleton', 'loading-spinner',
    'posts-loading', 'articles-loading', 'content-placeholder'
  ];
  
  const hasContentLoading = contentLoadingStates.some(indicator => 
    htmlLower.includes(indicator)
  );
  
  // Check for minimal links (strong indicator if very few)
  const linkCount = (html.match(/<a[^>]*href[^>]*>/gi) || []).length;
  const hasVeryFewLinks = linkCount < 5; // Reduced threshold for stronger signal
  
  // Check for empty content containers with loading indicators
  const hasEmptyContentContainers = (
    htmlLower.includes('articles-container') || 
    htmlLower.includes('posts-container') ||
    htmlLower.includes('content-container')
  ) && (
    htmlLower.includes('loading') || 
    htmlLower.includes('spinner') ||
    htmlLower.includes('skeleton')
  );
  
  // SPA frameworks (moderate confidence - many sites have frameworks but work with HTTP)
  const hasSPAFrameworks = htmlLower.includes('react-root') || 
                          htmlLower.includes('ng-app') || 
                          htmlLower.includes('vue-app') ||
                          htmlLower.includes('__next') ||
                          htmlLower.includes('nuxt');
  
  // Enhanced decision logic: More conservative when substantial content exists
  const hasSubstantialContent = htmlLength > 50000; // 50KB threshold
  
  let needsDynamic = false;
  
  if (hasSubstantialContent) {
    // With substantial content, only switch for very strong indicators
    needsDynamic = hasStrongHTMX || // Strong HTMX evidence
                   hasVeryFewLinks || // Very minimal links despite large content
                   hasEmptyContentContainers; // Empty containers with loading
  } else {
    // With minimal content, use original logic
    needsDynamic = hasStrongHTMX || // Strong HTMX evidence
                   hasSPAFrameworks || // SPA framework detected
                   hasVeryFewLinks || // Very minimal links
                   hasEmptyContentContainers || // Empty containers with loading
                   (hasDynamicLoading && hasContentLoading); // Multiple weak signals
  }
  
  if (needsDynamic) {
    log(`[SimpleScraper] Dynamic content detected - Strong HTMX: ${hasStrongHTMX}, SPA frameworks: ${hasSPAFrameworks}, very few links: ${hasVeryFewLinks} (${linkCount}), dynamic loading: ${hasDynamicLoading}, content loading: ${hasContentLoading}, empty containers: ${hasEmptyContentContainers}, substantial content: ${hasSubstantialContent} (${htmlLength} chars)`, "scraper");
  }
  
  return needsDynamic;
}