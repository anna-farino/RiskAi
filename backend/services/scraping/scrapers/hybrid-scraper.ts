import { log } from "backend/utils/log";
import { scrapeWithHTTP, ScrapingResult } from './http-scraper';
import { scrapeWithPuppeteer, scrapeWithStealthPuppeteer } from './puppeteer-scraper';
import { detectBotProtection } from '../core/protection-bypass';

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
 * Streamlined method determination for 11-step workflow
 * Simplified logic eliminates redundant decision making
 */
async function determineScrapingMethod(url: string, options?: ScrapingOptions): Promise<'http' | 'puppeteer'> {
  try {
    // If method is forced (Steps 2,6: quick scrape or Steps 3,8: bot protection), use it
    if (options?.forceMethod) {
      log(`[HybridScraper] Using forced method for workflow step: ${options.forceMethod}`, "scraper");
      return options.forceMethod;
    }

    // Default to HTTP for initial quick scrape attempts (Steps 2,6)
    log(`[HybridScraper] Using HTTP for initial scrape attempt`, "scraper");
    return 'http';

  } catch (error: any) {
    log(`[HybridScraper] Error determining scraping method: ${error.message}`, "scraper-error");
    return 'http';
  }
}
      

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
    log(`[HybridScraper] Starting streamlined scraping for: ${url}`, "scraper");
    log(`[HybridScraper] Method: ${options.forceMethod || 'auto'}, Source: ${options.isSourceUrl}, Article: ${options.isArticlePage}`, "scraper");

    // Validate URL
    if (!url || !url.startsWith('http')) {
      throw new Error(`Invalid URL provided: ${url}`);
    }

    const normalizedUrl = url.trim();

    // Streamlined scraping - no complex fallback logic, just execute the requested method
    const result = await executeScrapingMethod(normalizedUrl, options);

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
 * Extract domain from URL for cache lookups
 */
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Check if we have cached selectors for this domain
 */
function checkSelectorCache(domain: string): boolean {
  try {
    const { hasCachedSelectorsForDomain } = require('../ai/hybrid-extractor');
    return hasCachedSelectorsForDomain(`https://${domain}/test`);
  } catch (error) {
    log(`[HybridScraper] Error checking selector cache: ${error}`, "scraper");
    return false;
  }
}

/**
 * Streamlined method execution for 11-step workflow
 * No complex fallback logic - just execute the requested method cleanly
 */
async function executeScrapingMethod(url: string, options: ScrapingOptions): Promise<ScrapingResult> {
  const method = await determineScrapingMethod(url, options);
  
  if (method === 'http') {
    log(`[HybridScraper] Executing HTTP scraping`, "scraper");
    return await scrapeWithHTTP(url, {
      timeout: options.timeout || 30000,
      customHeaders: options.customHeaders
    });
  } else {
    log(`[HybridScraper] Executing Puppeteer scraping`, "scraper");
    return await scrapeWithPuppeteer(url, {
      isArticlePage: options.isArticlePage,
      handleHTMX: options.isSourceUrl, // Only handle HTMX for source pages
      scrollToLoad: options.isSourceUrl, // Only scroll for source pages
      protectionBypass: true,
      customHeaders: options.customHeaders,
      timeout: options.timeout || 60000
    });
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