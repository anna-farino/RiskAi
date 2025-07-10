import { log } from "backend/utils/log";
import { ScrapingConfig, validateSelectors } from './selector-validator';
import { sanitizeSelector } from './selector-sanitizer';
import { generateFallbackSelectors } from './fallback-selectors';
import { detectHtmlStructureWithAI } from './ai-detector';

/**
 * Detect HTML structure using unified AI detection
 * This is the main entry point for all HTML structure detection
 */
export async function detectHtmlStructure(html: string, url: string): Promise<ScrapingConfig> {
  try {
    log(`[StructureDetector] Detecting HTML structure for: ${url}`, "scraper");

    // Always use unified AI detection for HTML structure detection
    // This ensures consistent behavior across all apps
    let detectedStructure: any;
    
    log(`[StructureDetector] Using unified AI detection (app-agnostic)`, "scraper");
    detectedStructure = await detectHtmlStructureWithAI(html, url);

    // Log raw AI response before sanitization
    log(`[StructureDetector] Raw AI response:`, "scraper");
    log(`[StructureDetector] - titleSelector: "${detectedStructure.titleSelector || detectedStructure.title}"`, "scraper");
    log(`[StructureDetector] - contentSelector: "${detectedStructure.contentSelector || detectedStructure.content}"`, "scraper");
    log(`[StructureDetector] - authorSelector: "${detectedStructure.authorSelector || detectedStructure.author}"`, "scraper");
    log(`[StructureDetector] - dateSelector: "${detectedStructure.dateSelector || detectedStructure.date}"`, "scraper");

    // Sanitize all detected selectors
    const sanitizedStructure: ScrapingConfig = {
      titleSelector: sanitizeSelector(detectedStructure.titleSelector || detectedStructure.title) || 'h1',
      contentSelector: sanitizeSelector(detectedStructure.contentSelector || detectedStructure.content) || 'article',
      authorSelector: detectedStructure.authorSelector || detectedStructure.author ? 
        sanitizeSelector(detectedStructure.authorSelector || detectedStructure.author) : undefined,
      dateSelector: detectedStructure.dateSelector || detectedStructure.date ? 
        sanitizeSelector(detectedStructure.dateSelector || detectedStructure.date) : undefined,
      articleSelector: detectedStructure.articleSelector ? 
        sanitizeSelector(detectedStructure.articleSelector) : undefined,
      confidence: 0.8, // Default confidence for AI detection
      alternatives: {
        titleSelector: generateFallbackSelectors('title')[0],
        contentSelector: generateFallbackSelectors('content')[0]
      }
    };

    // Validate the detected structure
    const validation = validateSelectors(sanitizedStructure, html);
    sanitizedStructure.confidence = validation.confidence;

    if (!validation.isValid) {
      log(`[StructureDetector] Validation failed, using selective fallback selectors`, "scraper");
      log(`[StructureDetector] Validation errors: ${validation.errors.join(', ')}`, "scraper-error");
      
      // Only replace selectors that are actually broken, preserve working ones
      if (!sanitizedStructure.titleSelector || sanitizedStructure.titleSelector.trim() === '') {
        sanitizedStructure.titleSelector = generateFallbackSelectors('title')[0];
        log(`[StructureDetector] Using fallback title selector: ${sanitizedStructure.titleSelector}`, "scraper");
      }
      
      if (!sanitizedStructure.contentSelector || sanitizedStructure.contentSelector.trim() === '') {
        const contentFallbacks = generateFallbackSelectors('content');
        sanitizedStructure.contentSelector = contentFallbacks[0];
        log(`[StructureDetector] Using fallback content selector: ${sanitizedStructure.contentSelector}`, "scraper");
        
        // Store additional fallbacks for recovery
        sanitizedStructure.alternatives = sanitizedStructure.alternatives || {};
        sanitizedStructure.alternatives.contentSelector = contentFallbacks[1];
        sanitizedStructure.alternatives.contentSelectorList = contentFallbacks.slice(0, 5); // Store first 5 fallbacks
      }
      
      // Preserve working date and author selectors
      log(`[StructureDetector] Preserving working selectors - date: "${sanitizedStructure.dateSelector}", author: "${sanitizedStructure.authorSelector}"`, "scraper");
      
      sanitizedStructure.confidence = 0.5;
    }

    if (validation.warnings.length > 0) {
      log(`[StructureDetector] Validation warnings: ${validation.warnings.join(', ')}`, "scraper");
    }

    log(`[StructureDetector] Structure detection completed with confidence: ${sanitizedStructure.confidence}`, "scraper");
    return sanitizedStructure;

  } catch (error: any) {
    log(`[StructureDetector] Error detecting HTML structure: ${error.message}`, "scraper-error");
    
    // Return fallback structure
    const fallbackStructure: ScrapingConfig = {
      titleSelector: 'h1',
      contentSelector: 'article',
      authorSelector: '.author',
      dateSelector: 'time',
      confidence: 0.3,
      alternatives: {
        titleSelector: '.article-title',
        contentSelector: '.article-content'
      }
    };

    log(`[StructureDetector] Using fallback structure with confidence: ${fallbackStructure.confidence}`, "scraper");
    return fallbackStructure;
  }
}

/**
 * Convert unified AI structure result to ScrapingConfig format
 */
export function convertAIStructureToScrapingConfig(aiResult: any): ScrapingConfig {
  return {
    titleSelector: aiResult.titleSelector,
    contentSelector: aiResult.contentSelector,
    authorSelector: aiResult.authorSelector,
    dateSelector: aiResult.dateSelector,
    articleSelector: aiResult.articleSelector,
    confidence: aiResult.confidence,
    alternatives: {
      dateSelector: aiResult.dateAlternatives?.[0],
      titleSelector: generateFallbackSelectors('title')[0],
      contentSelector: generateFallbackSelectors('content')[0],
      authorSelector: generateFallbackSelectors('author')[0]
    }
  };
}

/**
 * Enhance scraping config with comprehensive fallback selectors
 */
export function enhanceConfigWithFallbacks(config: ScrapingConfig): void {
  const titleFallbacks = generateFallbackSelectors('title');
  const contentFallbacks = generateFallbackSelectors('content');
  
  config.alternatives = {
    titleSelector: titleFallbacks[1] || titleFallbacks[0],
    contentSelector: contentFallbacks[1] || contentFallbacks[0],
    authorSelector: generateFallbackSelectors('author')[0],
    dateSelector: generateFallbackSelectors('date')[0]
  };
}