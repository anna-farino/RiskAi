import { runPuppeteerWorker } from '../../../utils/puppeteer-worker-executor';
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
  log(`[scrapePuppeteer] 🟢 Function started with URL: ${url}`);

  // Simple URL validation
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error(`Puppeteer scraping failed: Invalid URL: ${url}`);
  }

  try {
    // Try Puppeteer worker first
    log('[scrapePuppeteer] 🟢 Starting Puppeteer worker process');
    try {
      const result = await runPuppeteerWorker({
        url,
        isArticlePage,
        scrapingConfig
      });
      
      log('[scrapePuppeteer] ✅ Worker process completed successfully');
      return result;
    } catch (workerError: any) {
      log(`[scrapePuppeteer] Worker failed: ${workerError.message}, trying fallback scraper`);
      
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


