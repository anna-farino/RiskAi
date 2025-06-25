// DEPRECATED: This file is replaced by unified-scraper-v2.ts
// The hybrid scraper layer has been eliminated in the streamlined refactoring
// All apps now use StreamlinedUnifiedScraper directly

import { log } from "backend/utils/log";
import { scrapeWithHTTP, ScrapingResult } from './http-scraper';
import { scrapeWithPuppeteer, scrapeWithStealthPuppeteer } from './puppeteer-scraper';
import { detectBotProtection } from '../core/protection-bypass';

export interface ScrapingOptions {
  isSourceUrl: boolean;
  isArticlePage: boolean;
  forceMethod?: 'http' | 'puppeteer';
  scrapingConfig?: any;
  timeout?: number;
  retryAttempts?: number;
  customHeaders?: Record<string, string>;
  appContext?: string;
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
 * Protected scraping with stealth capabilities
 * Uses Puppeteer with bot protection bypass
 */
export async function protectedScrape(url: string, options?: Partial<ScrapingOptions>): Promise<ScrapingResult> {
  log(`[HybridScraper] Performing protected scrape for: ${url}`, "scraper");
  
  const protectedOptions: ScrapingOptions = {
    isSourceUrl: false,
    isArticlePage: true,
    retryAttempts: 2,
    forceMethod: 'puppeteer',
    ...options
  };

  return await scrapeUrl(url, protectedOptions);
}

/**
 * Batch scraping for multiple URLs
 * Optimizes for throughput while maintaining reliability
 */
export async function batchScrape(urls: string[], options?: Partial<ScrapingOptions>): Promise<ScrapingResult[]> {
  log(`[HybridScraper] Starting batch scrape for ${urls.length} URLs`, "scraper");
  
  const results = await Promise.allSettled(
    urls.map(url => scrapeUrl(url, {
      isSourceUrl: false,
      isArticlePage: true,
      retryAttempts: 1,
      ...options
    }))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      log(`[HybridScraper] Batch scrape failed for URL ${index}: ${result.reason}`, "scraper-error");
      return {
        html: '',
        success: false,
        method: 'http',
        responseTime: 0,
        statusCode: 0,
        finalUrl: urls[index]
      };
    }
  });
}