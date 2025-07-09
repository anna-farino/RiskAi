import { log } from "backend/utils/log";
import { ScrapingConfig, ArticleContent } from '../types';
import * as cheerio from 'cheerio';
import { sanitizeSelector } from '../extractors/structure-detector/selector-sanitizer';



/**
 * Enhanced content extraction with comprehensive recovery
 * Use selectors to extract content directly with fallback recovery
 */
export function extractContentWithSelectors(html: string, config: ScrapingConfig): Partial<ArticleContent> {
  const $ = cheerio.load(html);
  
  const result: Partial<ArticleContent> = {
    extractionMethod: "selectors",
    confidence: 0.9
  };

  log(`[SimpleScraper] Extracting content using selectors - title: "${config.titleSelector}", content: "${config.contentSelector}"`, "scraper");

  // Phase 1: Detailed selector debugging
  debugSelectorUsage($, config);

  // Extract title with recovery
  if (config.titleSelector) {
    const sanitizedSelector = sanitizeSelector(config.titleSelector);
    if (sanitizedSelector) {
      result.title = extractWithRecovery($, sanitizedSelector, 'title');
      log(`[SimpleScraper] Title extracted: "${result.title}" (${result.title?.length || 0} chars)`, "scraper");
    }
  }

  // Extract content with comprehensive recovery
  if (config.contentSelector) {
    const sanitizedConfig = {
      ...config,
      contentSelector: sanitizeSelector(config.contentSelector) || config.contentSelector
    };
    const contentResult = extractContentWithRecovery($, sanitizedConfig, html);
    result.content = contentResult.content;
    result.confidence = Math.min(result.confidence || 0.9, contentResult.confidence);
    log(`[SimpleScraper] Content extracted: ${result.content?.length || 0} chars (confidence: ${result.confidence})`, "scraper");
  }

  // Extract author with recovery
  if (config.authorSelector) {
    const sanitizedSelector = sanitizeSelector(config.authorSelector);
    if (sanitizedSelector) {
      result.author = extractWithRecovery($, sanitizedSelector, 'author');
      log(`[SimpleScraper] Author extracted: "${result.author}"`, "scraper");
    }
  } else {
    // Try fallback author extraction when no selector provided
    result.author = extractWithRecovery($, '', 'author');
    if (result.author) {
      log(`[SimpleScraper] Author extracted with fallback: "${result.author}"`, "scraper");
    }
  }

  return result;
}

/**
 * Phase 1: Debug selector usage with comprehensive logging
 */
function debugSelectorUsage($: cheerio.CheerioAPI, config: ScrapingConfig): void {
  log(`[SelectorDebug] === SELECTOR DEBUGGING START ===`, "scraper");
  
  // Debug each selector type, including missing ones
  ['titleSelector', 'contentSelector', 'authorSelector', 'dateSelector'].forEach(selectorType => {
    const rawSelector = config[selectorType as keyof ScrapingConfig] as string;
    
    if (rawSelector && typeof rawSelector === 'string') {
      // Sanitize selector before using it
      const selector = sanitizeSelector(rawSelector);
      
      if (!selector) {
        log(`[SelectorDebug] ${selectorType}: "${rawSelector}" → REJECTED during sanitization`, "scraper");
        return;
      }
      
      try {
        const elements = $(selector);
        log(`[SelectorDebug] ${selectorType}: "${selector}" → ${elements.length} elements found`, "scraper");
        
        if (elements.length > 0) {
          // Log first element details
          const firstEl = elements.first();
          const tagName = firstEl.prop('tagName')?.toLowerCase();
          const classes = firstEl.attr('class');
          const textPreview = firstEl.text().trim().substring(0, 100);
          log(`[SelectorDebug] First element: <${tagName}> classes="${classes}" text="${textPreview}..."`, "scraper");
        } else {
          // Debug why selector failed
          debugSelectorFailure($, selector, selectorType);
        }
      } catch (error) {
        log(`[SelectorDebug] Invalid selector "${selector}" for ${selectorType}: ${error.message}`, "scraper-error");
      }
    } else {
      // Log missing selectors
      log(`[SelectorDebug] ${selectorType}: NOT PROVIDED by AI detection`, "scraper");
    }
  });
  
  log(`[SelectorDebug] === SELECTOR DEBUGGING END ===`, "scraper");
}

