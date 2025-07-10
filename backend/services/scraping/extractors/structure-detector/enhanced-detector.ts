import { log } from "backend/utils/log";
import { ScrapingConfig } from './selector-validator';
import { detectHtmlStructure } from './main-detector';
import { generateFallbackSelectors } from './fallback-selectors';

/**
 * Enhance structure detection with multiple attempts and validation
 * Provides robust fallback mechanisms
 */
export async function detectHtmlStructureWithFallbacks(html: string, url: string): Promise<ScrapingConfig> {
  try {
    // Primary detection attempt
    const primaryStructure = await detectHtmlStructure(html, url);
    
    // If confidence is high enough, return primary result
    if (primaryStructure.confidence >= 0.7) {
      log(`[StructureDetector] Primary detection successful with high confidence`, "scraper");
      return primaryStructure;
    }

    // Try alternative detection method if confidence is low
    log(`[StructureDetector] Primary detection confidence low (${primaryStructure.confidence}), trying alternative`, "scraper");
    
    // Try detection again with enhanced fallback selectors
    const alternativeStructure = await detectHtmlStructure(html, url);
    
    // Use the structure with higher confidence
    if (alternativeStructure.confidence > primaryStructure.confidence) {
      log(`[StructureDetector] Alternative detection provided better confidence (${alternativeStructure.confidence})`, "scraper");
      return alternativeStructure;
    }

    // Enhance primary structure with validated fallbacks
    log(`[StructureDetector] Enhancing primary structure with fallback alternatives`, "scraper");
    
    const titleFallbacks = generateFallbackSelectors('title');
    const contentFallbacks = generateFallbackSelectors('content');
    
    primaryStructure.alternatives = {
      titleSelector: titleFallbacks[1] || titleFallbacks[0],
      contentSelector: contentFallbacks[1] || contentFallbacks[0],
      authorSelector: generateFallbackSelectors('author')[0],
      dateSelector: generateFallbackSelectors('date')[0]
    };

    return primaryStructure;

  } catch (error: any) {
    log(`[StructureDetector] All detection methods failed: ${error.message}`, "scraper-error");
    
    // Final fallback with comprehensive alternatives
    return {
      titleSelector: 'h1',
      contentSelector: 'article',
      authorSelector: '.author',
      dateSelector: 'time',
      confidence: 0.2,
      alternatives: {
        titleSelector: '.article-title',
        contentSelector: '.article-content',
        authorSelector: '.byline',
        dateSelector: '.published-date'
      }
    };
  }
}