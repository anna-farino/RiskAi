import { log } from "backend/utils/log";
import { detectHtmlStructure as newsRadarDetection } from 'backend/apps/news-radar/services/openai';
import { detectHtmlStructure as threatTrackerDetection } from 'backend/apps/threat-tracker/services/openai';
import { ScrapingConfig, validateSelectors } from './selector-validator';
import { sanitizeSelector } from './selector-sanitizer';
import { generateFallbackSelectors } from './fallback-selectors';
import { AppScrapingContext } from '../../strategies/app-strategy.interface';

/**
 * Detect HTML structure using AI with app-specific context
 * Unified interface for app-neutral detection
 * @param appContext - Optional app-specific context for neutral operation
 */
export async function detectHtmlStructure(html: string, url: string, context?: string, appContext?: AppScrapingContext): Promise<ScrapingConfig> {
  try {
    log(`[StructureDetector] Detecting HTML structure for: ${url}`, "scraper");

    // Determine which detection method to use
    let detectedStructure: any;
    
    // Use app-specific detection if provided
    if (appContext?.aiProviders?.detectHtmlStructure) {
      log(`[StructureDetector] Using app-specific detection for ${appContext.appType}`, "scraper");
      detectedStructure = await appContext.aiProviders.detectHtmlStructure(html, url);
    } 
    // Backward compatibility: use context-based routing
    else if (context?.includes('threat') || context?.includes('security') || context?.includes('cybersecurity')) {
      log(`[StructureDetector] Using Threat Tracker detection for security content (deprecated path)`, "scraper");
      detectedStructure = await threatTrackerDetection(html, url);
    } else {
      log(`[StructureDetector] Using News Radar detection for general content (deprecated path)`, "scraper");
      detectedStructure = await newsRadarDetection(html);
    }

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