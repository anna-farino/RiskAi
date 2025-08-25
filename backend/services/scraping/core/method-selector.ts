import { log } from "backend/utils/log";
import { scrapeWithHTTP } from '../scrapers/http-scraper';
import { scrapeWithPuppeteer } from '../scrapers/puppeteer-scraper/main-scraper';

/**
 * Web fetch function that uses native fetch with enhanced headers
 */
async function performWebFetch(url: string): Promise<string | null> {
  try {
    log(`[WebFetch] Attempting web fetch for: ${url}`, "scraper");
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        'DNT': '1'
      },
      redirect: 'follow'
    });
    
    log(`[WebFetch] Response status: ${response.status}`, "scraper");
    
    if (!response.ok) {
      log(`[WebFetch] Response not OK: ${response.status} ${response.statusText}`, "scraper");
      return null;
    }
    
    const content = await response.text();
    log(`[WebFetch] Content length: ${content.length}`, "scraper");
    
    return content;
  } catch (error: any) {
    log(`[WebFetch] Error: ${error.message}`, "scraper-error");
    return null;
  }
}

/**
 * Smart method selection with three-tier approach
 * 1. HTTP first (custom fetch with protection bypass)
 * 2. Web fetch fallback (enhanced native fetch)  
 * 3. Puppeteer for dynamic content sites
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
  
  // Try web_fetch as middle option before Puppeteer
  log(`[SimpleScraper] HTTP insufficient (success: ${httpResult.success}, length: ${httpResult.html.length}), trying web_fetch`, "scraper");
  
  try {
    const webFetchResult = await performWebFetch(url);
    
    if (webFetchResult && webFetchResult.length > 10000) {
      log(`[SimpleScraper] Web_fetch successful (${webFetchResult.length} chars)`, "scraper");
      return { html: webFetchResult, method: 'http' }; // Mark as http since it's still HTTP-based
    } else {
      log(`[SimpleScraper] Web_fetch insufficient content (${webFetchResult?.length || 0} chars)`, "scraper");
    }
  } catch (webFetchError: any) {
    log(`[SimpleScraper] Web_fetch failed: ${webFetchError.message}`, "scraper");
  }
  
  // Only use Puppeteer if both HTTP and web_fetch failed
  log(`[SimpleScraper] Both HTTP and web_fetch insufficient, using Puppeteer fallback`, "scraper");
  
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