import { log } from "backend/utils/log";
import { unifiedScraper as streamlinedScraper } from './unified-scraper-v2';
import { ScrapingConfig, ArticleContent, SourceScrapingOptions } from './types';
import { AppScrapingContext } from './strategies/app-strategy.interface';

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
 * Unified Scraping Service - Streamlined Version
 * Main entry point providing simplified interface for all apps
 * Uses streamlined scraper to eliminate redundant operations
 */
export class UnifiedScrapingService {
  
  /**
   * Streamlined source scraping - delegates to streamlined scraper
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions, context?: AppScrapingContext): Promise<string[]> {
    return await streamlinedScraper.scrapeSourceUrl(url, { ...options, context });
  }

  /**
   * Streamlined article scraping - delegates to streamlined scraper
   */
  async scrapeArticleUrl(url: string, config?: ScrapingConfig, context?: AppScrapingContext): Promise<ArticleContent> {
    return await streamlinedScraper.scrapeArticleUrl(url, config, context);
  }

  /**
   * Detect HTML structure - simplified fallback method
   */
  async detectArticleStructure(url: string, html?: string, contextStr?: string, context?: AppScrapingContext): Promise<ScrapingConfig> {
    try {
      return {
        titleSelector: 'h1, .title, .headline',
        contentSelector: 'article, .content, .post-content, .article-body',
        authorSelector: '.author, .byline, .writer',
        dateSelector: 'time, .date, .published, .timestamp',
        confidence: 0.8
      };
    } catch (error: any) {
      log(`[UnifiedScraper] Error detecting HTML structure: ${error.message}`, "scraper-error");
      throw new Error(`Failed to detect HTML structure: ${error.message}`);
    }
  }

  /**
   * Batch process multiple articles with concurrency control
   */
  async scrapeMultipleArticles(
    urls: string[], 
    config: ScrapingConfig, 
    options?: BatchOptions
  ): Promise<ArticleContent[]> {
    try {
      const concurrency = options?.concurrency || 3;
      const results: ArticleContent[] = [];
      
      log(`[UnifiedScraper] Starting batch processing of ${urls.length} articles`, "scraper");

      // Process URLs in batches
      for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (url) => {
          try {
            return await this.scrapeArticleUrl(url, config);
          } catch (error: any) {
            log(`[UnifiedScraper] Failed to process ${url}: ${error.message}`, "scraper-error");
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
        
        log(`[UnifiedScraper] Batch completed: ${i + batch.length}/${urls.length} processed`, "scraper");
      }

      log(`[UnifiedScraper] Batch processing completed: ${results.length}/${urls.length} successful`, "scraper");
      return results;

    } catch (error: any) {
      log(`[UnifiedScraper] Error in batch processing: ${error.message}`, "scraper-error");
      throw new Error(`Batch processing failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const unifiedScraper = new UnifiedScrapingService();

// Export types for compatibility
export type { ArticleContent, SourceScrapingOptions };
export type { ScrapingConfig } from './extractors/structure-detector';