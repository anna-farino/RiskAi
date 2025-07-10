import { log } from "backend/utils/log";
import { ArticleContent, SourceScrapingOptions } from '../types';
import { getContent } from '../core/method-selector';
import { detectSimpleSelectors } from '../extractors/structure-detection/simple-selector-detector';
import { extractCompleteContent } from '../extractors/content-extraction/simple-content-extractor';
import { extractFromPuppeteerHTML } from '../extractors/content-extraction/content-extractor';
import { extractArticleLinks, extractArticleLinksFromPage } from '../extractors/link-extraction/dynamic-content-handler';
import { AppScrapingContext } from '../strategies/app-strategy.interface';

/**
 * Simplified scraper that follows the 5-step process:
 * 1) Send HTML to OpenAI to find HTML selectors
 * 2) Debug selectors, if they are not HTML selectors (e.g., text content) debugging fails
 * 3a) If debugging passed, update cached selectors and extract content
 * 3b) If debugging failed, clear cache and try AI analysis again
 * 4) Debug again
 * 5a) If debugging passes, update cache and extract content
 * 5b) If debugging fails, try fallback selectors
 */
export class SimpleScraper {
  
  /**
   * Scrape article content using simplified 5-step process
   */
  async scrapeArticleUrl(url: string, context?: AppScrapingContext): Promise<ArticleContent> {
    try {
      log(`[SimpleScraper] Starting simplified article scraping: ${url}`, "scraper");

      // Get content (HTTP or Puppeteer)
      const contentResult = await getContent(url, true);

      // Handle Puppeteer pre-extracted content
      if (contentResult.method === 'puppeteer') {
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

        log(`[SimpleScraper] Puppeteer extraction complete - title: ${result.title.length} chars, content: ${result.content.length} chars`, "scraper");
        return result;
      }

      // HTTP content - use simplified 5-step selector detection
      log(`[SimpleScraper] Using HTTP content with simplified selector detection`, "scraper");
      
      // Run the 5-step selector detection process
      const selectorConfig = await detectSimpleSelectors(url, contentResult.html);
      
      // Extract content using validated selectors
      const result = await extractCompleteContent(contentResult.html, selectorConfig);
      
      log(`[SimpleScraper] Simplified extraction complete - title: ${result.title.length} chars, content: ${result.content.length} chars, confidence: ${result.confidence}`, "scraper");
      
      return result;

    } catch (error: any) {
      log(`[SimpleScraper] Error in simplified article scraping: ${error.message}`, "scraper-error");
      
      // Return error result
      return {
        title: "Extraction Failed",
        content: `Content extraction failed: ${error.message}`,
        author: undefined,
        publishDate: null,
        extractionMethod: 'error',
        confidence: 0
      };
    }
  }

  /**
   * Scrape source URLs for article links
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions, context?: AppScrapingContext): Promise<string[]> {
    try {
      log(`[SimpleScraper] Starting simplified source scraping: ${url}`, "scraper");

      // Get content (HTTP or Puppeteer)
      const result = await getContent(url, false);

      // Check if we need advanced HTMX extraction
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

      // Use advanced extraction for HTMX/dynamic sites
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
          
          log(`[SimpleScraper] Advanced extraction found ${articleLinks.length} article links`, "scraper");
          return articleLinks;
          
        } finally {
          if (page) {
            await page.close();
          }
        }
      } else {
        // Simple HTTP extraction
        log(`[SimpleScraper] Using simple HTTP extraction`, "scraper");
        const articleLinks = await extractArticleLinks(result.html, url, extractionOptions);
        
        log(`[SimpleScraper] Simple extraction found ${articleLinks.length} article links`, "scraper");
        return articleLinks;
      }

    } catch (error: any) {
      log(`[SimpleScraper] Error in simplified source scraping: ${error.message}`, "scraper-error");
      return [];
    }
  }
}

// Export singleton instance
export const simpleScraper = new SimpleScraper();