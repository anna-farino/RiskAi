import { log } from "backend/utils/log";
import { ScrapingConfig, ArticleContent, SourceScrapingOptions } from '../types';
import { extractPublishDate } from '../date-extraction/centralized-date-extractor';
import { RobustCache } from './cache-system';
import { getContent } from './method-selector';
import { getStructureConfig, isValidConfig } from './structure-detector';
import { 
  extractContentWithSelectors, 
  extractFromPuppeteerHTML 
} from './content-extractor';
import { 
  shouldTriggerAIReanalysis, 
  performAIReanalysis 
} from './ai-reanalysis';
import { scrapeSourceUrl } from './source-scraper';
import { AppScrapingContext } from '../strategies/app-strategy.interface';

/**
 * Streamlined Unified Scraper V2
 * Single-pass sequential workflow eliminating redundant operations
 */
export class StreamlinedUnifiedScraper {
  private cache = new RobustCache();

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
        
        // Step 2: Get structure config (validate config first, then cache or AI)
        let structureConfig = config;
        
        // Validate the passed config to ensure it doesn't contain corrupted selectors
        if (config && (!isValidConfig(config))) {
          log(`[SimpleScraper] Invalid config passed, using AI detection instead`, "scraper");
          structureConfig = null;
        }
        
        structureConfig = structureConfig || await getStructureConfig(this.cache, url, contentResult.html, context);

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
    // Pass context through options for backward compatibility
    const optionsWithContext = {
      ...options,
      context: context || options?.context
    };
    return await scrapeSourceUrl(url, optionsWithContext);
  }

  /**
   * Clear cache for a specific URL
   */
  clearCache(url: string): void {
    this.cache.clear(url);
  }
}

// Export singleton instance for backward compatibility
export const unifiedScraper = new StreamlinedUnifiedScraper();