import { UnifiedScrapingService } from 'backend/services/scraping';
import { analyzeContent } from './openai';
import { extractPublishDate } from './date-extractor';
import { normalizeUrl, titleSimilarity } from './url-utils';

// Create Threat Tracker scraping service with context
import { StrategyLoader } from 'backend/services/scraping/strategies/strategy-loader';

class ThreatTrackerScrapingService extends UnifiedScrapingService {
  private context = StrategyLoader.createContext('threat-tracker');

  async scrapeSourceUrl(url: string, options?: any): Promise<string[]> {
    return super.scrapeSourceUrl(url, options, this.context);
  }

  async scrapeArticleUrl(url: string, config?: any): Promise<any> {
    return super.scrapeArticleUrl(url, config, this.context);
  }

  async detectArticleStructure(url: string, html?: string): Promise<any> {
    return super.detectArticleStructure(url, html, 'cybersecurity threat intelligence', this.context);
  }
}

// Threat Tracker uses enhanced scraping with its own context
export const scrapingService = new ThreatTrackerScrapingService();

// Keep Threat Tracker specific functions unchanged
export { analyzeContent } from './openai';
export { extractPublishDate } from './date-extractor';
export { normalizeUrl, titleSimilarity } from './url-utils';