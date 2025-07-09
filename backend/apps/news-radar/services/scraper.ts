import { UnifiedScrapingService } from 'backend/services/scraping';
import { analyzeContent } from './openai';
import { StrategyLoader } from 'backend/services/scraping/strategies/strategy-loader';

// Create News Radar scraping service with context
class NewsRadarScrapingService extends UnifiedScrapingService {
  private context = StrategyLoader.createContext('news-radar');

  async scrapeSourceUrl(url: string, options?: any): Promise<string[]> {
    return super.scrapeSourceUrl(url, options, this.context);
  }

  async scrapeArticleUrl(url: string, config?: any): Promise<any> {
    return super.scrapeArticleUrl(url, config, this.context);
  }

  async detectArticleStructure(url: string, html?: string): Promise<any> {
    return super.detectArticleStructure(url, html, 'general news', this.context);
  }
}

// News Radar uses enhanced scraping with its own context
export const scrapingService = new NewsRadarScrapingService();

// Keep News Radar specific functions unchanged
export { analyzeContent } from './openai';