import { runPuppeteerWorker } from '../../../utils/puppeteer-worker-executor';
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
    // Use the worker process instead of direct Puppeteer
    log('[scrapePuppeteer] 🟢 Starting Puppeteer worker process');
    const result = await runPuppeteerWorker({
      url,
      isArticlePage,
      scrapingConfig
    });
    
    log('[scrapePuppeteer] ✅ Worker process completed successfully');
    return result;
  } catch (error: any) {
    console.error("[scrapePuppeteer] Fatal error during scraping:", error);
    throw new Error(`Puppeteer scraping failed: ${error?.message || String(error)}`);
  }
}


