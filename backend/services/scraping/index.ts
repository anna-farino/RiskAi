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
   * Streamlined source scraping - simplified 3-step workflow
   * Step 1: HTTP attempt, Step 2: Puppeteer fallback if needed, Step 3: OpenAI link extraction
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]> {
    try {
      log(`[UnifiedScraper] Starting source scraping: ${url}`, "scraper");

      // Step 1: HTTP attempt first
      log(`[UnifiedScraper] Attempting HTTP scrape`, "scraper");
      let html = '';
      let scrapingResult;
      
      try {
        scrapingResult = await hybridScrape(url, {
          isSourceUrl: true,
          isArticlePage: false,
          forceMethod: 'http',
          timeout: 30000
        });
        
        if (scrapingResult.success) {
          html = scrapingResult.html;
          log(`[UnifiedScraper] HTTP scrape successful (${html.length} chars)`, "scraper");
        }
      } catch (error) {
        log(`[UnifiedScraper] HTTP scrape failed: ${error}`, "scraper");
      }

      // Step 2: Puppeteer fallback if HTTP failed or has bot protection
      if (!html || (scrapingResult?.protectionDetected?.hasProtection)) {
        log(`[UnifiedScraper] Using Puppeteer fallback`, "scraper");
        const puppeteerResult = await hybridScrape(url, {
          isSourceUrl: true,
          isArticlePage: false,
          forceMethod: 'puppeteer',
          appContext: options?.appType,
          timeout: 60000
        });
        
        if (!puppeteerResult.success) {
          throw new Error(`Both HTTP and Puppeteer failed for: ${url}`);
        }
        html = puppeteerResult.html;
        log(`[UnifiedScraper] Puppeteer fallback successful (${html.length} chars)`, "scraper");
      }

      // Step 3: OpenAI link extraction
      log(`[UnifiedScraper] Extracting article links`, "scraper");
      const extractionOptions: LinkExtractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        maxLinks: options?.maxLinks || 50,
        minimumTextLength: 20
      };

      const articleLinks = await extractArticleLinks(html, url, extractionOptions);
      
      log(`[UnifiedScraper] Extracted ${articleLinks.length} article links`, "scraper");
      return articleLinks;

    } catch (error: any) {
      log(`[UnifiedScraper] Error in source scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Streamlined article scraping - simplified 3-step workflow
   * Step 1: HTTP attempt, Step 2: Puppeteer fallback if needed, Step 3: Content extraction
   */
  async scrapeArticleUrl(url: string, config?: ScrapingConfig): Promise<ArticleContent> {
    try {
      log(`[UnifiedScraper] Starting article scraping: ${url}`, "scraper");

      // Step 1: HTTP attempt first
      log(`[UnifiedScraper] Attempting HTTP scrape`, "scraper");
      let html = '';
      let scrapingResult;
      
      try {
        scrapingResult = await hybridScrape(url, {
          isSourceUrl: false,
          isArticlePage: true,
          forceMethod: 'http',
          timeout: 30000
        });
        
        if (scrapingResult.success) {
          html = scrapingResult.html;
          log(`[UnifiedScraper] HTTP scrape successful (${html.length} chars)`, "scraper");
        }
      } catch (error) {
        log(`[UnifiedScraper] HTTP scrape failed: ${error}`, "scraper");
      }

      // Step 2: Puppeteer fallback if HTTP failed or has bot protection
      if (!html || (scrapingResult?.protectionDetected?.hasProtection)) {
        log(`[UnifiedScraper] Using Puppeteer fallback`, "scraper");
        const puppeteerResult = await hybridScrape(url, {
          isSourceUrl: false,
          isArticlePage: true,
          forceMethod: 'puppeteer',
          timeout: 60000
        });
        
        if (!puppeteerResult.success) {
          throw new Error(`Both HTTP and Puppeteer failed for: ${url}`);
        }
        html = puppeteerResult.html;
        log(`[UnifiedScraper] Puppeteer fallback successful (${html.length} chars)`, "scraper");
      }

      // Step 3: Content extraction with structure detection if needed
      log(`[UnifiedScraper] Extracting article content`, "scraper");
      let articleConfig = config;
      if (!articleConfig) {
        articleConfig = await this.detectArticleStructure(url, html);
      }

      const articleContent = await extractArticleContent(html, articleConfig, url);

      log(`[UnifiedScraper] Extracted article content (title=${articleContent.title.length} chars, content=${articleContent.content.length} chars)`, "scraper");
      return articleContent;

    } catch (error: any) {
      log(`[UnifiedScraper] Error in article scraping: ${error.message}`, "scraper-error"); 
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