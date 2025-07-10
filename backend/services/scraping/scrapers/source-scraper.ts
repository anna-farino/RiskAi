import { log } from "backend/utils/log";
import { extractArticleLinks, extractArticleLinksFromPage } from '../extractors/link-extraction/dynamic-content-handler';
import { LinkExtractionOptions, SourceScrapingOptions } from '../types';
import { getContent, detectDynamicContentNeeds } from './method-selector';



/**
 * Advanced source scraping with sophisticated HTMX handling
 */
export async function scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]> {
  try {
    log(`[SimpleScraper] Starting source scraping: ${url}`, "scraper");

    // Step 1: Get content (HTTP or Puppeteer)
    const result = await getContent(url, false);

    // Step 2: Check if we need advanced HTMX extraction
    const needsAdvancedExtraction = result.method === 'puppeteer' || 
      detectDynamicContentNeeds(result.html, url);

    const extractionOptions: LinkExtractionOptions = {
      includePatterns: options?.includePatterns,
      excludePatterns: options?.excludePatterns,
      aiContext: options?.aiContext,
      context: options?.context,  // Pass app context through
      maxLinks: options?.maxLinks || 50,
      minLinkTextLength: 15  // Reduced from 20 to capture more dynamic content links
    };

    // Step 3: Use advanced extraction for HTMX/dynamic sites
    if (needsAdvancedExtraction) {
      log(`[SimpleScraper] Dynamic content detected, using advanced HTMX extraction`, "scraper");
      return await extractLinksWithAdvancedHTMX(url, extractionOptions);
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
 * Advanced HTMX link extraction using dedicated Puppeteer page
 */
async function extractLinksWithAdvancedHTMX(url: string, options: LinkExtractionOptions): Promise<string[]> {
  let page = null;
  
  try {
    log(`[SimpleScraper] Starting advanced HTMX link extraction for: ${url}`, "scraper");
    
    // Import setup functions
    const { setupSourcePage } = await import('../core/page-setup');
    
    // Create and setup page for advanced extraction
    page = await setupSourcePage();
    
    // Navigate to the page
    log(`[SimpleScraper] Navigating to ${url} for advanced extraction`, "scraper");
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Use the new advanced HTMX extraction
    const articleLinks = await extractArticleLinksFromPage(page, url, options);
    
    log(`[SimpleScraper] Advanced HTMX extraction completed: ${articleLinks.length} links found`, "scraper");
    return articleLinks;
    
  } catch (error: any) {
    log(`[SimpleScraper] Error in advanced HTMX extraction: ${error.message}`, "scraper-error");
    throw error;
  } finally {
    // Clean up the page
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        log(`[SimpleScraper] Error closing page: ${closeError}`, "scraper-error");
      }
    }
  }
}