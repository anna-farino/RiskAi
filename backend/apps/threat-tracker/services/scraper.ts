import { UnifiedScrapingService } from '../../services/scraping';
import { analyzeContent } from './openai';
import { extractPublishDate } from './date-extractor';
import { normalizeUrl, titleSimilarity } from './url-utils';

// Threat Tracker now uses unified scraping system directly
// No legacy wrappers - apps call UnifiedScrapingService methods directly
export const scrapingService = new UnifiedScrapingService();

// Keep Threat Tracker specific functions unchanged
export { analyzeContent } from './openai';
export { extractPublishDate } from './date-extractor';
export { normalizeUrl, titleSimilarity } from './url-utils';