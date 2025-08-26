import { log } from "backend/utils/log";
import { ScrapingConfig, ArticleContent, SourceScrapingOptions } from '../types';
import { extractPublishDate } from '../extractors/content-extraction/date-extractor';
// Cache system now integrated into structure-detector.ts
import { getContent } from '../core/method-selector';
import { detectHtmlStructure } from '../extractors/structure-detection/structure-detector';
import { validateContent } from '../core/error-detection';
import { 
  extractContentWithSelectors 
} from '../extractors/content-extraction/content-extractor';
import { 
  shouldTriggerAIReanalysis, 
  performAIReanalysis 
} from '../extractors/content-extraction/ai-reanalysis';
import { extractArticleLinks, extractArticleLinksFromPage } from '../extractors/link-extraction/dynamic-content-handler';
import { AppScrapingContext } from '../strategies/app-strategy.interface';
import { 
  logSourceScrapingError, 
  logArticleScrapingError,
  logStructureDetectionError,
  logContentExtractionError,
  inferErrorType,
  type ScrapingContextInfo 
} from "backend/services/error-logging";

/**
 * Streamlined Unified Scraper V2
 * Single-pass sequential workflow eliminating redundant operations
 */
export class StreamlinedUnifiedScraper {
  // Cache is now handled in structure-detector.ts

