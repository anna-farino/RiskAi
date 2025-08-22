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

    // Navigate to the page with safer settings
    let response;
    let statusCode = 0;
    
    try {
      // Use a shorter timeout and less strict wait condition for problematic sites
      const isProblematicSite = url.includes('nytimes.com') || 
                                url.includes('wsj.com') || 
                                url.includes('bloomberg.com');
      
      const waitCondition = isProblematicSite ? 'domcontentloaded' : 'networkidle2';
      const navTimeout = isProblematicSite ? 15000 : 30000;
      
      log(`[PuppeteerScraper] Navigating with ${waitCondition} (timeout: ${navTimeout}ms)`, "scraper");
      
      response = await page.goto(url, { 
        waitUntil: waitCondition as any,
        timeout: navTimeout 
      });
      statusCode = response ? response.status() : 0;
      
      // For problematic sites, wait a bit for content to load
      if (isProblematicSite && response) {
        log(`[PuppeteerScraper] Problematic site detected, waiting for content...`, "scraper");
        await new Promise(resolve => setTimeout(resolve, 2000));
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

    if (response && !response.ok()) {
      log(`[PuppeteerScraper] Warning: Response status is not OK: ${statusCode}`, "scraper");
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
        // Check for other bot protection
        const botProtectionCheck = await page.evaluate(() => {
          return (
            document.body.innerHTML.includes('_Incapsula_Resource') ||
            document.body.innerHTML.includes('Incapsula') ||
            document.body.innerHTML.includes('captcha') ||
            document.body.innerHTML.includes('Captcha') ||
            document.body.innerHTML.includes('cloudflare') ||
            document.body.innerHTML.includes('CloudFlare')
          );
        });

        if (botProtectionCheck) {
          log(`[PuppeteerScraper] Generic bot protection detected, attempting bypass`, "scraper");
          
          const protectionInfo: ProtectionInfo = {
            hasProtection: true,
            type: 'generic',
            confidence: 0.8,
            details: 'Generic bot protection detected'
          };

          const bypassSuccess = await bypassProtection(page, protectionInfo);
          if (!bypassSuccess) {
            log(`[PuppeteerScraper] Generic protection bypass failed`, "scraper");
          } else {
            log(`[PuppeteerScraper] Generic protection bypass successful`, "scraper");
            await performBehavioralDelay(options);
          }
        }
      }
    }

    // Extract content first to check if we already have good content
    const html = await page.content();
    const contentLength = html.length;
    
    log(`[PuppeteerScraper] Initial content extracted (${contentLength} chars)`, "scraper");
    
    // Validate content quality
    const validation = await validateContent(html, url);
    
    if (!validation.isValid || validation.isErrorPage) {
      log(`[PuppeteerScraper] Content validation warning: ${validation.errorIndicators.join(', ')}, confidence: ${validation.confidence}%`, "scraper");
    }
    
    if (validation.linkCount < 10) {
      log(`[PuppeteerScraper] Warning: Only ${validation.linkCount} links found (minimum 10 recommended)`, "scraper");
    }

    // Detect HTMX presence on the page
    const htmxDetected = await page.evaluate(() => {
      return !!(window as any).htmx || 
             !!document.querySelector('[hx-get], [hx-post], [hx-trigger], script[src*="htmx"]') ||
             !!document.querySelector('[data-hx-get], [data-hx-post], [data-hx-trigger]');
    });
    
    // Do dynamic content loading if we have minimal content OR HTMX is detected
    const hasMinimalContent = contentLength < 50000; // Less than 50KB indicates minimal content
    const needsDynamicLoading = hasMinimalContent || htmxDetected;
    
    if (needsDynamicLoading) {
      log(`[PuppeteerScraper] Dynamic loading needed - minimal content: ${hasMinimalContent} (${contentLength} chars), HTMX detected: ${htmxDetected}`, "scraper");
      
      // Handle HTMX content loading if requested AND HTMX is detected
      if (options?.handleHTMX && htmxDetected) {
        log(`[PuppeteerScraper] HTMX detected on page, loading HTMX content`, "scraper");
        await handleHTMXContent(page, url);
      } else if (options?.handleHTMX && hasMinimalContent) {
        // Still try HTMX handler for minimal content pages even without explicit HTMX detection
        log(`[PuppeteerScraper] Minimal content detected, attempting HTMX extraction`, "scraper");
        await handleHTMXContent(page, url);
      }

      if (options?.scrollToLoad) {
        await handleDynamicContent(page);
      }
      
      // Re-extract content after dynamic loading
      const dynamicHtml = await page.content();
      const dynamicContentLength = dynamicHtml.length;
      
      log(`[PuppeteerScraper] Dynamic content loading completed (${dynamicContentLength} chars)`, "scraper");
      
      // Validate dynamic content
      const dynamicValidation = await validateContent(dynamicHtml, url);
      
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
        
        // Return with dynamic content
        const isSuccess = dynamicValidation.isValid && !dynamicValidation.isErrorPage && 
                         (dynamicValidation.linkCount >= 10 || (htmxDetected && dynamicValidation.linkCount >= 5));
        
        return {
          html: dynamicHtml,
          success: isSuccess,
          method: 'puppeteer',
          responseTime: Date.now() - startTime,
          statusCode,
          finalUrl: page.url()
        };
      } else {
        log(`[PuppeteerScraper] Dynamic content did not provide improvement (original: ${validation.linkCount} links, dynamic: ${dynamicValidation.linkCount} links)`, "scraper");
      }
    } else {
      log(`[PuppeteerScraper] Substantial content already extracted (${contentLength} chars), skipping dynamic loading`, "scraper");
    }

    log(`[PuppeteerScraper] Content extraction completed successfully (${validation.linkCount} links, ${validation.confidence}% confidence)`, "scraper");

    // Mark as failed if content validation failed completely
    const isSuccess = validation.isValid && !validation.isErrorPage && validation.linkCount >= 10;

    return {
      html,
      success: isSuccess,
      method: 'puppeteer',
      responseTime: Date.now() - startTime,
      statusCode,
      finalUrl: page.url()
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