import { log } from "backend/utils/log";
import { ScrapingConfig } from '../types';
import { detectHtmlStructureWithAI } from '../ai/structure-detector';
import { RobustCache } from './cache-system';
import { AppScrapingContext } from '../strategies/app-strategy.interface';

/**
 * Simple structure detection
 * Check cache first, then AI if needed
 * @param context - Optional app-specific context for neutral operation
 */
export async function getStructureConfig(cache: RobustCache, url: string, html: string, context?: AppScrapingContext): Promise<ScrapingConfig> {
  // Check robust cache first - it handles all validation internally
  const cached = cache.get(url);
  if (cached) {
    log(`[SimpleScraper] Using cached structure config for ${new URL(url).hostname}`, "scraper");
    return cached;
  }
  
  // No valid cache found, use AI to detect structure
  log(`[SimpleScraper] Running AI structure detection for ${new URL(url).hostname}`, "scraper");
  
  // Always use unified AI detection for consistent behavior
  const structure = await detectHtmlStructureWithAI(html, url);
  
  // Handle both property name formats (some AI responses use 'title' instead of 'titleSelector')
  const titleSelector = structure.titleSelector || structure.title;
  const contentSelector = structure.contentSelector || structure.content;
  const authorSelector = structure.authorSelector || structure.author;
  const dateSelector = structure.dateSelector || structure.date;
  const confidence = structure.confidence || 0.8;
  
  // Log what AI detected with validation info
  log(`[SimpleScraper] AI detected selectors:`, "scraper");
  log(`[SimpleScraper] - title: "${titleSelector}" (valid: ${!isTextContent(titleSelector)})`, "scraper");
  log(`[SimpleScraper] - content: "${contentSelector}" (valid: ${!isTextContent(contentSelector)})`, "scraper");
  log(`[SimpleScraper] - author: "${authorSelector}" (valid: ${!authorSelector || !isTextContent(authorSelector)})`, "scraper");
  log(`[SimpleScraper] - date: "${dateSelector}" (valid: ${!dateSelector || !isTextContent(dateSelector)})`, "scraper");
  log(`[SimpleScraper] - confidence: ${confidence}`, "scraper");
  
  // Convert AI result to ScrapingConfig
  const config: ScrapingConfig = {
    titleSelector,
    contentSelector,
    authorSelector,
    dateSelector,
    confidence
  };
  
  // Validate before caching
  if (!isValidConfig(config)) {
    log(`[SimpleScraper] AI returned invalid config with text content instead of selectors!`, "scraper-error");
    log(`[SimpleScraper] This indicates a problem with AI prompting or response parsing`, "scraper-error");
    
    // Create a fallback config with basic selectors
    const fallbackConfig: ScrapingConfig = {
      titleSelector: 'h1',
      contentSelector: 'article',
      authorSelector: '.author',
      dateSelector: 'time',
      confidence: 0.3
    };
    
    log(`[SimpleScraper] Using fallback config instead of invalid AI response`, "scraper");
    return fallbackConfig;
  }
  
  // Cache the result using URL (cache class handles domain extraction)
  cache.set(url, config);
  
  return config;
}

/**
 * Validate config to ensure selectors are not corrupted
 */
export function isValidConfig(config: ScrapingConfig): boolean {
  const hasValidTitle = config.titleSelector && 
                       typeof config.titleSelector === 'string' && 
                       config.titleSelector !== 'undefined' && 
                       config.titleSelector.trim().length > 0 &&
                       !isTextContent(config.titleSelector);
                       
  const hasValidContent = config.contentSelector && 
                         typeof config.contentSelector === 'string' && 
                         config.contentSelector !== 'undefined' && 
                         config.contentSelector.trim().length > 0 &&
                         !isTextContent(config.contentSelector);
  
  // Check author and date selectors if they exist
  const hasValidAuthor = !config.authorSelector || 
                        (typeof config.authorSelector === 'string' && 
                         config.authorSelector !== 'undefined' && 
                         config.authorSelector.trim().length > 0 &&
                         !isTextContent(config.authorSelector));
  
  const hasValidDate = !config.dateSelector || 
                      (typeof config.dateSelector === 'string' && 
                       config.dateSelector !== 'undefined' && 
                       config.dateSelector.trim().length > 0 &&
                       !isTextContent(config.dateSelector));
  
  return hasValidTitle && hasValidContent && hasValidAuthor && hasValidDate;
}

/**
 * Check if a selector is actually text content instead of a CSS selector
 */
function isTextContent(selector: string): boolean {
  // Check for obvious text content patterns
  const textPatterns = [
    /^By\s+/i,                    // "By Author Name"
    /^\d{1,2}\/\d{1,2}\/\d{4}/,   // Date patterns like "01/01/2025"
    /^[A-Z][a-z]+ \d{1,2}, \d{4}/i, // "January 1, 2025"
    /^Published:?\s+/i,           // "Published: Date"
    /^Written by\s+/i,            // "Written by Author"
    /^Author:?\s+/i,              // "Author: Name"
    /^\d{4}-\d{2}-\d{2}/,         // ISO date format
    /^[A-Z][a-z]+ \d{1,2}st|nd|rd|th, \d{4}/i, // "April 8th, 2025"
    /\s+\d{1,2}:\d{2}/,           // Contains time like "12:34"
    /^[A-Z][a-z]+ \d{1,2} \d{4}/i, // "April 08 2025"
  ];
  
  return textPatterns.some(pattern => pattern.test(selector.trim()));
}