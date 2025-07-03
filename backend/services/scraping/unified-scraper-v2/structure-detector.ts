import { log } from "backend/utils/log";
import { ScrapingConfig } from '../extractors/structure-detector';
import { detectHtmlStructureWithAI } from '../ai/structure-detector';
import { RobustCache } from './cache-system';

/**
 * Simple structure detection
 * Check cache first, then AI if needed
 */
export async function getStructureConfig(cache: RobustCache, url: string, html: string): Promise<ScrapingConfig> {
  // Check robust cache first - it handles all validation internally
  const cached = cache.get(url);
  if (cached) {
    return cached;
  }
  
  // No valid cache found, use AI to detect structure
  log(`[SimpleScraper] Running AI structure detection`, "scraper");
  const structure = await detectHtmlStructureWithAI(html, url);
  
  // Log what AI detected
  log(`[SimpleScraper] AI detected selectors - title: ${structure.titleSelector}, content: ${structure.contentSelector}, author: ${structure.authorSelector}, confidence: ${structure.confidence}`, "scraper");
  
  // Convert AI result to ScrapingConfig
  const config: ScrapingConfig = {
    titleSelector: structure.titleSelector,
    contentSelector: structure.contentSelector,
    authorSelector: structure.authorSelector,
    dateSelector: structure.dateSelector,
    confidence: structure.confidence
  };
  
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
                       config.titleSelector.trim().length > 0;
                       
  const hasValidContent = config.contentSelector && 
                         typeof config.contentSelector === 'string' && 
                         config.contentSelector !== 'undefined' && 
                         config.contentSelector.trim().length > 0;
  
  return hasValidTitle && hasValidContent;
}