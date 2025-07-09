import { ScrapingConfig, ArticleContent } from '../types';

/**
 * App-specific scraping context for neutral operation
 * Each app provides its own AI functions and patterns
 */
export interface AppScrapingContext {
  appType: 'news-radar' | 'threat-tracker' | 'news-capsule';
  
  // AI function references provided by each app
  aiProviders: {
    // Link identification using app-specific OpenAI logic
    identifyArticleLinks?: (html: string) => Promise<string[]>;
    
    // HTML structure detection for content extraction
    detectHtmlStructure?: (html: string, url: string) => Promise<ScrapingConfig>;
    
    // Date extraction with app-specific patterns
    extractPublishDate?: (articleContent: string, articleTitle: string, htmlContent: string) => Promise<Date | null>;
    
    // Content analysis (for future use)
    analyzeContent?: (content: string, ...args: any[]) => Promise<any>;
  };
  
  // Optional app-specific URL patterns (no hardcoded keywords)
  linkPatterns?: {
    includePatterns?: RegExp[];
    excludePatterns?: RegExp[];
  };
  
  // Optional extraction preferences
  extractionOptions?: {
    maxLinks?: number;
    minLinkTextLength?: number;
    preferredDateFormats?: string[];
  };
}

/**
 * Strategy interface for app-specific scraping logic
 */
export interface AppScrapingStrategy {
  // Get the context for this app
  getContext(): AppScrapingContext;
  
  // Process scraped content with app-specific logic
  processArticleContent?(content: ArticleContent): ArticleContent;
  
  // Filter links with app-specific criteria
  filterLinks?(links: string[]): string[];
  
  // Validate content quality with app-specific rules
  validateContent?(content: ArticleContent): boolean;
}