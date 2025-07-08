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
                         config.titleSelector.trim().length > 0;
                         
    const hasValidContent = config.contentSelector && 
                           typeof config.contentSelector === 'string' && 
                           config.contentSelector !== 'undefined' && 
                           config.contentSelector.trim().length > 0;
    
    return hasValidTitle && hasValidContent;
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
}