/**
 * Minimal facade for unified scraper v2 - re-exports only the essential singleton
 */
import { unifiedScraper } from './unified-scraper-v2/main-scraper';
import { ArticleContent, SourceScrapingOptions } from './types';

// Re-export the singleton and essential types
export { unifiedScraper, ArticleContent, SourceScrapingOptions };