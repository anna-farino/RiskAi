/**
 * Integration examples showing how to add error logging to existing scraping operations
 * These are examples only - not to be used directly in production code
 */

import {
  withErrorLogging,
  logSourceScrapingError,
  logArticleScrapingError,
  createNewsRadarContext,
  createThreatTrackerContext,
  type ScrapingContextInfo,
} from "./scraping-integration";
import type { ScrapingMethod } from "@shared/db/schema/scraping-error-logs";

/**
 * EXAMPLE 1: Wrapping existing scraping functions with error logging
 * 
 * This shows how to wrap the main scraper functions without modifying them
 */

// Example of wrapping scrapeSourceUrl with error logging
export async function scrapeSourceUrlWithLogging(
  originalScrapeSourceUrl: (url: string, options?: any, context?: any) => Promise<string[]>,
  url: string,
  context: ScrapingContextInfo,
  options?: any,
  scrapingContext?: any
): Promise<string[]> {
  const operation = {
    ...context,
    scrapingMethod: 'http' as ScrapingMethod, // Will be determined by actual implementation
    extractionStep: 'source-scraping' as const,
  };

  return await withErrorLogging(
    operation,
    () => originalScrapeSourceUrl(url, options, scrapingContext),
    (error) => {
      // Custom error type mapping for source scraping
      if (error.message.includes('puppeteer')) return 'puppeteer';
      if (error.message.includes('timeout')) return 'timeout';
      if (error.message.includes('network')) return 'network';
      return 'unknown';
    }
  );
}

// Example of wrapping scrapeArticleUrl with error logging
export async function scrapeArticleUrlWithLogging(
  originalScrapeArticleUrl: (url: string, config?: any, context?: any) => Promise<any>,
  url: string,
  context: ScrapingContextInfo,
  config?: any,
  scrapingContext?: any
): Promise<any> {
  const operation = {
    ...context,
    articleUrl: url,
    scrapingMethod: 'http' as ScrapingMethod, // Will be determined by actual implementation
    extractionStep: 'article-scraping' as const,
  };

  return await withErrorLogging(
    operation,
    () => originalScrapeArticleUrl(url, config, scrapingContext)
  );
}

/**
 * EXAMPLE 2: Manual error logging in existing functions
 * 
 * This shows how to add error logging inside existing functions
 */

