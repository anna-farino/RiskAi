import { log } from "backend/utils/log";

// Import componentized modules
import { RobustCache } from './unified-scraper-v2/cache-system';
import { getContent, detectDynamicContentNeeds } from './unified-scraper-v2/method-selector';
import { getStructureConfig, isValidConfig } from './unified-scraper-v2/structure-detector';
import { 
  extractContentWithSelectors, 
  extractFromPuppeteerHTML, 
  ArticleContent,
  generateSelectorVariations,
  isLowQualityContent
} from './unified-scraper-v2/content-extractor';
import { 
  shouldTriggerAIReanalysis, 
  performAIReanalysis 
} from './unified-scraper-v2/ai-reanalysis';
import { scrapeSourceUrl, SourceScrapingOptions } from './unified-scraper-v2/source-scraper';
import { StreamlinedUnifiedScraper } from './unified-scraper-v2/main-scraper';

// Re-export interfaces and functions for backward compatibility
export { ArticleContent };
export { SourceScrapingOptions };
export { RobustCache };
export { getContent };
export { detectDynamicContentNeeds };
export { getStructureConfig };
export { isValidConfig };
export { extractContentWithSelectors };
export { extractFromPuppeteerHTML };
export { generateSelectorVariations };
export { isLowQualityContent };
export { shouldTriggerAIReanalysis };
export { performAIReanalysis };
export { scrapeSourceUrl };
export { StreamlinedUnifiedScraper };

// Export singleton instance for backward compatibility
export const unifiedScraper = new StreamlinedUnifiedScraper();