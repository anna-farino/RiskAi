import { log } from "backend/utils/log";
import { scrapeWithHTTP, ScrapingResult } from './http-scraper';
import { scrapeWithPuppeteer, scrapeWithStealthPuppeteer } from './puppeteer-scraper';
import { detectProtection } from '../core/protection-bypass';

export interface ScrapingOptions {
  isSourceUrl: boolean;
  isArticlePage: boolean;
  forceMethod?: 'http' | 'puppeteer';
  scrapingConfig?: any;
  retryAttempts?: number;
  appContext?: 'news-radar' | 'threat-tracker' | 'news-capsule';
  customHeaders?: Record<string, string>;
  timeout?: number;
}

/**
 * Determine optimal scraping method based on URL and context
 * Makes intelligent decisions about HTTP vs Puppeteer usage
 */
export async function determineScrapingMethod(url: string, options?: ScrapingOptions): Promise<'http' | 'puppeteer'> {
  try {
    // Force method if specified
    if (options?.forceMethod) {
      log(`[HybridScraper] Using forced method: ${options.forceMethod}`, "scraper");
      return options.forceMethod;
    }

    // Threat Tracker context prefers Puppeteer for stealth
    if (options?.appContext === 'threat-tracker') {
      log(`[HybridScraper] Threat Tracker context: preferring Puppeteer for stealth`, "scraper");
      return 'puppeteer';
    }

    // Known problematic domains that require Puppeteer
    const puppeteerDomains = [
      'marketwatch.com',
      'bleepingcomputer.com',
      'threatpost.com',
      'darkreading.com',
      'krebsonsecurity.com'
    ];

    const domain = new URL(url).hostname.toLowerCase();
    if (puppeteerDomains.some(puppeteerDomain => domain.includes(puppeteerDomain))) {
      log(`[HybridScraper] Known protected domain detected: ${domain}, using Puppeteer`, "scraper");
      return 'puppeteer';
    }

    // For News Capsule, try HTTP first since it's single URL processing
    if (options?.appContext === 'news-capsule') {
      log(`[HybridScraper] News Capsule context: trying HTTP first`, "scraper");
      return 'http';
    }

    // Default to HTTP first for News Radar efficiency
    log(`[HybridScraper] Using default HTTP-first strategy`, "scraper");
    return 'http';

  } catch (error: any) {
    log(`[HybridScraper] Error determining scraping method: ${error.message}`, "scraper-error");
    return 'http'; // Default fallback
  }
}

/**
 * Perform HTTP scraping with intelligent Puppeteer fallback
 * Core hybrid scraping logic
 */
async function scrapeWithFallback(url: string, options: ScrapingOptions): Promise<ScrapingResult> {
  const maxRetries = options.retryAttempts || 3;
  let lastResult: ScrapingResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`[HybridScraper] Attempt ${attempt}/${maxRetries}`, "scraper");

      // Determine method for this attempt
      let method = await determineScrapingMethod(url, options);
      
      // If previous attempt failed with HTTP, switch to Puppeteer
      if (attempt > 1 && lastResult && !lastResult.success && lastResult.method === 'http') {
        log(`[HybridScraper] Previous HTTP attempt failed, switching to Puppeteer`, "scraper");
        method = 'puppeteer';
      }

      let result: ScrapingResult;

      if (method === 'http') {
        log(`[HybridScraper] Attempting HTTP scraping`, "scraper");
        result = await scrapeWithHTTP(url, {
          maxRetries: 2, // Reduce HTTP retries since we have Puppeteer fallback
          timeout: options.timeout || 30000,
          customHeaders: options.customHeaders
        });

        // Check if HTTP failed due to protection or dynamic content
        if (!result.success) {
          if (result.protectionDetected?.detected) {
            log(`[HybridScraper] HTTP failed due to protection: ${result.protectionDetected.type}`, "scraper");
          } else {
            log(`[HybridScraper] HTTP failed: switching to Puppeteer`, "scraper");
          }

          // Immediately try Puppeteer for this attempt
          log(`[HybridScraper] Falling back to Puppeteer for attempt ${attempt}`, "scraper");
          result = await scrapeWithPuppeteer(url, {
            isArticlePage: options.isArticlePage,
            handleHTMX: true,
            scrollToLoad: !options.isArticlePage, // Only scroll for source pages
            protectionBypass: true,
            scrapingConfig: options.scrapingConfig,
            customHeaders: options.customHeaders,
            timeout: options.timeout || 60000
          });
        }
      } else {
        log(`[HybridScraper] Using Puppeteer method`, "scraper");
        
        // Use stealth Puppeteer for threat tracker or known protected sites
        if (options.appContext === 'threat-tracker' || 
            (lastResult && lastResult.protectionDetected?.confidence && lastResult.protectionDetected.confidence > 0.8)) {
          log(`[HybridScraper] Using enhanced stealth Puppeteer`, "scraper");
          result = await scrapeWithStealthPuppeteer(url, {
            isArticlePage: options.isArticlePage,
            scrapingConfig: options.scrapingConfig,
            customHeaders: options.customHeaders,
            timeout: options.timeout || 60000
          });
        } else {
          result = await scrapeWithPuppeteer(url, {
            isArticlePage: options.isArticlePage,
            handleHTMX: true,
            scrollToLoad: !options.isArticlePage,
            protectionBypass: true,
            scrapingConfig: options.scrapingConfig,
            customHeaders: options.customHeaders,
            timeout: options.timeout || 60000
          });
        }
      }

      // Check if this attempt was successful
      if (result.success) {
        log(`[HybridScraper] Scraping successful with ${result.method} on attempt ${attempt}`, "scraper");
        return result;
      }

      lastResult = result;
      log(`[HybridScraper] Attempt ${attempt} failed with ${result.method}`, "scraper");

      // Add delay before retry (except for last attempt)
      if (attempt < maxRetries) {
        const retryDelay = Math.min(1000 * attempt, 5000);
        log(`[HybridScraper] Waiting ${retryDelay}ms before retry`, "scraper");
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

    } catch (error: any) {
      log(`[HybridScraper] Attempt ${attempt} threw error: ${error.message}`, "scraper-error");
      
      if (attempt === maxRetries) {
        return {
          html: '',
          success: false,
          method: 'http',
          responseTime: 0,
          statusCode: 0,
          finalUrl: url
        };
      }
    }
  }

  // All attempts failed
  log(`[HybridScraper] All ${maxRetries} attempts failed`, "scraper-error");
  return lastResult || {
    html: '',
    success: false,
    method: 'http',
    responseTime: 0,
    statusCode: 0,
    finalUrl: url
  };
}

