import { puppeteerClusterService } from '../../../utils/puppeteer-cluster';
import { simpleFallbackScraper } from '../../../utils/simple-scraper-fallback';
import { log } from 'console';
import dotenv from 'dotenv';
import dotenvConfig from 'backend/utils/dotenv-config';

dotenvConfig(dotenv)

export async function scrapePuppeteer(
  url: string,
  isArticlePage: boolean = false,
  scrapingConfig: any,
): Promise<string> {
  log(`[scrapePuppeteer] 🚀 Function started with URL: ${url}`);

  // Simple URL validation
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error(`Puppeteer scraping failed: Invalid URL: ${url}`);
  }

  try {
    // Try Puppeteer cluster first (much faster than worker processes)
    log('[scrapePuppeteer] 🚀 Using Puppeteer cluster for scraping');
    try {
      const result = await puppeteerClusterService.scrapeUrl(url, isArticlePage, scrapingConfig);
      
      log('[scrapePuppeteer] ✅ Cluster scraping completed successfully');
      return result;
    } catch (clusterError: any) {
      log(`[scrapePuppeteer] Cluster failed: ${clusterError.message}, trying fallback scraper`);
      
      // Fallback to simple HTTP scraper
      const fallbackResult = await simpleFallbackScraper(url, isArticlePage);
      log('[scrapePuppeteer] ✅ Fallback scraper completed');
      return fallbackResult;
    }
  } catch (error: any) {
    console.error("[scrapePuppeteer] All scraping methods failed:", error);
    throw new Error(`Puppeteer scraping failed: ${error?.message || String(error)}`);
  }
}

/**
 * Scrape multiple URLs concurrently using Puppeteer cluster for maximum performance
 * Returns results for all URLs, including failures  
 */
export async function scrapePuppeteerBatch(
  urls: string[], 
  isArticlePage: boolean = false, 
  scrapingConfig?: any
): Promise<Array<{url: string, html: string, success: boolean, error?: string}>> {
  log(`[scrapePuppeteerBatch] 🚀 Starting concurrent scraping of ${urls.length} URLs`);
  
  try {
    const tasks = urls.map(url => ({
      url: url.startsWith("http") ? url : "https://" + url,
      isArticlePage,
      scrapingConfig: scrapingConfig || {}
    }));

    log('[scrapePuppeteerBatch] 🚀 Using Puppeteer cluster for batch scraping');
    const results = await puppeteerClusterService.scrapeMultipleUrls(tasks);
    
    const successCount = results.filter(r => r.success).length;
    log(`[scrapePuppeteerBatch] ✅ Batch scraping completed: ${successCount}/${urls.length} successful`);
    
    return results.map(result => ({
      url: result.url,
      html: result.html,
      success: result.success,
      error: result.error
    }));
  } catch (error: any) {
    log(`[scrapePuppeteerBatch] Batch scraping failed: ${error.message}`);
    throw error;
  }
}

