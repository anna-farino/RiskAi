import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

// Import componentized modules with aliases to avoid conflicts
import { 
  LinkExtractionOptions, 
  LinkData, 
  extractLinksFromHTML as extractLinksFromHTMLComponent, 
  hasUsableLinks as hasUsableLinksComponent 
} from './link-extraction/html-link-parser';
import { 
  normalizeUrls as normalizeUrlsComponent, 
  filterLinksByPatterns as filterLinksByPatternsComponent 
} from './link-extraction/url-normalizer';
import { 
  identifyArticleLinksWithAI as identifyArticleLinksWithAIComponent 
} from './link-extraction/ai-link-identifier';
import { 
  extractLinksFromPage as extractLinksFromPageComponent 
} from './link-extraction/puppeteer-link-handler';
import { 
  extractArticleLinksFromPage as extractArticleLinksFromPageComponent, 
  extractArticleLinks as extractArticleLinksComponent 
} from './link-extraction/dynamic-content-handler';

// Re-export interfaces and functions for backward compatibility
export { LinkExtractionOptions, LinkData };
export { normalizeUrlsComponent as normalizeUrls };
export { filterLinksByPatternsComponent as filterLinksByPatterns };
export { identifyArticleLinksWithAIComponent as identifyArticleLinksWithAI };
export { hasUsableLinksComponent as hasUsableLinks };
export { extractLinksFromHTMLComponent as extractLinksFromHTML };
export { extractLinksFromPageComponent as extractLinksFromPage };
export { extractArticleLinksFromPageComponent as extractArticleLinksFromPage };
export { extractArticleLinksComponent as extractArticleLinks };