// Example of adding error logging to a background job
export async function exampleBackgroundJobWithErrorLogging(
  userId: string,
  sourceId: string,
  sourceUrl: string,
  sourceName: string
): Promise<void> {
  const context = createNewsRadarContext(userId, sourceId, sourceUrl, sourceName);

  try {
    // Your existing background job logic here...
    
    // Example: Source scraping step
    try {
      // await scrapeSourceUrl(sourceUrl);
      console.log(`Would scrape source: ${sourceUrl}`);
    } catch (error) {
      if (error instanceof Error) {
        await logSourceScrapingError(error, context, 'http', {
          step: 'background-job-source-scraping',
          jobType: 'scheduled-scrape',
        });
      }
      throw error; // Re-throw to maintain existing behavior
    }

    // Example: Article scraping step
    const articleUrls = ['https://example.com/article1', 'https://example.com/article2'];
    for (const articleUrl of articleUrls) {
      try {
        // await scrapeArticleUrl(articleUrl);
        console.log(`Would scrape article: ${articleUrl}`);
      } catch (error) {
        if (error instanceof Error) {
          await logArticleScrapingError(error, context, articleUrl, 'http', 'article-scraping', {
            step: 'background-job-article-scraping',
            jobType: 'scheduled-scrape',
          });
        }
        // Continue with next article instead of failing entire job
        continue;
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      // Log general job failure
      await logSourceScrapingError(error, context, 'http', {
        step: 'background-job-failure',
        jobType: 'scheduled-scrape',
        errorLevel: 'critical',
      });
    }
    throw error;
  }
}

/**
 * EXAMPLE 3: Integration patterns for different apps
 */

// News Radar integration example
export class NewsRadarErrorLoggingExample {
  static async scrapeSourceWithLogging(
    userId: string,
    sourceId: string,
    sourceUrl: string,
    sourceName: string
  ): Promise<string[]> {
    const context = createNewsRadarContext(userId, sourceId, sourceUrl, sourceName);

    try {
      // Your existing scraping logic...
      const articleUrls: string[] = [];
      
      // Simulate some scraping work
      console.log(`News Radar: Would scrape ${sourceUrl}`);
      
      return articleUrls;
    } catch (error) {
      if (error instanceof Error) {
        await logSourceScrapingError(error, context, 'http', {
          app: 'news-radar',
          operation: 'manual-scrape',
        });
      }
      throw error;
    }
  }
}

// Threat Tracker integration example
export class ThreatTrackerErrorLoggingExample {
  static async processSourceWithLogging(
    userId: string,
    sourceId: string,
    sourceUrl: string,
    sourceName: string
  ): Promise<any[]> {
    const context = createThreatTrackerContext(userId, sourceId, sourceUrl, sourceName);

    try {
      // Your existing processing logic...
      const articles: any[] = [];
      
      // Simulate some processing work
      console.log(`Threat Tracker: Would process ${sourceUrl}`);
      
      return articles;
    } catch (error) {
      if (error instanceof Error) {
        await logSourceScrapingError(error, context, 'http', {
          app: 'threat-tracker',
          operation: 'background-processing',
        });
      }
      throw error;
    }
  }
}

/**
 * EXAMPLE 4: Try/catch patterns for different error types
 */

export async function exampleErrorHandlingPatterns(
  context: ScrapingContextInfo,
  articleUrl: string
): Promise<void> {
  // Pattern 1: Network errors
  try {
    // await fetch(articleUrl);
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      await logArticleScrapingError(error, context, articleUrl, 'http', 'article-scraping', {
        errorPattern: 'network-fetch-failure',
      });
    }
    throw error;
  }

  // Pattern 2: Puppeteer errors
  try {
    // await page.goto(articleUrl);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Navigation')) {
      await logArticleScrapingError(error, context, articleUrl, 'puppeteer', 'article-scraping', {
        errorPattern: 'puppeteer-navigation-failure',
      });
    }
    throw error;
  }

  // Pattern 3: Parsing errors
  try {
    // const $ = cheerio.load(html);
  } catch (error) {
    if (error instanceof Error) {
      await logArticleScrapingError(error, context, articleUrl, 'http', 'content-extraction', {
        errorPattern: 'html-parsing-failure',
      });
    }
    throw error;
  }

  // Pattern 4: AI/OpenAI errors
  try {
    // await openai.chat.completions.create(...);
  } catch (error) {
    if (error instanceof Error && error.message.includes('rate limit')) {
      await logArticleScrapingError(error, context, articleUrl, 'http', 'structure-detection', {
        errorPattern: 'openai-rate-limit',
        retryRecommended: true,
      });
    }
    throw error;
  }
}

/**
 * EXAMPLE 5: Batch operation error logging
 */

export async function exampleBatchOperationWithLogging(
  userId: string,
  sources: Array<{ id: string; url: string; name: string }>
): Promise<void> {
  for (const source of sources) {
    const context = createNewsRadarContext(userId, source.id, source.url, source.name);

    try {
      // Process individual source
      console.log(`Processing source: ${source.name}`);
      
      // If an error occurs, it will be logged but won't stop the batch
    } catch (error) {
      if (error instanceof Error) {
        await logSourceScrapingError(error, context, 'http', {
          batchOperation: true,
          batchSize: sources.length,
          sourceIndex: sources.indexOf(source),
        });
      }
      // Continue with next source in batch
      continue;
    }
  }
}

/**
 * EXAMPLE 6: Conditional error logging based on error severity
 */

export async function exampleConditionalErrorLogging(
  context: ScrapingContextInfo,
  error: Error,
  articleUrl: string
): Promise<void> {
  const message = error.message.toLowerCase();

  // Only log certain types of errors
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503')
  ) {
    // These are temporary/infrastructure errors worth logging
    await logArticleScrapingError(error, context, articleUrl, 'http', 'article-scraping', {
      severity: 'temporary',
      retryRecommended: true,
    });
  } else if (
    message.includes('404') ||
    message.includes('not found')
  ) {
    // These might be content issues, log with different severity
    await logArticleScrapingError(error, context, articleUrl, 'http', 'article-scraping', {
      severity: 'content-issue',
      retryRecommended: false,
    });
  }
  // Other errors might not need logging (e.g., expected validation errors)
}