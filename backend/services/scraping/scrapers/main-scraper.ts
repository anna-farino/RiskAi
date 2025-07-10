import { log } from "backend/utils/log";
import { ScrapingConfig, ArticleContent, SourceScrapingOptions } from '../types';
import { extractPublishDate } from '../extractors/content-extraction/date-extractor';
// Cache system now integrated into structure-detector.ts
import { getContent } from '../core/method-selector';
import { detectHtmlStructure } from '../extractors/structure-detection/structure-detector';
import { 
  extractContentWithSelectors, 
  extractFromPuppeteerHTML 
} from '../extractors/content-extraction/content-extractor';
import { 
  shouldTriggerAIReanalysis, 
  performAIReanalysis 
} from '../extractors/content-extraction/ai-reanalysis';
import { extractArticleLinks, extractArticleLinksFromPage } from '../extractors/link-extraction/dynamic-content-handler';
import { AppScrapingContext } from '../strategies/app-strategy.interface';

/**
 * Streamlined Unified Scraper V2
 * Single-pass sequential workflow eliminating redundant operations
 */
export class StreamlinedUnifiedScraper {
  // Cache is now handled in structure-detector.ts

  /**
   * Streamlined article scraping - 3 steps total
   * @param context - Optional app-specific context for neutral operation
   */
  async scrapeArticleUrl(url: string, config?: ScrapingConfig, context?: AppScrapingContext): Promise<ArticleContent> {
    try {
      log(`[SimpleScraper] Starting article scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const contentResult = await getContent(url, true);

      // Handle different extraction approaches based on method
      if (contentResult.method === 'puppeteer') {
        // Puppeteer returns pre-extracted content in structured HTML format
        log(`[SimpleScraper] Using Puppeteer pre-extracted content`, "scraper");
        const extracted = extractFromPuppeteerHTML(contentResult.html);
        
        const result: ArticleContent = {
          title: extracted.title || '',
          content: extracted.content || '',
          author: extracted.author,
          publishDate: extracted.publishDate,
          extractionMethod: 'puppeteer',
          confidence: 0.9
        };

        log(`[SimpleScraper] Extracted article (title=${result.title.length} chars, content=${result.content.length} chars)`, "scraper");
        return result;
        
      } else {
        // HTTP content needs AI structure detection and selector extraction
        log(`[SimpleScraper] Using HTTP content with AI structure detection`, "scraper");
        
        // Step 2: Get structure config using unified detector
        let structureConfig = config;
        
        // If no config provided, use AI detection
        if (!structureConfig) {
          structureConfig = await detectHtmlStructure(url, contentResult.html, context);
        }

        // Step 3: Extract content with enhanced recovery
        let extracted = extractContentWithSelectors(contentResult.html, structureConfig);
        
        // Phase 4: AI re-analysis trigger for failed extractions
        if (shouldTriggerAIReanalysis(extracted)) {
          log(`[SimpleScraper] Triggering AI re-analysis due to insufficient extraction`, "scraper");
          extracted = await performAIReanalysis(contentResult.html, url, extracted);
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

        const result: ArticleContent = {
          title: extracted.title || '',
          content: extracted.content || '',
          author: extracted.author,
          publishDate,
          extractionMethod: extracted.extractionMethod || 'selectors',
          confidence: extracted.confidence || 0.9
        };

        log(`[SimpleScraper] Final extraction result (title=${result.title.length} chars, content=${result.content.length} chars, method=${result.extractionMethod}, confidence=${result.confidence})`, "scraper");
        return result;
      }

    } catch (error: any) {
      log(`[SimpleScraper] Error in article scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Source URL scraping with advanced HTMX handling
   * @param context - Optional app-specific context for neutral operation
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions, context?: AppScrapingContext): Promise<string[]> {
    try {
      log(`[SimpleScraper] Starting source scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const result = await getContent(url, false);

      // Step 2: Check if we need advanced HTMX extraction
      const { detectDynamicContentNeeds } = await import('../core/method-selector');
      const needsAdvancedExtraction = result.method === 'puppeteer' || 
        detectDynamicContentNeeds(result.html, url);

      const extractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        context: context || options?.context,
        maxLinks: options?.maxLinks || 50,
        minLinkTextLength: 15
      };

      // Step 3: Use advanced extraction for HTMX/dynamic sites
      if (needsAdvancedExtraction) {
        log(`[SimpleScraper] Dynamic content detected, using advanced HTMX extraction`, "scraper");
        
        // Import setup functions
        const { setupSourcePage } = await import('../core/page-setup');
        let page = null;
        
        try {
          // Create and setup page for advanced extraction
          page = await setupSourcePage();
          
          // Navigate to the page
          log(`[SimpleScraper] Navigating to ${url} for advanced extraction`, "scraper");
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          
          // Use the advanced HTMX extraction
          const articleLinks = await extractArticleLinksFromPage(page, url, extractionOptions);
          
          log(`[SimpleScraper] Advanced HTMX extraction completed: ${articleLinks.length} links found`, "scraper");
          return articleLinks;
          
        } finally {
          if (page) {
            try {
              await page.close();
            } catch (closeError) {
              log(`[SimpleScraper] Error closing page: ${closeError}`, "scraper-error");
            }
          }
        }
      } else {
        // Step 3: Extract links with standard method for static sites
        const articleLinks = await extractArticleLinks(result.html, url, extractionOptions);
        log(`[SimpleScraper] Extracted ${articleLinks.length} article links using standard method`, "scraper");
        return articleLinks;
      }

    } catch (error: any) {
      log(`[SimpleScraper] Error in source scraping: ${error.message}`, "scraper-error");
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