/**
 * Phase 1: Debug why a selector failed to find elements
 */
function debugSelectorFailure($: cheerio.CheerioAPI, selector: string, selectorType: string): void {
  log(`[SelectorDebug] Analyzing failed selector: ${selector}`, "scraper");
  
  // Try variations of the selector
  const variations = generateSelectorVariations(selector);
  let foundWorking = false;
  
  for (const variation of variations) {
    try {
      const elements = $(variation);
      if (elements.length > 0) {
        log(`[SelectorDebug] Working variation found: "${variation}" → ${elements.length} elements`, "scraper");
        foundWorking = true;
        break;
      }
    } catch (error) {
      log(`[SelectorDebug] Invalid selector variation "${variation}": ${error.message}`, "scraper");
      // Continue to next variation
    }
  }
  
  if (!foundWorking) {
    // Try class-based search
    if (selector.includes('.')) {
      const className = selector.replace(/^.*\.([^.\s>]+).*$/, '$1');
      const classElements = $(`[class*="${className}"]`);
      log(`[SelectorDebug] Class-based search for "${className}": ${classElements.length} elements`, "scraper");
      
      if (classElements.length > 0) {
        classElements.each((i, el) => {
          if (i < 3) { // Log first 3 matches
            const $el = $(el);
            log(`[SelectorDebug] Found element with class containing "${className}": <${$el.prop('tagName')?.toLowerCase()}> class="${$el.attr('class')}"`, "scraper");
          }
        });
      }
    }
  }
}

/**
 * Phase 2: Generate selector variations for recovery
 */
export function generateSelectorVariations(selector: string): string[] {
  const variations: string[] = [];
  
  // Original selector
  variations.push(selector);
  
  // Underscore ↔ hyphen variations
  if (selector.includes('_')) {
    variations.push(selector.replace(/_/g, '-'));
  }
  if (selector.includes('-')) {
    variations.push(selector.replace(/-/g, '_'));
  }
  
  // Class attribute variations
  if (selector.startsWith('.')) {
    const className = selector.substring(1);
    variations.push(`[class="${className}"]`);
    variations.push(`[class*="${className}"]`);
    variations.push(`[class^="${className}"]`);
    variations.push(`[class$="${className}"]`);
  }
  
  // Remove pseudo-selectors if present
  const withoutPseudo = selector.replace(/:[\w-]+(\([^)]*\))?/g, '');
  if (withoutPseudo !== selector) {
    variations.push(withoutPseudo);
  }
  
  // Descendant to direct child (only if not already using >)
  if (selector.includes(' ') && !selector.includes('>')) {
    variations.push(selector.replace(/\s+/g, ' > '));
  }
  
  // Direct child to descendant (only if using >)
  if (selector.includes(' > ')) {
    variations.push(selector.replace(/\s*>\s*/g, ' '));
  }
  
  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Phase 2: Extract content with comprehensive recovery system
 */
function extractContentWithRecovery($: cheerio.CheerioAPI, config: ScrapingConfig, html: string): { content: string; confidence: number } {
  // Phase 3: Pre-extraction validation
  let contentElements;
  try {
    contentElements = $(config.contentSelector!);
  } catch (error) {
    log(`[ContentRecovery] Invalid content selector "${config.contentSelector}", initiating recovery: ${error.message}`, "scraper-error");
    return recoverContentExtraction($, config, html);
  }
  
  if (contentElements.length === 0) {
    log(`[ContentRecovery] No elements found with primary selector, initiating recovery`, "scraper");
    return recoverContentExtraction($, config, html);
  }
  
  // Extract content from found elements
  const content = contentElements.map((_, el) => $(el).text()).get().join('\n').trim();
  
  if (content.length < 100) {
    log(`[ContentRecovery] Insufficient content (${content.length} chars), initiating recovery`, "scraper");
    return recoverContentExtraction($, config, html);
  }
  
  // Verify content quality
  if (isLowQualityContent(content)) {
    log(`[ContentRecovery] Low quality content detected, initiating recovery`, "scraper");
    return recoverContentExtraction($, config, html);
  }
  
  return { content, confidence: 0.9 };
}

