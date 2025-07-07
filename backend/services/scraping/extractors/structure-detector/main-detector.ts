import { log } from "backend/utils/log";
import { detectHtmlStructure as newsRadarDetection } from 'backend/apps/news-radar/services/openai';
import { detectHtmlStructure as threatTrackerDetection } from 'backend/apps/threat-tracker/services/openai';
import { ScrapingConfig, validateSelectors } from './selector-validator';
import { sanitizeSelector } from './selector-sanitizer';
import { generateFallbackSelectors } from './fallback-selectors';

/**
 * Detect HTML structure using AI with app-specific context
 * Unified interface for both News Radar and Threat Tracker detection
 */
export async function detectHtmlStructure(html: string, url: string, context?: string): Promise<ScrapingConfig> {
  try {
    log(`[StructureDetector] Detecting HTML structure for: ${url}`, "scraper");

    // Determine which detection method to use based on context
    let detectedStructure: any;
    
    if (context?.includes('threat') || context?.includes('security') || context?.includes('cybersecurity')) {
      log(`[StructureDetector] Using Threat Tracker detection for security content`, "scraper");
      detectedStructure = await threatTrackerDetection(html, url);
    } else {
      log(`[StructureDetector] Using News Radar detection for general content`, "scraper");
      detectedStructure = await newsRadarDetection(html);
    }

    // Helper function to safely sanitize selectors, handling "null" strings from AI
    const safeSanitizeSelector = (selector: string | null | undefined): string | undefined => {
      if (!selector || selector === "null" || selector.toLowerCase() === "null") {
        return undefined;
      }
      const sanitized = sanitizeSelector(selector);
      return sanitized || undefined;
    };

    // Sanitize all detected selectors
    const sanitizedStructure: ScrapingConfig = {
      titleSelector: sanitizeSelector(detectedStructure.titleSelector || detectedStructure.title) || 'h1',
      contentSelector: sanitizeSelector(detectedStructure.contentSelector || detectedStructure.content) || 'article',
      authorSelector: safeSanitizeSelector(detectedStructure.authorSelector || detectedStructure.author),
      dateSelector: safeSanitizeSelector(detectedStructure.dateSelector || detectedStructure.date),
      articleSelector: safeSanitizeSelector(detectedStructure.articleSelector),
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
      log(`[StructureDetector] Validation failed, using fallback selectors`, "scraper");
      log(`[StructureDetector] Validation errors: ${validation.errors.join(', ')}`, "scraper-error");
      
      // Use fallback selectors
      sanitizedStructure.titleSelector = generateFallbackSelectors('title')[0];
      sanitizedStructure.contentSelector = generateFallbackSelectors('content')[0];
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