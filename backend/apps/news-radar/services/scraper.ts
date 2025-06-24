import { UnifiedScrapingService } from '../../services/scraping';
import { analyzeContent } from './openai';

// News Radar now uses unified scraping system directly
// No legacy wrappers - apps call UnifiedScrapingService methods directly
export const scrapingService = new UnifiedScrapingService();

// Keep News Radar specific functions unchanged
export { analyzeContent } from './openai';