/**
 * Phase 2: Content recovery system
 */
function recoverContentExtraction($: cheerio.CheerioAPI, config: ScrapingConfig, html: string): { content: string; confidence: number } {
  log(`[ContentRecovery] Starting content recovery process`, "scraper");
  
  // Step 1: Try selector variations
  const variations = generateSelectorVariations(config.contentSelector!);
  
  for (const variation of variations) {
    const elements = $(variation);
    if (elements.length > 0) {
      const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
      if (content.length >= 100 && !isLowQualityContent(content)) {
        log(`[ContentRecovery] Successful recovery with variation: "${variation}" (${content.length} chars)`, "scraper");
        return { content, confidence: 0.7 };
      }
    }
  }
  
  // Step 2: Try similar class patterns
  if (config.contentSelector!.includes('.')) {
    const baseClass = config.contentSelector!.replace(/^.*\.([^.\s>]+).*$/, '$1');
    const similarElements = $(`[class*="${baseClass}"]`);
    
    if (similarElements.length > 0) {
      const content = similarElements.map((_, el) => $(el).text()).get().join('\n').trim();
      if (content.length >= 100 && !isLowQualityContent(content)) {
        log(`[ContentRecovery] Successful recovery with similar class pattern (${content.length} chars)`, "scraper");
        return { content, confidence: 0.6 };
      }
    }
  }
  
  // Step 3: Try article-related fallbacks
  const fallbackSelectors = [
    'article',
    '.article-content',
    '.post-content',
    '.content',
    'main',
    '.main-content',
    '[role="main"]'
  ];
  
  for (const fallback of fallbackSelectors) {
    const elements = $(fallback);
    if (elements.length > 0) {
      const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
      if (content.length >= 200 && !isLowQualityContent(content)) {
        log(`[ContentRecovery] Successful recovery with fallback: "${fallback}" (${content.length} chars)`, "scraper");
        return { content, confidence: 0.5 };
      }
    }
  }
  
  // Step 4: Last resort - return whatever we can find
  const bodyContent = $('body').text().trim();
  log(`[ContentRecovery] Final fallback to body content (${bodyContent.length} chars)`, "scraper");
  return { content: bodyContent, confidence: 0.3 };
}

/**
 * Phase 2: Extract with recovery for title/author fields
 */
