import { log } from "backend/utils/log";
import { ScrapingConfig } from '../types';

/**
 * Robust cache system with automatic validation and corruption detection
 */
export class RobustCache {
  private cache = new Map<string, ScrapingConfig>();
  
  private getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
  
  private isValidConfig(config: ScrapingConfig): boolean {
    // Check if selectors are valid strings and not undefined/null
    const hasValidTitle = config.titleSelector && 
                         typeof config.titleSelector === 'string' && 
                         config.titleSelector !== 'undefined' && 
                         config.titleSelector.trim().length > 0 &&
                         !this.isTextContent(config.titleSelector);
                         
    const hasValidContent = config.contentSelector && 
                           typeof config.contentSelector === 'string' && 
                           config.contentSelector !== 'undefined' && 
                           config.contentSelector.trim().length > 0 &&
                           !this.isTextContent(config.contentSelector);
    
    // Check author and date selectors if they exist
    const hasValidAuthor = !config.authorSelector || 
                          (typeof config.authorSelector === 'string' && 
                           config.authorSelector !== 'undefined' && 
                           config.authorSelector.trim().length > 0 &&
                           !this.isTextContent(config.authorSelector));
    
    const hasValidDate = !config.dateSelector || 
                        (typeof config.dateSelector === 'string' && 
                         config.dateSelector !== 'undefined' && 
                         config.dateSelector.trim().length > 0 &&
                         !this.isTextContent(config.dateSelector));
    
    return hasValidTitle && hasValidContent && hasValidAuthor && hasValidDate;
  }
  
  /**
   * Check if a selector is actually text content instead of a CSS selector
   */
  private isTextContent(selector: string): boolean {
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
  
  get(url: string): ScrapingConfig | null {
    const domain = this.getDomain(url);
    const cached = this.cache.get(domain);
    
    if (!cached) {
      log(`[RobustCache] No cache entry found for ${domain}`, "scraper");
      return null;
    }
    
    if (!this.isValidConfig(cached)) {
      log(`[RobustCache] Invalid cache entry detected for ${domain}, clearing`, "scraper");
      log(`[RobustCache] Invalid selectors - title: "${cached.titleSelector}", content: "${cached.contentSelector}"`, "scraper");
      this.cache.delete(domain);
      return null;
    }
    
    log(`[RobustCache] Valid cache found for ${domain}`, "scraper");
    return cached;
  }
  
  set(url: string, config: ScrapingConfig): void {
    const domain = this.getDomain(url);
    
    if (!this.isValidConfig(config)) {
      log(`[RobustCache] Refusing to cache invalid config for ${domain}`, "scraper");
      return;
    }
    
    this.cache.set(domain, config);
    log(`[RobustCache] Cached valid selectors for ${domain}`, "scraper");
  }
  
  clear(url: string): void {
    const domain = this.getDomain(url);
    this.cache.delete(domain);
    log(`[RobustCache] Cleared cache for ${domain}`, "scraper");
  }
  
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    log(`[RobustCache] Cleared all cache entries (${size} domains)`, "scraper");
  }
}