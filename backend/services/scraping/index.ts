import { log } from "backend/utils/log";
import { scrapeUrl as hybridScrape, ScrapingOptions } from './scrapers/hybrid-scraper';
import { extractArticleLinks, LinkExtractionOptions } from './extractors/link-extractor';
import { extractArticleContent, extractWithFallbacks, ArticleContent } from './extractors/content-extractor';
import { detectHtmlStructureWithFallbacks, ScrapingConfig } from './extractors/structure-detector';
import { BrowserManager } from './core/browser-manager';

export interface SourceScrapingOptions {
  aiContext?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxLinks?: number;
  appType?: 'news-radar' | 'threat-tracker' | 'news-capsule';
}

export interface BatchOptions {
  concurrency?: number;
  retryFailures?: boolean;
  stopOnError?: boolean;
  progressCallback?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  processed: number;
  total: number;
  successful: number;
  failed: number;
  currentUrl?: string;
}

/**
 * Unified Scraping Service
 * Main entry point providing simplified interface for all apps
 * Replaces duplicate scraping implementations across News Radar, Threat Tracker, and News Capsule
 */
export class UnifiedScrapingService {
  
  /**
   * Streamlined source scraping following 11-step workflow
   * Steps 1-4: Load source, quick DOM scrape, bot protection if needed, OpenAI link extraction
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]> {
    try {
      log(`[UnifiedScraper] Starting streamlined source scraping: ${url}`, "scraper");

      // Step 1: Load source page
      log(`[UnifiedScraper] Step 1: Loading source page`, "scraper");
      
      // Step 2: Try quick DOM scrape first
      log(`[UnifiedScraper] Step 2: Attempting quick DOM scrape`, "scraper");
      let html = '';
      let needsBotProtectionBypass = false;
      
      try {
        const quickResult = await hybridScrape(url, {
          isSourceUrl: true,
          isArticlePage: false,
          forceMethod: 'http',
          timeout: 30000
        });
        
        if (quickResult.success) {
          html = quickResult.html;
          log(`[UnifiedScraper] Step 2: Quick DOM scrape successful (${html.length} chars)`, "scraper");
        } else {
          needsBotProtectionBypass = true;
        }
      } catch (error) {
        needsBotProtectionBypass = true;
        log(`[UnifiedScraper] Step 2: Quick scrape failed, will need bot protection bypass`, "scraper");
      }

      // Step 3: Bot protection bypass if needed
      if (needsBotProtectionBypass) {
        log(`[UnifiedScraper] Step 3: Bot protection detected, bypassing with Puppeteer`, "scraper");
        const protectedResult = await hybridScrape(url, {
          isSourceUrl: true,
          isArticlePage: false,
          forceMethod: 'puppeteer',
          appContext: options?.appType,
          timeout: 60000
        });
        
        if (!protectedResult.success) {
          throw new Error(`Failed to bypass bot protection for: ${url}`);
        }
        html = protectedResult.html;
        log(`[UnifiedScraper] Step 3: Bot protection bypassed successfully (${html.length} chars)`, "scraper");
      }

      // Step 4: Send HTML to OpenAI for link extraction
      log(`[UnifiedScraper] Step 4: Sending HTML to OpenAI for link extraction`, "scraper");
      const extractionOptions: LinkExtractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        maxLinks: options?.maxLinks || 50,
        minimumTextLength: 20
      };

      const articleLinks = await extractArticleLinks(html, url, extractionOptions);
      
      log(`[UnifiedScraper] Steps 1-4 complete: Extracted ${articleLinks.length} article links`, "scraper");
      return articleLinks;

    } catch (error: any) {
      log(`[UnifiedScraper] Error in streamlined source scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Streamlined article scraping following 11-step workflow  
   * Steps 5-11: Follow article link, quick scrape, HTML selector detection, element extraction
   */
  async scrapeArticleUrl(url: string, config?: ScrapingConfig): Promise<ArticleContent> {
    try {
      log(`[UnifiedScraper] Starting streamlined article scraping: ${url}`, "scraper");

      // Step 5: Follow first link to article page (already done by caller)
      log(`[UnifiedScraper] Step 5: Following article link: ${url}`, "scraper");

      // Step 6: Try quick scrape of DOM
      log(`[UnifiedScraper] Step 6: Attempting quick DOM scrape of article`, "scraper");
      let html = '';
      let scrapingSuccessful = false;
      
      try {
        const quickResult = await hybridScrape(url, {
          isSourceUrl: false,
          isArticlePage: true,
          forceMethod: 'http',
          timeout: 30000
        });
        
        if (quickResult.success) {
          html = quickResult.html;
          scrapingSuccessful = true;
          log(`[UnifiedScraper] Step 6: Quick DOM scrape successful (${html.length} chars)`, "scraper");
        }
      } catch (error) {
        log(`[UnifiedScraper] Step 6: Quick scrape failed`, "scraper");
      }

      // Step 7 & 8: HTML selector detection (with or without bot protection bypass)
      let articleConfig = config;
      
      if (scrapingSuccessful) {
        // Step 7: Successful scrape - send HTML to OpenAI for selector detection
        log(`[UnifiedScraper] Step 7: Sending HTML to OpenAI for selector detection`, "scraper");
        if (!articleConfig) {
          articleConfig = await this.detectArticleStructure(url, html);
        }
      } else {
        // Step 8: Unsuccessful scrape - bypass bot protection then do selector detection
        log(`[UnifiedScraper] Step 8: Bypassing bot protection for article scraping`, "scraper");
        const protectedResult = await hybridScrape(url, {
          isSourceUrl: false,
          isArticlePage: true,
          forceMethod: 'puppeteer',
          timeout: 60000
        });
        
        if (!protectedResult.success) {
          throw new Error(`Failed to scrape article after bot protection bypass: ${url}`);
        }
        
        html = protectedResult.html;
        log(`[UnifiedScraper] Step 8: Bot protection bypassed, sending HTML to OpenAI for selector detection`, "scraper");
        
        if (!articleConfig) {
          articleConfig = await this.detectArticleStructure(url, html);
        }
      }

      // Steps 9-11: Extract body copy, title, publish date, author elements and content
      log(`[UnifiedScraper] Steps 9-11: Extracting structured content using detected selectors`, "scraper");
      const articleContent = await extractArticleContent(html, articleConfig, url);

      log(`[UnifiedScraper] Steps 5-11 complete: Extracted article content (title=${articleContent.title.length} chars, content=${articleContent.content.length} chars)`, "scraper");
      return articleContent;

    } catch (error: any) {
      log(`[UnifiedScraper] Error in streamlined article scraping: ${error.message}`, "scraper-error"); 
      throw error;
    }
  }