  /**
   * Streamlined article scraping - 3 steps total
   * @param context - Optional app-specific context for neutral operation
   * @param errorContext - Optional context for error logging (userId, sourceId, etc.)
   */
  async scrapeArticleUrl(url: string, config?: ScrapingConfig, context?: AppScrapingContext, errorContext?: ScrapingContextInfo): Promise<ArticleContent> {
    try {
      log(`[SimpleScraper] Starting article scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const contentResult = await getContent(url, true);

      // Validate content quality
      const validation = await validateContent(contentResult.html, url);
      
      if (!validation.isValid || validation.isErrorPage) {
        log(`[SimpleScraper] Content validation failed: ${validation.errorIndicators.join(', ')}, confidence: ${validation.confidence}%`, "scraper");
        // Continue anyway but log the issue
      }
      
      if (validation.linkCount < 10) {
        log(`[SimpleScraper] Warning: Only ${validation.linkCount} links found (minimum 10 recommended)`, "scraper");
      }

      // Both HTTP and Puppeteer content need the same complete processing pipeline
      // Puppeteer is just a different way to get the HTML - the processing should be identical
      log(`[SimpleScraper] Processing ${contentResult.method} content with complete extraction pipeline`, "scraper");
      
      // Step 2: Get structure config using unified detector
      let structureConfig = config;
      
      // If no config provided, use AI detection
      if (!structureConfig) {
        try {
          structureConfig = await detectHtmlStructure(url, contentResult.html, context);
        } catch (error) {
          if (error instanceof Error && errorContext) {
            await logStructureDetectionError(
              error,
              errorContext,
              url,
              contentResult.method,
              {
                step: 'html-structure-detection',
                hasConfig: !!config,
                method: contentResult.method,
              }
            );
          }
          throw error;
        }
      }

      // Step 3: Extract content with enhanced recovery
      let extracted;
      try {
        extracted = extractContentWithSelectors(contentResult.html, structureConfig);
        
        // Phase 4: AI re-analysis trigger for failed extractions
        if (shouldTriggerAIReanalysis(extracted)) {
          log(`[SimpleScraper] Triggering AI re-analysis due to insufficient extraction`, "scraper");
          extracted = await performAIReanalysis(contentResult.html, url, extracted);
        }
      } catch (error) {
        if (error instanceof Error && errorContext) {
          await logContentExtractionError(
            error,
            errorContext,
            url,
            contentResult.method,
            {
              step: 'content-selector-extraction',
              titleLength: extracted?.title?.length || 0,
              contentLength: extracted?.content?.length || 0,
              method: contentResult.method,
              structureConfig: structureConfig ? 'provided' : 'detected',
            }
          );
        }
        throw error;
      }

      // Extract publish date using centralized date extractor
      // Use date from AI reanalysis if available, otherwise extract using structure config
      let publishDate: Date | null = extracted.publishDate || null;
      if (!publishDate) {
        try {
          publishDate = await extractPublishDate(contentResult.html, {
            dateSelector: structureConfig.dateSelector,
            dateAlternatives: []
          });
        } catch (error) {
          log(`[SimpleScraper] Date extraction failed: ${error}`, "scraper");
        }
      }

      // Adjust confidence based on validation results
      const adjustedConfidence = validation.isValid ? 
        (extracted.confidence || 0.9) : 
        Math.min((extracted.confidence || 0.9) * (validation.confidence / 100), 0.5);

      const result: ArticleContent = {
        title: extracted.title || '',
        content: extracted.content || '',
        author: extracted.author,
        publishDate,
        extractionMethod: `${contentResult.method}_${extracted.extractionMethod || 'selectors'}`,
        confidence: adjustedConfidence
      };

      log(`[SimpleScraper] Final extraction result (title=${result.title.length} chars, content=${result.content.length} chars, method=${result.extractionMethod}, confidence=${result.confidence})`, "scraper");
      return result;

    } catch (error: any) {
      log(`[SimpleScraper] Error in article scraping: ${error.message}`, "scraper-error");
      
      // Log the error with context if available
      if (error instanceof Error && errorContext) {
        await logArticleScrapingError(
          error,
          errorContext,
          url,
          'http', // Default, will be overridden by actual method in most cases
          'article-scraping',
          {
            step: 'general-article-scraping-failure',
            operation: 'main-scraper-article',
            errorOccurredAt: new Date().toISOString(),
          }
        );
      }
      
      throw error;
    }
  }

  /**
   * Source URL scraping with advanced HTMX handling
   * @param context - Optional app-specific context for neutral operation
   * @param errorContext - Optional context for error logging (userId, sourceId, etc.)
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions, context?: AppScrapingContext, errorContext?: ScrapingContextInfo): Promise<string[]> {
    try {
      log(`[SimpleScraper] Starting source scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const result = await getContent(url, false);

      // Step 2: Respect method selector's decision - only use advanced extraction if Puppeteer was chosen
      // Method selector already evaluated dynamic content needs and made optimal decision
      const needsAdvancedExtraction = result.method === 'puppeteer';

      const extractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        context: context || options?.context,
        maxLinks: options?.maxLinks || 50,
        minLinkTextLength: 15
      };

      // Step 3: Use advanced extraction only for Puppeteer results (method selector chose Puppeteer for good reason)
      if (needsAdvancedExtraction) {
        log(`[SimpleScraper] Method selector chose Puppeteer - using advanced HTMX extraction`, "scraper");
        
        // Import setup functions
        const { setupSourcePage } = await import('../core/page-setup');
        let page = null;
        
        try {
          // Create and setup page for advanced extraction
          page = await setupSourcePage();
          
          // Navigate to the page
          log(`[SimpleScraper] Navigating to ${url} for advanced extraction`, "scraper");
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          
          // Check if page has HTMX and load HTMX content first
          const htmxDetected = await page.evaluate(() => {
            return !!(window as any).htmx || 
                   !!document.querySelector('[hx-get], [hx-post], [hx-trigger], script[src*="htmx"]') ||
                   !!document.querySelector('[data-hx-get], [data-hx-post], [data-hx-trigger]');
          });
          
          if (htmxDetected) {
            log(`[SimpleScraper] HTMX detected on source page, loading HTMX content before extraction`, "scraper");
            const { handleHTMXContent } = await import('../scrapers/puppeteer-scraper/htmx-handler');
            await handleHTMXContent(page, url);
            log(`[SimpleScraper] HTMX content loaded, proceeding with link extraction`, "scraper");
          }
          
          // Now extract links from the enriched DOM
          const articleLinks = await extractArticleLinksFromPage(page, url, extractionOptions);
          
          // Validate we have enough links after HTMX processing
          if (articleLinks.length < 10 && htmxDetected) {
            log(`[SimpleScraper] Warning: Only ${articleLinks.length} links found after HTMX loading (minimum 10 expected)`, "scraper");
            
            // Try one more time with a longer wait
            log(`[SimpleScraper] Attempting additional HTMX content loading with longer wait`, "scraper");
            await new Promise(resolve => setTimeout(resolve, 5000));
            const retryLinks = await extractArticleLinksFromPage(page, url, extractionOptions);
            
            if (retryLinks.length > articleLinks.length) {
              log(`[SimpleScraper] Retry successful: ${retryLinks.length} links found`, "scraper");
              return retryLinks;
            }
          }
          
          log(`[SimpleScraper] Advanced HTMX extraction completed: ${articleLinks.length} links found`, "scraper");
          return articleLinks;
          
        } catch (puppeteerError) {
          if (puppeteerError instanceof Error && errorContext) {
            await logSourceScrapingError(
              puppeteerError,
              errorContext,
              'puppeteer',
              {
                step: 'puppeteer-source-extraction',
                operation: 'htmx-dynamic-content',
                url,
                maxLinks: extractionOptions.maxLinks,
                hasAdvancedExtraction: true,
              }
            );
          }
          throw puppeteerError;
        } finally {
          if (page) {
            try {
              await page.close();
            } catch (closeError) {
              log(`[SimpleScraper] Error closing page: ${closeError}`, "scraper-error");
              // Don't log page close errors to database - they're cleanup issues
            }
          }
        }
      } else {
        // Step 3: Use standard extraction for HTTP results (method selector determined HTTP is sufficient)
        log(`[SimpleScraper] Method selector chose HTTP - using standard extraction (${result.html.length} chars)`, "scraper");
        try {
          const articleLinks = await extractArticleLinks(result.html, url, extractionOptions);
          log(`[SimpleScraper] Standard extraction completed: ${articleLinks.length} article links found`, "scraper");
          return articleLinks;
        } catch (standardError) {
          if (standardError instanceof Error && errorContext) {
            await logSourceScrapingError(
              standardError,
              errorContext,
              result.method,
              {
                step: 'standard-link-extraction',
                operation: 'static-content',
                url,
                maxLinks: extractionOptions.maxLinks,
                hasAdvancedExtraction: false,
              }
            );
          }
          throw standardError;
        }
      }

    } catch (error: any) {
      log(`[SimpleScraper] Error in source scraping: ${error.message}`, "scraper-error");
      
      // Log the error with context if available
      if (error instanceof Error && errorContext) {
        await logSourceScrapingError(
          error,
          errorContext,
          'http', // Default, will be determined by method detection
          {
            step: 'general-source-scraping-failure',
            operation: 'main-scraper-source',
            url,
            errorOccurredAt: new Date().toISOString(),
          }
        );
      }
      
      throw error;
    }
  }

  /**
   * Clear cache for a specific URL
   */
  clearCache(url: string): void {
    // Cache clearing is now handled by structure-detector.ts
    // Import clearStructureCache if needed
  }
}

// Export singleton instance for backward compatibility
export const unifiedScraper = new StreamlinedUnifiedScraper();