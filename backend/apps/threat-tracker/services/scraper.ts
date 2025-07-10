import { unifiedScraper } from 'backend/services/scraping/scrapers/main-scraper';
import { analyzeContent } from './openai';
import { extractPublishDate } from './date-extractor';
import { normalizeUrl, titleSimilarity } from './url-utils';

// Create Threat Tracker scraping service with context
import { StrategyLoader } from 'backend/services/scraping/strategies/strategy-loader';

class ThreatTrackerScrapingService {
  private context = StrategyLoader.createContext('threat-tracker');

  async scrapeSourceUrl(url: string, options?: any): Promise<string[]> {
    return await unifiedScraper.scrapeSourceUrl(url, { ...options, context: this.context });
  }

  async scrapeArticleUrl(url: string, config?: any): Promise<any> {
    return await unifiedScraper.scrapeArticleUrl(url, config, this.context);
  }

  async detectArticleStructure(url: string, html?: string): Promise<any> {
    // Use the main scraper's structure detection directly
    const { detectHtmlStructure } = await import('backend/services/scraping/extractors/structure-detection/structure-detector');
    return await detectHtmlStructure(url, html, this.context);
  }
}

// Threat Tracker uses enhanced scraping with its own context
export const scrapingService = new ThreatTrackerScrapingService();

// Keep Threat Tracker specific functions unchanged
export { analyzeContent } from './openai';
export { extractPublishDate } from './date-extractor';
export { normalizeUrl, titleSimilarity } from './url-utils';