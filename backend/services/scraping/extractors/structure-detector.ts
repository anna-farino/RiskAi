import { log } from "backend/utils/log";
import { detectHtmlStructure as newsRadarDetection } from 'backend/apps/news-radar/services/openai';
import { detectHtmlStructure as threatTrackerDetection } from 'backend/apps/threat-tracker/services/openai';
import { detectHtmlStructureWithAI, AIStructureResult } from '../ai/structure-detector';

export interface ScrapingConfig {
  titleSelector: string;
  contentSelector: string;
  authorSelector?: string;
  dateSelector?: string;
  articleSelector?: string;
  confidence: number;
  alternatives?: Partial<ScrapingConfig>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

/**
 * Sanitize CSS selectors to prevent invalid pseudo-selectors
 * Consolidates sanitization logic from Threat Tracker
 */
export function sanitizeSelector(selector: string): string {
  if (!selector) return "";

  // Check if the selector contains date-like patterns (months, parentheses with timezones, etc.)
  if (
    /^(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\(EDT\)|\(EST\)|\(PDT\)|\(PST\))/i.test(
      selector,
    ) ||
    selector.includes("AM") ||
    selector.includes("PM") ||
    selector.includes("(") ||
    selector.includes(")")
  ) {
    // This is likely a date string, not a CSS selector
    log(`[StructureDetector] Rejected date-like selector: ${selector}`, "scraper");
    return "";
  }

  // Check if the selector starts with words that suggest it's not a CSS selector
  if (
    /^(By|Published:|Posted:|Date:|Author:|Not available)\s?/i.test(selector)
  ) {
    // This is likely text content, not a CSS selector
    log(`[StructureDetector] Rejected text-like selector: ${selector}`, "scraper");
    return "";
  }

  // Remove unsupported pseudo-classes like :contains, :has, etc.
  const sanitized = selector
    // Remove :contains(...) pseudo-class
    .replace(/\:contains\([^\)]+\)/g, "")
    // Remove :has(...) pseudo-class
    .replace(/\:has\([^\)]+\)/g, "")
    // Remove other non-standard pseudo-classes
    .replace(/\:[^(\s|:|>|\.|\[)]+(?=[\s,\]]|$)/g, "")
    // Clean up any resulting double spaces
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized !== selector) {
    log(`[StructureDetector] Sanitized selector from "${selector}" to "${sanitized}"`, "scraper");
  }

  return sanitized;
}

/**
 * Generate fallback selectors for common elements
 * Based on fallback hierarchies from both apps
 */
export function generateFallbackSelectors(elementType: 'title' | 'content' | 'author' | 'date'): string[] {
  const fallbacks = {
    title: [
      'h1',
      '.article-title',
      '.post-title',
      '.headline',
      '.title',
      'h1.title',
      'h1.headline',
      '.entry-title'
    ],
    content: [
      'article',
      '.article-content',
      '.article-body',
      'main .content',
      '.post-content',
      '#article-content',
      '.story-content',
      '.entry-content',
      'main',
      '.main-content',
      '#main-content'
    ],
    author: [
      '.author',
      '.byline',
      '.article-author',
      '.post-author',
      '.writer',
      '.by-author',
      '[rel="author"]'
    ],
    date: [
      'time',
      '[datetime]',
      '.article-date',
      '.post-date',
      '.published-date',
      '.timestamp',
      '.date',
      '.publish-date',
      '.created-date'
    ]
  };

  return fallbacks[elementType] || [];
}

/**
 * Validate CSS selectors against common issues
 * Enhanced validation based on patterns from both apps
 */
export function validateSelectors(config: ScrapingConfig, html?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidence = 1.0;

  // Validate title selector
  if (!config.titleSelector) {
    errors.push("Title selector is required");
    confidence -= 0.3;
  } else {
    const sanitizedTitle = sanitizeSelector(config.titleSelector);
    if (!sanitizedTitle) {
      errors.push(`Invalid title selector: ${config.titleSelector}`);
      confidence -= 0.3;
    }
  }

  // Validate content selector
  if (!config.contentSelector) {
    errors.push("Content selector is required");
    confidence -= 0.4;
  } else {
    const sanitizedContent = sanitizeSelector(config.contentSelector);
    if (!sanitizedContent) {
      errors.push(`Invalid content selector: ${config.contentSelector}`);
      confidence -= 0.4;
    }
  }

  // Validate optional selectors
  if (config.authorSelector) {
    const sanitizedAuthor = sanitizeSelector(config.authorSelector);
    if (!sanitizedAuthor) {
      warnings.push(`Invalid author selector: ${config.authorSelector}`);
      confidence -= 0.1;
    }
  }

  if (config.dateSelector) {
    const sanitizedDate = sanitizeSelector(config.dateSelector);
    if (!sanitizedDate) {
      warnings.push(`Invalid date selector: ${config.dateSelector}`);
      confidence -= 0.1;
    }
  }

  // Check for overly broad selectors
  const broadSelectors = ['body', 'html', 'div', 'span', 'p'];
  [config.titleSelector, config.contentSelector].forEach(selector => {
    if (selector && broadSelectors.includes(selector.toLowerCase())) {
      warnings.push(`Selector "${selector}" is too broad and may return incorrect content`);
      confidence -= 0.2;
    }
  });

  // If HTML provided, test selectors
  if (html) {
    try {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      // Test title selector
      if (config.titleSelector) {
        const titleElements = $(sanitizeSelector(config.titleSelector));
        if (titleElements.length === 0) {
          warnings.push(`Title selector "${config.titleSelector}" matches no elements`);
          confidence -= 0.2;
        } else if (titleElements.length > 3) {
          warnings.push(`Title selector "${config.titleSelector}" matches ${titleElements.length} elements (may be too broad)`);
          confidence -= 0.1;
        }
      }

      // Test content selector
      if (config.contentSelector) {
        const contentElements = $(sanitizeSelector(config.contentSelector));
        if (contentElements.length === 0) {
          warnings.push(`Content selector "${config.contentSelector}" matches no elements`);
          confidence -= 0.3;
        }
      }
    } catch (error) {
      warnings.push(`Could not validate selectors against HTML: ${error}`);
      confidence -= 0.1;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidence: Math.max(0, confidence)
  };
}

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
 * Enhance structure detection with multiple attempts and validation
 * Provides robust fallback mechanisms
 */
export async function detectHtmlStructureWithFallbacks(html: string, url: string, context?: string): Promise<ScrapingConfig> {
  try {
    // Primary detection attempt
    const primaryStructure = await detectHtmlStructure(html, url, context);
    
    // If confidence is high enough, return primary result
    if (primaryStructure.confidence >= 0.7) {
      log(`[StructureDetector] Primary detection successful with high confidence`, "scraper");
      return primaryStructure;
    }

    // Try alternative detection method if confidence is low
    log(`[StructureDetector] Primary detection confidence low (${primaryStructure.confidence}), trying alternative`, "scraper");
    
    const alternativeContext = context?.includes('threat') ? undefined : 'cybersecurity threat intelligence';
    const alternativeStructure = await detectHtmlStructure(html, url, alternativeContext);
    
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