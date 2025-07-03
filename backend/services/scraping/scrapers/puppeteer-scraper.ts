import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

// Import componentized modules
import { 
  isExternalValidationError, 
  safePageEvaluate 
} from './puppeteer-scraper/error-handler';
import { handleHTMXContent } from './puppeteer-scraper/htmx-handler';
import { handleDynamicContent } from './puppeteer-scraper/dynamic-handler';
import { 
  extractPageContent, 
  extractContentWithFallback, 
  extractContentWithAIFallback 
} from './puppeteer-scraper/content-extractor';
import { 
  scrapeWithPuppeteer, 
  scrapeWithStealthPuppeteer, 
  PuppeteerScrapingOptions 
} from './puppeteer-scraper/main-scraper';

// Re-export interfaces and functions for backward compatibility
export { PuppeteerScrapingOptions };
export { isExternalValidationError };
export { safePageEvaluate };
export { handleHTMXContent };
export { handleDynamicContent };
export { extractPageContent };
export { extractContentWithFallback };
export { extractContentWithAIFallback };
export { scrapeWithPuppeteer };
export { scrapeWithStealthPuppeteer };