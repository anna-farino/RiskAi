import { unifiedScraper } from 'backend/services/scraping/scrapers/main-scraper';
import { analyzeContent } from './openai';
import { StrategyLoader } from 'backend/services/scraping/strategies/strategy-loader';

// Create News Radar scraping service with context
class NewsRadarScrapingService {
  private context = StrategyLoader.createContext('news-radar');

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

// News Radar uses enhanced scraping with its own context
export const scrapingService = new NewsRadarScrapingService();

// Keep News Radar specific functions unchanged
export { analyzeContent } from './openai';