function extractWithRecovery($: cheerio.CheerioAPI, selector: string, fieldType: string): string {
  // Try primary selector if provided
  let result = '';
  if (selector) {
    try {
      result = $(selector).first().text().trim();
      
      // Validate result based on field type
      if (result && fieldType === 'author') {
        // Filter out contact information mistakenly identified as author
        if (/^(CONTACT|CONTACTS:|FOR MORE INFORMATION|PRESS CONTACT|MEDIA CONTACT)/i.test(result)) {
          log(`[${fieldType}Recovery] Rejected contact info as author: "${result}"`, "scraper");
          result = '';
        }
        // Also check if it looks like a date instead of an author
        if (/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|\d{1,2},?\s*\d{4}|\d{1,2}:\d{2}\s*(AM|PM))/i.test(result)) {
          log(`[${fieldType}Recovery] Rejected date-like text as author: "${result}"`, "scraper");
          result = '';
        }
      }
      
      if (result) return result;
    } catch (error) {
      log(`[${fieldType}Recovery] Invalid primary selector "${selector}": ${error.message}`, "scraper-error");
    }
    
    // Try variations of the provided selector
    const variations = generateSelectorVariations(selector);
    for (const variation of variations) {
      try {
        result = $(variation).first().text().trim();
        
        // Validate result based on field type
        if (result && fieldType === 'author') {
          if (/^(CONTACT|CONTACTS:|FOR MORE INFORMATION|PRESS CONTACT|MEDIA CONTACT)/i.test(result)) {
            log(`[${fieldType}Recovery] Rejected contact info as author from variation: "${result}"`, "scraper");
            continue;
          }
          // Also check if it looks like a date instead of an author
          if (/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|\d{1,2},?\s*\d{4}|\d{1,2}:\d{2}\s*(AM|PM))/i.test(result)) {
            log(`[${fieldType}Recovery] Rejected date-like text as author: "${result}"`, "scraper");
            continue;
          }
        }
        
        if (result) {
          log(`[${fieldType}Recovery] Found using variation: "${variation}"`, "scraper");
          return result;
        }
      } catch (error) {
        log(`[${fieldType}Recovery] Invalid variation "${variation}": ${error.message}`, "scraper");
        // Continue to next variation
      }
    }
  }
  
  // Always try field-specific fallbacks
  const fallbacks = getFieldFallbacks(fieldType);
  for (const fallback of fallbacks) {
    try {
      result = $(fallback).first().text().trim();
      
      // Validate result based on field type
      if (result && fieldType === 'author') {
        if (/^(CONTACT|CONTACTS:|FOR MORE INFORMATION|PRESS CONTACT|MEDIA CONTACT)/i.test(result)) {
          log(`[${fieldType}Recovery] Rejected contact info as author from fallback: "${result}"`, "scraper");
          continue;
        }
        
        // Additional validation: ensure it looks like a person's name
        if (result.length < 3 || result.length > 50 || !/[a-zA-Z]/.test(result)) {
          log(`[${fieldType}Recovery] Rejected invalid author name: "${result}"`, "scraper");
          continue;
        }
        // Also check if it looks like a date instead of an author
        if (/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|\d{1,2},?\s*\d{4}|\d{1,2}:\d{2}\s*(AM|PM))/i.test(result)) {
          log(`[${fieldType}Recovery] Rejected date-like text as author: "${result}"`, "scraper");
          continue;
        }
      }
      
      if (result) {
        log(`[${fieldType}Recovery] Found using fallback: "${fallback}"`, "scraper");
        return result;
      }
    } catch (error) {
      log(`[${fieldType}Recovery] Invalid fallback "${fallback}": ${error.message}`, "scraper");
      // Continue to next fallback
    }
  }
  
  return '';
}

/**
 * Phase 3: Get field-specific fallback selectors
 */
function getFieldFallbacks(fieldType: string): string[] {
  const fallbacks = {
    title: ['h1', 'h2', '.title', '.headline', '[role="heading"]', '.article-title', '.post-title'],
    author: ['.author', '.byline', '[rel="author"]', '.writer', '.by', '.journalist', '.article-author', '.post-author', '.author-name'],
    date: ['time', '[datetime]', '.date', '.published', '.article-date', '.post-date', '.timestamp', '.publish-date', '.creation-date']
  };
  
  return fallbacks[fieldType as keyof typeof fallbacks] || [];
}

/**
 * Phase 3: Check if content is low quality (navigation, ads, etc.)
 */
export function isLowQualityContent(content: string): boolean {
  if (!content || content.length < 50) {
    return true; // Too short to be meaningful content
  }
  
  const trimmedContent = content.trim();
  
  // Check for navigation/menu patterns only at the beginning
  const navigationPatterns = [
    /^(menu|navigation|nav|sidebar|footer|header|advertisement|ad|cookie|privacy|terms|home|about|contact|login|register|subscribe|newsletter)(\s|$)/i,
  ];
  
  // Check for repeated very short phrases (like "more more more")
  const repeatedShortPhrases = /^(.{1,5}\s*)\1{3,}$/;
  
  // Check for content that's mostly punctuation or special characters
  const mostlyNonContent = /^[^a-zA-Z0-9]*$/;
  
  return navigationPatterns.some(pattern => pattern.test(trimmedContent)) ||
         repeatedShortPhrases.test(trimmedContent) ||
         mostlyNonContent.test(trimmedContent);
}

/**
 * Extract content from Puppeteer's structured HTML format
 * Puppeteer returns pre-extracted content wrapped in simple HTML structure
 */
export function extractFromPuppeteerHTML(html: string): Partial<ArticleContent> {
  const $ = cheerio.load(html);
  
  return {
    title: $('h1').text().trim(),
    content: $('.content').text().trim(),
    author: $('.author').text().trim() || undefined,
    publishDate: $('.date').text().trim() ? new Date($('.date').text().trim()) : undefined,
    extractionMethod: 'puppeteer',
    confidence: 0.9
  };
}