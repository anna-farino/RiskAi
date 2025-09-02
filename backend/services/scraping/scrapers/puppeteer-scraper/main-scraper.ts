import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import { setupArticlePage, setupSourcePage } from '../../core/page-setup';
import { validateContent } from '../../core/error-detection';
import { 
  bypassProtection, 
  ProtectionInfo, 
  getRandomBrowserProfile,
  applyEnhancedFingerprinting,
  performEnhancedHumanActions,
  performBehavioralDelay,
  detectDataDomeChallenge,
  EnhancedScrapingOptions 
} from '../../core/protection-bypass';
import { ScrapingResult } from '../http-scraper';
import { isExternalValidationError } from './error-handler';
import { handleHTMXContent } from './htmx-handler';
import { handleDynamicContent } from './dynamic-handler';
// Content extraction now handled inline

export interface PuppeteerScrapingOptions extends EnhancedScrapingOptions {
  isArticlePage?: boolean;
  waitForContent?: boolean;
  scrollToLoad?: boolean;
  handleHTMX?: boolean;
  scrapingConfig?: any;
  protectionBypass?: boolean;
  customHeaders?: Record<string, string>;
  timeout?: number;
  enhancedFingerprinting?: boolean;
  enhancedHumanActions?: boolean;
}

/**
 * Wait for preloader to complete and content to fully load
 * URL-agnostic approach that works with various preloader patterns
 */
async function waitForPreloaderComplete(page: Page): Promise<void> {
  const maxWaitTime = 30000; // 30 seconds maximum
  const startTime = Date.now();
  
  try {
    // Strategy 1: Wait for preloader elements to disappear
    await page.waitForFunction(() => {
      const preloaderSelectors = [
        '.loader', '.loading', '.preloader', '.spinner', 
        '#loader', '#loading', '#preloader', '#spinner',
        '[class*="load"]', '[class*="spin"]', '[id*="load"]', '[id*="spin"]'
      ];
      
      const visiblePreloaders = preloaderSelectors.some(selector => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).some(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
      });
      
      return !visiblePreloaders; // Return true when no visible preloaders
    }, { timeout: 15000 }).catch(() => {
      log(`[PuppeteerScraper] Preloader element wait timeout, continuing...`, "scraper");
    });
    
    // Strategy 2: Wait for content containers to appear and stabilize
    await page.waitForFunction(() => {
      const contentSelectors = ['main', '.content', '.main-content', '#content', '.container', '.wrapper'];
      const hasContent = contentSelectors.some(selector => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && element.children.length > 0;
      });
      
      // Also check for a reasonable number of links as a content indicator
      const linkCount = document.querySelectorAll('a[href]').length;
      return hasContent && linkCount > 5;
    }, { timeout: 10000 }).catch(() => {
      log(`[PuppeteerScraper] Content appearance wait timeout, continuing...`, "scraper");
    });
    
    // Strategy 3: Wait for additional resources to load (images, scripts, etc.)
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give 3 seconds for additional resources
    
    const totalWaitTime = Date.now() - startTime;
    log(`[PuppeteerScraper] Preloader wait completed in ${totalWaitTime}ms`, "scraper");
    
  } catch (error: any) {
    log(`[PuppeteerScraper] Preloader wait error: ${error.message}`, "scraper");
    // Don't throw - continue with scraping even if preloader detection fails
  }
}

/**
 * Main Puppeteer scraping function
 * Consolidates Puppeteer scraping logic from all three apps
 */
