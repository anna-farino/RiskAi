import { log } from "backend/utils/log";
import { scrapeWithHTTP } from '../scrapers/http-scraper';
import { scrapeWithPuppeteer } from '../scrapers/puppeteer-scraper/main-scraper';
import { RedirectInfo } from './redirect-resolver';

/**
 * Smart method selection with redirect resolution
 * HTTP first, but switch to Puppeteer for dynamic content sites
 */
export async function getContent(url: string, isArticle: boolean = false): Promise<{ html: string, method: 'http' | 'puppeteer', redirectInfo?: RedirectInfo }> {
  // Try HTTP first (redirect resolution is handled within scrapeWithHTTP)
  const httpResult = await scrapeWithHTTP(url, { timeout: 30000 });
  
  // Log redirect information if available
  if (httpResult.redirectInfo?.hasRedirects) {
    log(`[SimpleScraper] HTTP redirect detected: ${httpResult.redirectInfo.redirectChain.join(' → ')}`, "scraper");
  }
  
  // If HTTP succeeds, check if content looks dynamic/incomplete
  if (httpResult.success && httpResult.html.length > 1000) {
    log(`[SimpleScraper] HTTP successful (${httpResult.html.length} chars)`, "scraper");
    
    // For source pages (not articles), check if we need dynamic content loading
    if (!isArticle) {
      const needsDynamicLoading = detectDynamicContentNeeds(httpResult.html, httpResult.finalUrl || url);
      if (needsDynamicLoading) {
        log(`[SimpleScraper] Dynamic content detected, switching to Puppeteer for better link extraction`, "scraper");
        const puppeteerResult = await scrapeWithPuppeteer(httpResult.finalUrl || url, {
          timeout: 60000,
          isArticlePage: false,
          handleHTMX: true,
          scrollToLoad: true,
          protectionBypass: true
        });
        
        if (puppeteerResult.success) {
          log(`[SimpleScraper] Puppeteer dynamic content successful (${puppeteerResult.html.length} chars)`, "scraper");
          if (puppeteerResult.redirectInfo?.hasRedirects) {
            log(`[SimpleScraper] Puppeteer redirect detected: ${puppeteerResult.redirectInfo.redirectChain.join(' → ')}`, "scraper");
          }
          return { html: puppeteerResult.html, method: 'puppeteer', redirectInfo: puppeteerResult.redirectInfo };
        }
      }
    }
    
    if (httpResult.protectionDetected?.hasProtection) {
      log(`[SimpleScraper] Protection detected but HTTP content sufficient, proceeding with HTTP`, "scraper");
    }
    return { html: httpResult.html, method: 'http', redirectInfo: httpResult.redirectInfo };
  }
  
  // Only use Puppeteer if HTTP truly failed or returned insufficient content
  log(`[SimpleScraper] HTTP insufficient (success: ${httpResult.success}, length: ${httpResult.html.length}), using Puppeteer fallback`, "scraper");
  const puppeteerResult = await scrapeWithPuppeteer(httpResult.finalUrl || url, {
    timeout: 60000,
    isArticlePage: isArticle,
    handleHTMX: !isArticle,
    scrollToLoad: !isArticle,
    protectionBypass: true
  });
  
  if (!puppeteerResult.success) {
    throw new Error(`Both HTTP and Puppeteer failed for: ${url}`);
  }
  
  log(`[SimpleScraper] Puppeteer successful (${puppeteerResult.html.length} chars)`, "scraper");
  if (puppeteerResult.redirectInfo?.hasRedirects) {
    log(`[SimpleScraper] Puppeteer redirect detected: ${puppeteerResult.redirectInfo.redirectChain.join(' → ')}`, "scraper");
  }
  return { html: puppeteerResult.html, method: 'puppeteer', redirectInfo: puppeteerResult.redirectInfo };
}

/**
 * Detect if a page needs dynamic content loading (HTMX, JavaScript, etc.)
 * Enhanced to reduce false positives while maintaining HTMX functionality
 */
export function detectDynamicContentNeeds(html: string, url: string): boolean {
  const htmlLower = html.toLowerCase();
  
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
  
  // SPA frameworks (high confidence for dynamic content)
  const hasSPAFrameworks = htmlLower.includes('react-root') || 
                          htmlLower.includes('ng-app') || 
                          htmlLower.includes('vue-app') ||
                          htmlLower.includes('__next') ||
                          htmlLower.includes('nuxt');
  
  // Decision logic: Require stronger evidence to switch to Puppeteer
  // Only switch if there's clear evidence of missing content, not just modern frameworks
  const needsDynamic = hasStrongHTMX || // Strong HTMX evidence (requires dynamic loading)
                      hasVeryFewLinks || // Very minimal links (incomplete content)
                      hasEmptyContentContainers || // Empty containers with loading (content not loaded)
                      (hasSPAFrameworks && (hasVeryFewLinks || hasContentLoading)) || // SPA + evidence of missing content
                      (hasDynamicLoading && hasContentLoading); // Multiple weak signals
  
  if (needsDynamic) {
    log(`[SimpleScraper] Dynamic content detected - Strong HTMX: ${hasStrongHTMX}, SPA frameworks: ${hasSPAFrameworks}, very few links: ${hasVeryFewLinks} (${linkCount}), dynamic loading: ${hasDynamicLoading}, content loading: ${hasContentLoading}, empty containers: ${hasEmptyContentContainers}`, "scraper");
  }
  
  return needsDynamic;
}