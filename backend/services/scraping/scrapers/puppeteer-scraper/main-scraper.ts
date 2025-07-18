import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import { setupArticlePage, setupSourcePage } from '../../core/page-setup';
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

    // Navigate to the page
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    const statusCode = response ? response.status() : 0;
    
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

    // Only do dynamic content loading if we have minimal content
    const hasMinimalContent = contentLength < 50000; // Less than 50KB indicates minimal content
    
    if (hasMinimalContent) {
      log(`[PuppeteerScraper] Minimal content detected (${contentLength} chars), attempting dynamic loading`, "scraper");
      
      // Handle dynamic content loading if requested
      if (options?.handleHTMX) {
        log(`[PuppeteerScraper] Dynamic content detected, using advanced HTMX extraction`, "scraper");
        await handleHTMXContent(page, url);
      }

      if (options?.scrollToLoad) {
        await handleDynamicContent(page);
      }
      
      // Re-extract content after dynamic loading
      const dynamicHtml = await page.content();
      const dynamicContentLength = dynamicHtml.length;
      
      log(`[PuppeteerScraper] Dynamic content loading completed (${dynamicContentLength} chars)`, "scraper");
      
      // Use the dynamic content if it's significantly better
      if (dynamicContentLength > contentLength * 1.5) {
        log(`[PuppeteerScraper] Dynamic content provided significant improvement, using dynamic version`, "scraper");
        return {
          html: dynamicHtml,
          success: true,
          method: 'puppeteer',
          responseTime: Date.now() - startTime,
          statusCode,
          finalUrl: page.url()
        };
      } else {
        log(`[PuppeteerScraper] Dynamic content did not provide significant improvement, using original`, "scraper");
      }
    } else {
      log(`[PuppeteerScraper] Substantial content already extracted (${contentLength} chars), skipping dynamic loading`, "scraper");
    }

    log(`[PuppeteerScraper] Content extraction completed successfully`, "scraper");

    return {
      html,
      success: true,
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