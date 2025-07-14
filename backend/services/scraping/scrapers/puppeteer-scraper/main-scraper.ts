import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import { setupArticlePage, setupSourcePage } from '../../core/page-setup';
import { bypassProtection, ProtectionInfo } from '../../core/protection-bypass';
import { ScrapingResult } from '../http-scraper';
import { isExternalValidationError } from './error-handler';
import { handleHTMXContent } from './htmx-handler';
import { handleDynamicContent } from './dynamic-handler';
// Content extraction now handled inline

export interface PuppeteerScrapingOptions {
  isArticlePage?: boolean;
  waitForContent?: boolean;
  scrollToLoad?: boolean;
  handleHTMX?: boolean;
  scrapingConfig?: any;
  protectionBypass?: boolean;
  customHeaders?: Record<string, string>;
  timeout?: number;
}

/**
 * Main Puppeteer scraping function
 * Consolidates Puppeteer scraping logic from all three apps
 */
export async function scrapeWithPuppeteer(url: string, options?: PuppeteerScrapingOptions): Promise<ScrapingResult> {
  const startTime = Date.now();
  let page: Page | null = null;

  try {
    log(`[PuppeteerScraper] Starting Puppeteer scraping for: ${url}`, "scraper");

    // Set up page based on context
    if (options?.isArticlePage) {
      page = await setupArticlePage({
        headers: options.customHeaders,
        timeouts: { navigation: options.timeout || 60000, default: options.timeout || 60000 }
      });
    } else {
      page = await setupSourcePage({
        headers: options.customHeaders,
        timeouts: { navigation: options.timeout || 45000, default: options.timeout || 45000 }
      });
    }

    log(`[PuppeteerScraper] Page setup completed, navigating to URL`, "scraper");

    // Navigate to the page
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    const statusCode = response ? response.status() : 0;
    
    log(`[PuppeteerScraper] Navigation completed. Status: ${statusCode}`, "scraper");

    if (response && !response.ok()) {
      log(`[PuppeteerScraper] Warning: Response status is not OK: ${statusCode}`, "scraper");
    }

    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for bot protection and handle if needed
    if (options?.protectionBypass !== false) {
      const botProtectionCheck = await page.evaluate(() => {
        return (
          document.body.innerHTML.includes('_Incapsula_Resource') ||
          document.body.innerHTML.includes('Incapsula') ||
          document.body.innerHTML.includes('captcha') ||
          document.body.innerHTML.includes('Captcha') ||
          document.body.innerHTML.includes('cloudflare') ||
          document.body.innerHTML.includes('CloudFlare') ||
          document.body.innerHTML.includes('datadome')
        );
      });

      if (botProtectionCheck) {
        log(`[PuppeteerScraper] Bot protection detected, attempting bypass`, "scraper");
        
        const protectionInfo: ProtectionInfo = {
          hasProtection: true,
          type: 'generic',
          confidence: 0.8,
          details: 'Bot protection detected in page content'
        };

        const bypassSuccess = await bypassProtection(page, protectionInfo);
        if (!bypassSuccess) {
          log(`[PuppeteerScraper] Protection bypass failed`, "scraper");
        } else {
          log(`[PuppeteerScraper] Protection bypass successful`, "scraper");
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // Handle dynamic content loading if requested
    if (options?.handleHTMX) {
      await handleHTMXContent(page, url);
    }

    if (options?.scrollToLoad) {
      await handleDynamicContent(page);
    }

    // Extract content based on page type
    const html = await page.content();

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