/**
 * Main unified scraping function
 * Entry point for all scraping operations across all apps
 */
export async function scrapeUrl(url: string, options: ScrapingOptions): Promise<ScrapingResult> {
  const startTime = Date.now();
  
  try {
    log(`[HybridScraper] Starting unified scraping for: ${url}`, "scraper");
    log(`[HybridScraper] Options: isSourceUrl=${options.isSourceUrl}, isArticlePage=${options.isArticlePage}, appContext=${options.appContext}`, "scraper");

    // Validate URL
    if (!url || !url.startsWith('http')) {
      throw new Error(`Invalid URL provided: ${url}`);
    }

    // Normalize URL
    const normalizedUrl = url.trim();

    // Prepare scraping options
    const scrapingOptions: ScrapingOptions = {
      ...options,
      retryAttempts: options.retryAttempts || 3
    };

    // Perform scraping with fallback
    const result = await scrapeWithFallback(normalizedUrl, scrapingOptions);

    // Log final result
    const totalTime = Date.now() - startTime;
    log(`[HybridScraper] Scraping completed in ${totalTime}ms using ${result.method}`, "scraper");
    log(`[HybridScraper] Success: ${result.success}, Content length: ${result.html.length}`, "scraper");

    return {
      ...result,
      responseTime: totalTime
    };

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    log(`[HybridScraper] Fatal error during scraping: ${error.message}`, "scraper-error");
    
    return {
      html: '',
      success: false,
      method: 'http',
      responseTime: totalTime,
      statusCode: 0,
      finalUrl: url
    };
  }
}

/**
 * Quick scraping for simple content (optimized for speed)
 * Primarily uses HTTP with minimal fallback
 */
export async function quickScrape(url: string, options?: Partial<ScrapingOptions>): Promise<ScrapingResult> {
  log(`[HybridScraper] Performing quick scrape for: ${url}`, "scraper");
  
  const quickOptions: ScrapingOptions = {
    isSourceUrl: false,
    isArticlePage: true,
    retryAttempts: 1,
    forceMethod: 'http',
    ...options
  };

  return await scrapeUrl(url, quickOptions);
}

/**
 * Robust scraping for protected content (optimized for success rate)
 * Uses Puppeteer with full protection bypass
 */
export async function robustScrape(url: string, options?: Partial<ScrapingOptions>): Promise<ScrapingResult> {
  log(`[HybridScraper] Performing robust scrape for: ${url}`, "scraper");
  
  const robustOptions: ScrapingOptions = {
    isSourceUrl: false,
    isArticlePage: true,
    retryAttempts: 3,
    forceMethod: 'puppeteer',
    appContext: 'threat-tracker', // Use threat tracker context for maximum stealth
    ...options
  };

  return await scrapeUrl(url, robustOptions);
}

/**
 * Smart scraping that adapts based on previous results
 * Learns from failures and adjusts strategy
 */
export async function adaptiveScrape(url: string, options: ScrapingOptions, previousFailures?: string[]): Promise<ScrapingResult> {
  log(`[HybridScraper] Performing adaptive scrape for: ${url}`, "scraper");
  
  const domain = new URL(url).hostname;
  
  // If this domain has failed before, use more aggressive approach
  if (previousFailures && previousFailures.includes(domain)) {
    log(`[HybridScraper] Domain ${domain} has previous failures, using robust approach`, "scraper");
    return await robustScrape(url, options);
  }

  // Otherwise, use standard hybrid approach
  return await scrapeUrl(url, options);
}