export async function scrapeWithPuppeteer(url: string, options?: PuppeteerScrapingOptions): Promise<ScrapingResult> {
  const startTime = Date.now();
  let page: Page | null = null;

  try {
    log(`[PuppeteerScraper] Starting enhanced Puppeteer scraping for: ${url}`, "scraper");

    // Get random browser profile for fingerprint rotation
    const browserProfile = options?.browserProfile || getRandomBrowserProfile();
    log(`[PuppeteerScraper] Using ${browserProfile.deviceType} browser profile`, "scraper");

    // Set up page based on context
    if (options?.isArticlePage) {
      page = await setupArticlePage({
        headers: options.customHeaders || browserProfile.headers,
        timeouts: { navigation: options.timeout || 60000, default: options.timeout || 60000 }
      });
    } else {
      page = await setupSourcePage({
        headers: options.customHeaders || browserProfile.headers,
        timeouts: { navigation: options.timeout || 45000, default: options.timeout || 45000 }
      });
    }

    // Apply enhanced fingerprinting
    if (options?.enhancedFingerprinting !== false) {
      await applyEnhancedFingerprinting(page, browserProfile);
    }

    log(`[PuppeteerScraper] Page setup completed, navigating to URL`, "scraper");

    // Apply behavioral delay before navigation
    await performBehavioralDelay(options);

    // Navigate to the page with dynamic fallback mechanism
    let response;
    let statusCode = 0;
    
    try {
      // Start with networkidle2 and fallback to domcontentloaded if it fails
      let waitCondition: 'networkidle2' | 'domcontentloaded' = 'networkidle2';
      let navTimeout = 30000;
      
      log(`[PuppeteerScraper] Navigating with ${waitCondition} (timeout: ${navTimeout}ms)`, "scraper");
      
      try {
        response = await page.goto(url, { 
          waitUntil: waitCondition,
          timeout: navTimeout 
        });
        statusCode = response ? response.status() : 0;
      } catch (networkIdleError: any) {
        // If networkidle2 fails, fallback to domcontentloaded
        if (networkIdleError.message?.includes('timeout') || 
            networkIdleError.message?.includes('Navigation timeout') ||
            networkIdleError.message?.includes('waiting for event')) {
          
          log(`[PuppeteerScraper] networkidle2 failed (${networkIdleError.message.substring(0, 100)}), falling back to domcontentloaded`, "scraper");
          
          waitCondition = 'domcontentloaded';
          navTimeout = 15000;
          
          response = await page.goto(url, { 
            waitUntil: waitCondition,
            timeout: navTimeout 
          });
          statusCode = response ? response.status() : 0;
          
          // Give additional time for content to load after domcontentloaded
          log(`[PuppeteerScraper] Using domcontentloaded fallback, waiting for content...`, "scraper");
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Re-throw non-timeout errors
          throw networkIdleError;
        }
      }
      
    } catch (navError: any) {
      // Handle frame detachment specifically
      if (navError.message?.includes('frame was detached') || 
          navError.message?.includes('Frame detached') ||
          navError.message?.includes('Navigating frame was detached')) {
        log(`[PuppeteerScraper] Frame detached during navigation - attempting recovery`, "scraper");
        
        // Try alternative navigation methods
        try {
          // Method 1: Try to get current content
          const html = await page.content().catch(() => '');
          if (html && html.length > 1000) {
            log(`[PuppeteerScraper] Retrieved content via page.content() despite frame detachment`, "scraper");
            return {
              html,
              success: true,
              method: 'puppeteer',
              responseTime: Date.now() - startTime,
              statusCode: 200,
              finalUrl: url
            };
          }
          
          // Method 2: Try evaluate to get innerHTML
          const evaluatedHtml = await page.evaluate(() => document.documentElement.outerHTML).catch(() => '');
          if (evaluatedHtml && evaluatedHtml.length > 1000) {
            log(`[PuppeteerScraper] Retrieved content via evaluate despite frame detachment`, "scraper");
            return {
              html: evaluatedHtml,
              success: true,
              method: 'puppeteer',
              responseTime: Date.now() - startTime,
              statusCode: 200,
              finalUrl: url
            };
          }
          
          // Method 3: Create new page and retry with different strategy
          log(`[PuppeteerScraper] Creating new page for retry with stealth navigation`, "scraper");
          await page.close().catch(() => {});
          
          page = await setupArticlePage({
            headers: options?.customHeaders || browserProfile.headers,
            timeouts: { navigation: 10000, default: 10000 }
          });
          
          // Apply maximum stealth
          await applyEnhancedFingerprinting(page, browserProfile);
          
          // Try navigation with minimal wait
          const retryResponse = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          }).catch(() => null);
          
          if (retryResponse || page.url() !== 'about:blank') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryHtml = await page.content().catch(() => '');
            if (retryHtml && retryHtml.length > 500) {
              log(`[PuppeteerScraper] Successfully retrieved content on retry`, "scraper");
              return {
                html: retryHtml,
                success: true,
                method: 'puppeteer',
                responseTime: Date.now() - startTime,
                statusCode: retryResponse?.status() || 200,
                finalUrl: page.url()
              };
            }
          }
          
        } catch (recoveryError: any) {
          log(`[PuppeteerScraper] Recovery attempt failed: ${recoveryError.message}`, "scraper");
        }
      }
      
      // For other navigation errors, still throw
      throw navError;
    }
    
    log(`[PuppeteerScraper] Navigation completed. Status: ${statusCode}`, "scraper");

    // Handle specific status codes with appropriate strategies
    if (response && !response.ok()) {
      log(`[PuppeteerScraper] Warning: Response status is not OK: ${statusCode}`, "scraper");
      
      if (statusCode === 401) {
        log(`[PuppeteerScraper] 401 Unauthorized - attempting paywall bypass strategies`, "scraper");
        
        // Strategy 1: Try search engine bot user agent
        try {
          await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
          await page.setExtraHTTPHeaders({
            'From': 'googlebot(at)google.com',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          });
          
          log(`[PuppeteerScraper] Retrying with Googlebot user agent for paywall bypass`, "scraper");
          await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
          
          // Check if this improved the content
          const retryHtml = await page.content();
          const retryLinks = (retryHtml.match(/<a[^>]+href=/g) || []).length;
          
          if (retryLinks >= 10) {
            log(`[PuppeteerScraper] Paywall bypass successful with Googlebot (${retryLinks} links)`, "scraper");
            // We'll need to re-extract content later since this is before html declaration
            // Just log success for now - the improved content will be picked up by normal extraction
          } else {
            log(`[PuppeteerScraper] Googlebot bypass insufficient (${retryLinks} links), continuing with original content`, "scraper");
          }
        } catch (bypassError: any) {
          log(`[PuppeteerScraper] Paywall bypass attempt failed: ${bypassError.message}`, "scraper");
        }
      } else if (statusCode === 403) {
        log(`[PuppeteerScraper] 403 Forbidden - site blocking access`, "scraper");
      } else if (statusCode === 503) {
        log(`[PuppeteerScraper] 503 Service Unavailable - site temporarily down or overloaded`, "scraper");
      }
    }

    // Wait for page to stabilize with behavioral delay
    await performBehavioralDelay(options);

    // Enhanced DataDome challenge detection
    if (options?.protectionBypass !== false) {
      const isDataDomeChallenge = await detectDataDomeChallenge(page);
      
      if (isDataDomeChallenge) {
        log(`[PuppeteerScraper] DataDome challenge detected, attempting enhanced bypass`, "scraper");
        
        const protectionInfo: ProtectionInfo = {
          hasProtection: true,
          type: 'datadome',
          confidence: 0.95,
          details: 'DataDome challenge detected'
        };

        const bypassSuccess = await bypassProtection(page, protectionInfo);
        if (!bypassSuccess) {
          log(`[PuppeteerScraper] DataDome bypass failed`, "scraper");
        } else {
          log(`[PuppeteerScraper] DataDome bypass successful`, "scraper");
          
          // Perform enhanced human actions after bypass
          if (options?.enhancedHumanActions !== false) {
            await performEnhancedHumanActions(page);
          }
        }
      } else {
        // Check for specific protection types with proper classification
        const protectionCheck = await page.evaluate(() => {
          const title = document.title || '';
          const bodyText = document.body?.textContent || '';
          const html = document.documentElement?.innerHTML || '';
          
          // Cloudflare-specific detection
          const isCloudflare = title.toLowerCase().includes('just a moment') ||
                              title.toLowerCase().includes('please wait') ||
                              bodyText.includes('Checking your browser') ||
                              bodyText.includes('DDoS protection') ||
                              html.includes('cdn-cgi/challenge-platform') ||
                              html.includes('cf-challenge') ||
                              html.includes('cloudflare') ||
                              html.includes('CloudFlare') ||
                              !!document.querySelector('*[class*="cf-"]') ||
                              !!document.querySelector('#challenge-form');
          
          // Incapsula-specific detection
          const isIncapsula = html.includes('_Incapsula_Resource') ||
                             html.includes('Incapsula') ||
                             bodyText.includes('Incapsula incident');
          
          // Generic protection (CAPTCHA, etc.)
          const isGenericProtection = bodyText.includes('captcha') ||
                                     bodyText.includes('Captcha') ||
                                     bodyText.includes('CAPTCHA');
          
          return {
            hasProtection: isCloudflare || isIncapsula || isGenericProtection,
            type: isCloudflare ? 'cloudflare' : (isIncapsula ? 'incapsula' : 'generic'),
            indicators: {
              cloudflare: isCloudflare,
              incapsula: isIncapsula,
              generic: isGenericProtection
            }
          };
        });

        if (protectionCheck.hasProtection) {
          log(`[PuppeteerScraper] ${protectionCheck.type} protection detected, attempting bypass`, "scraper");
          
          const protectionInfo: ProtectionInfo = {
            hasProtection: true,
            type: protectionCheck.type as any,
            confidence: protectionCheck.type === 'cloudflare' ? 0.95 : 0.8,
            details: `${protectionCheck.type} protection detected`
          };

          const bypassSuccess = await bypassProtection(page, protectionInfo);
          if (!bypassSuccess) {
            log(`[PuppeteerScraper] ${protectionCheck.type} protection bypass failed`, "scraper");
          } else {
            log(`[PuppeteerScraper] ${protectionCheck.type} protection bypass successful`, "scraper");
            await performBehavioralDelay(options);
          }
        }
      }
    }

    // Extract content first to check if we already have good content
    let html = await page.content();
    const contentLength = html.length;
    
    log(`[PuppeteerScraper] Initial content extracted (${contentLength} chars)`, "scraper");
    
    // Validate content quality - use isArticlePage option to determine validation type
    const validation = await validateContent(html, url, options?.isArticlePage || false);
    
    if (!validation.isValid || validation.isErrorPage) {
      log(`[PuppeteerScraper] Content validation warning: ${validation.errorIndicators.join(', ')}, confidence: ${validation.confidence}%`, "scraper");
    }
    
    // Only warn about link count for source pages, not articles
    if (!options?.isArticlePage && validation.linkCount < 10) {
      log(`[PuppeteerScraper] Warning: Only ${validation.linkCount} links found (minimum 10 recommended for source pages)`, "scraper");
    }

    // Detect HTMX presence on the page
    const htmxDetected = await page.evaluate(() => {
      return !!(window as any).htmx || 
             !!document.querySelector('[hx-get], [hx-post], [hx-trigger], script[src*="htmx"]') ||
             !!document.querySelector('[data-hx-get], [data-hx-post], [data-hx-trigger]');
    });
    
    // Detect preloader patterns on the page (with error handling)
    const preloaderDetected = await page.evaluate(() => {
      try {
        // Common preloader selectors and patterns
        const preloaderSelectors = [
          '.loader', '.loading', '.preloader', '.spinner', 
          '#loader', '#loading', '#preloader', '#spinner',
          '[class*="load"]', '[class*="spin"]', '[id*="load"]', '[id*="spin"]'
        ];
        
        const hasPreloaderElements = preloaderSelectors.some(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements).some(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden';
            });
          } catch (e) {
            return false;
          }
        });
        
        // Check for preloader text content
        const bodyText = document.body?.textContent || '';
        const hasPreloaderText = /loading|please wait|getting ready/i.test(bodyText);
        
        // Check for common preloader JavaScript patterns
        const hasPreloaderJS = !!(window as any).showLoader || 
                             !!(window as any).hideLoader ||
                             !!(window as any).loadContent ||
                             !!document.querySelector('script[src*="loader"]') ||
                             !!document.querySelector('script[src*="preload"]');
        
        return hasPreloaderElements || hasPreloaderText || hasPreloaderJS;
      } catch (error) {
        console.error('Preloader detection error:', error);
        return false; // Default to false on error
      }
    }).catch(() => false); // Ensure we always return a boolean
    
    // Determine what type of dynamic content loading is needed
    const hasMinimalContent = contentLength < 50000; // Less than 50KB indicates minimal content
    const needsDynamicLoading = hasMinimalContent || htmxDetected || preloaderDetected;
    
    if (needsDynamicLoading) {
      log(`[PuppeteerScraper] Dynamic loading needed - minimal content: ${hasMinimalContent} (${contentLength} chars), HTMX detected: ${htmxDetected}, preloader detected: ${preloaderDetected}`, "scraper");
      
      // Handle HTMX content loading ONLY if HTMX is actually detected
      let htmxLinks: string[] = [];
      if (options?.handleHTMX && htmxDetected) {
        log(`[PuppeteerScraper] HTMX detected on page, loading HTMX content`, "scraper");
        const htmxResult = await handleHTMXContent(page, url);
        if (htmxResult && typeof htmxResult === 'object' && htmxResult.links) {
          htmxLinks = htmxResult.links;
          log(`[PuppeteerScraper] HTMX extraction captured ${htmxLinks.length} links`, "scraper");
        }
      }
      
      // Handle preloader sites with intelligent waiting
      if (preloaderDetected) {
        log(`[PuppeteerScraper] Preloader detected, waiting for content to load...`, "scraper");
        await waitForPreloaderComplete(page);
      }
      
      // For sites with minimal content but no specific patterns, use scroll loading
      if (options?.scrollToLoad && (hasMinimalContent || preloaderDetected)) {
        await handleDynamicContent(page);
      }
      
      // Re-extract content after dynamic loading
      const dynamicHtml = await page.content();
      const dynamicContentLength = dynamicHtml.length;
      
      log(`[PuppeteerScraper] Dynamic content loading completed (${dynamicContentLength} chars)`, "scraper");
      
      // Validate dynamic content - use isArticlePage option to determine validation type
      const dynamicValidation = await validateContent(dynamicHtml, url, options?.isArticlePage || false);
      
      // For HTMX sites, always use the enriched DOM if we loaded HTMX content
      // Otherwise, check if dynamic content is significantly better
      const shouldUseDynamic = htmxDetected || 
                              (dynamicValidation.linkCount > validation.linkCount) ||
                              (dynamicContentLength > contentLength * 1.2 && dynamicValidation.linkCount >= validation.linkCount);
      
      if (shouldUseDynamic) {
        log(`[PuppeteerScraper] Using dynamic content (${dynamicValidation.linkCount} links, ${dynamicValidation.confidence}% confidence, HTMX: ${htmxDetected})`, "scraper");
        
        // Update references to use dynamic content
        html = dynamicHtml;
        validation.linkCount = dynamicValidation.linkCount;
        validation.confidence = dynamicValidation.confidence;
        validation.isValid = dynamicValidation.isValid;
        validation.isErrorPage = dynamicValidation.isErrorPage;
        
        // Return with dynamic content - check link requirement only for source pages
        const isSuccess = dynamicValidation.isValid && !dynamicValidation.isErrorPage && 
                         (options?.isArticlePage || dynamicValidation.linkCount >= 10);
        
        if (statusCode === 401) {
          log(`[PuppeteerScraper] Paywall detected (${dynamicValidation.linkCount} links) - may need enhanced bypass`, "scraper");
        }
        
        return {
          html: dynamicHtml,
          success: isSuccess,
          method: 'puppeteer',
          responseTime: Date.now() - startTime,
          statusCode,
          finalUrl: page.url(),
          htmxLinks: htmxLinks.length > 0 ? htmxLinks : undefined
        };
      } else {
        log(`[PuppeteerScraper] Dynamic content did not provide improvement (original: ${validation.linkCount} links, dynamic: ${dynamicValidation.linkCount} links)`, "scraper");
      }
    } else {
      log(`[PuppeteerScraper] Substantial content already extracted (${contentLength} chars), skipping dynamic loading`, "scraper");
    }

    log(`[PuppeteerScraper] Content extraction completed successfully (${validation.linkCount} links, ${validation.confidence}% confidence)`, "scraper");

    // Mark as failed if content validation failed completely - check link requirement only for source pages
    const isSuccess = validation.isValid && !validation.isErrorPage && 
                     (options?.isArticlePage || validation.linkCount >= 10);
    
    if (statusCode === 401) {
      log(`[PuppeteerScraper] Paywall detected (${validation.linkCount} links) - source page access blocked`, "scraper");
    }

    return {
      html,
      success: isSuccess,
      method: 'puppeteer',
      responseTime: Date.now() - startTime,
      statusCode,
      finalUrl: page.url(),
      htmxLinks: htmxLinks.length > 0 ? htmxLinks : undefined
    };

  } catch (error: any) {
    // Filter validation errors in main scraping function
    if (isExternalValidationError(error)) {
      log(`[PuppeteerScraper] External validation warning in main function (continuing): ${error.message}`, "scraper");
      // Return partial success with validation notice
      return {
        html: '<html><body><div class="content">Scraping completed with external validation restrictions</div></body></html>',
        success: true,
        method: 'puppeteer',
        responseTime: Date.now() - startTime,
        statusCode: 200,
        finalUrl: url
      };
    }
    
    // Check for browser disconnection errors
    const isBrowserError = error.message?.includes('Navigating frame was detached') ||
                          error.message?.includes('Protocol error') ||
                          error.message?.includes('Connection closed') ||
                          error.message?.includes('Target closed') ||
                          error.message?.includes('Browser disconnected');
    
    if (isBrowserError) {
      log(`[PuppeteerScraper] Browser disconnection detected: ${error.message}`, "scraper-error");
      
      // Import BrowserManager for restart
      const { BrowserManager } = await import('../../core/browser-manager');
      
      try {
        log(`[PuppeteerScraper] Attempting to restart browser for recovery`, "scraper");
        await BrowserManager.restartBrowser();
        log(`[PuppeteerScraper] Browser restarted successfully`, "scraper");
      } catch (restartError: any) {
        log(`[PuppeteerScraper] Failed to restart browser: ${restartError.message}`, "scraper-error");
      }
    }
    
    log(`[PuppeteerScraper] Error during Puppeteer scraping: ${error.message}`, "scraper-error");
    
    return {
      html: '',
      success: false,
      method: 'puppeteer',
      responseTime: Date.now() - startTime,
      statusCode: 0,
      finalUrl: url
    };
  } finally {
    if (page) {
      try {
        await page.close();
        log("[PuppeteerScraper] Page closed successfully", "scraper");
      } catch (closeError: any) {
        log(`[PuppeteerScraper] Error closing page: ${closeError.message}`, "scraper-error");
      }
    }
  }
}

/**
 * Scrape with enhanced stealth mode
 * For heavily protected sites requiring maximum evasion
 */
export async function scrapeWithStealthPuppeteer(url: string, options?: PuppeteerScrapingOptions): Promise<ScrapingResult> {
  const stealthOptions: PuppeteerScrapingOptions = {
    ...options,
    protectionBypass: true,
    handleHTMX: true,
    scrollToLoad: true,
    waitForContent: true
  };

  log(`[PuppeteerScraper] Using enhanced stealth mode for: ${url}`, "scraper");
  return await scrapeWithPuppeteer(url, stealthOptions);
}