  /**
   * Detect HTML structure for content extraction
   * Automatically determines selectors for title, content, author, and date
   */
  async detectArticleStructure(url: string, html?: string, context?: string): Promise<ScrapingConfig> {
    try {
      log(`[UnifiedScraper] Detecting HTML structure for: ${url}`, "scraper");

      let pageHtml = html;
      
      // If HTML not provided, scrape it
      if (!pageHtml) {
        const result = await hybridScrape(url, {
          isSourceUrl: false,
          isArticlePage: true,
          retryAttempts: 2
        });
        
        if (!result.success) {
          throw new Error(`Failed to scrape URL for structure detection: ${result.statusCode || 'Unknown error'}`);
        }
        
        pageHtml = result.html;
      }

      // Use enhanced structure detection with fallbacks
      const structure = await detectHtmlStructureWithFallbacks(pageHtml, url, context);
      
      log(`[UnifiedScraper] Structure detection completed with confidence: ${structure.confidence}`, "scraper");
      return structure;

    } catch (error: any) {
      log(`[UnifiedScraper] Error detecting HTML structure: ${error.message}`, "scraper-error");
      throw new Error(`Failed to detect HTML structure: ${error.message}`);
    }
  }

  /**
   * Batch process multiple articles with concurrency control
   * Efficient processing for large article sets
   */
  async scrapeMultipleArticles(
    urls: string[], 
    config: ScrapingConfig, 
    options?: BatchOptions
  ): Promise<ArticleContent[]> {
    try {
      const concurrency = options?.concurrency || 3;
      const stopOnError = options?.stopOnError || false;
      const retryFailures = options?.retryFailures || true;
      
      log(`[UnifiedScraper] Starting batch processing of ${urls.length} articles with concurrency ${concurrency}`, "scraper");

      const results: ArticleContent[] = [];
      const errors: string[] = [];
      let processed = 0;

      // Process URLs in batches
      for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (url, index) => {
          try {
            // Update progress callback
            if (options?.progressCallback) {
              options.progressCallback({
                processed: processed + index,
                total: urls.length,
                successful: results.length,
                failed: errors.length,
                currentUrl: url
              });
            }

            return await this.scrapeArticleUrl(url, config);
          } catch (error: any) {
            const errorMsg = `Failed to process ${url}: ${error.message}`;
            errors.push(errorMsg);
            log(`[UnifiedScraper] Batch error: ${errorMsg}`, "scraper-error");
            
            if (stopOnError) {
              throw error;
            }
            
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Add successful results
        batchResults.forEach(result => {
          if (result) {
            results.push(result);
          }
        });

        processed += batch.length;
        
        log(`[UnifiedScraper] Batch completed: ${processed}/${urls.length} articles processed`, "scraper");
      }

      // Retry failed URLs if requested
      if (retryFailures && errors.length > 0 && errors.length < urls.length * 0.5) {
        log(`[UnifiedScraper] Retrying ${errors.length} failed URLs`, "scraper");
        
        // Extract URLs from error messages and retry
        const failedUrls = errors.map(error => {
          const match = error.match(/Failed to process (https?:\/\/[^\s:]+)/);
          return match ? match[1] : null;
        }).filter(Boolean) as string[];

        for (const url of failedUrls) {
          try {
            const retryResult = await this.scrapeArticleUrl(url, config);
            results.push(retryResult);
            log(`[UnifiedScraper] Retry successful for: ${url}`, "scraper");
          } catch (retryError) {
            log(`[UnifiedScraper] Retry failed for: ${url}`, "scraper-error");
          }
        }
      }

      // Final progress update
      if (options?.progressCallback) {
        options.progressCallback({
          processed: urls.length,
          total: urls.length,
          successful: results.length,
          failed: urls.length - results.length
        });
      }

      log(`[UnifiedScraper] Batch processing completed: ${results.length}/${urls.length} successful`, "scraper");
      return results;

    } catch (error: any) {
      log(`[UnifiedScraper] Error in batch processing: ${error.message}`, "scraper-error");
      throw new Error(`Batch processing failed: ${error.message}`);
    }
  }

  /**
   * Health check for the scraping service
   * Verifies all components are working correctly
   */
  async healthCheck(): Promise<boolean> {
    try {
      log(`[UnifiedScraper] Performing health check`, "scraper");

      // Check browser manager
      const browserHealthy = await BrowserManager.healthCheck();
      if (!browserHealthy) {
        log(`[UnifiedScraper] Browser manager health check failed`, "scraper-error");
        return false;
      }

      // Test simple HTTP scraping
      const testResult = await hybridScrape('https://example.com', {
        isSourceUrl: false,
        isArticlePage: true,
        retryAttempts: 1,
        forceMethod: 'http'
      });

      if (!testResult.success) {
        log(`[UnifiedScraper] HTTP scraping health check failed`, "scraper-error");
        return false;
      }

      log(`[UnifiedScraper] Health check passed`, "scraper");
      return true;

    } catch (error: any) {
      log(`[UnifiedScraper] Health check failed: ${error.message}`, "scraper-error");
      return false;
    }
  }

  /**
   * Clean up resources and close browser instances
   * Should be called when shutting down the service
   */
  async cleanup(): Promise<void> {
    try {
      log(`[UnifiedScraper] Cleaning up resources`, "scraper");
      await BrowserManager.closeBrowser();
      log(`[UnifiedScraper] Cleanup completed`, "scraper");
    } catch (error: any) {
      log(`[UnifiedScraper] Error during cleanup: ${error.message}`, "scraper-error");
    }
  }
}

// Export singleton instance
export const unifiedScraper = new UnifiedScrapingService();

// Export main functions for direct usage
export { scrapeUrl } from './scrapers/hybrid-scraper';
export { extractArticleLinks } from './extractors/link-extractor';
export { extractArticleContent, extractWithFallbacks } from './extractors/content-extractor';
export { detectHtmlStructureWithFallbacks as detectHtmlStructure } from './extractors/structure-detector';

// Export types
export type { ScrapingOptions } from './scrapers/hybrid-scraper';
export type { ScrapingResult } from './scrapers/http-scraper';
export type { ArticleContent } from './extractors/content-extractor';
export type { ScrapingConfig } from './extractors/structure-detector';
export type { ProtectionInfo } from './core/protection-bypass';

// Handle process termination
process.on('SIGINT', () => {
  unifiedScraper.cleanup().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  unifiedScraper.cleanup().then(() => process.exit(0));
});