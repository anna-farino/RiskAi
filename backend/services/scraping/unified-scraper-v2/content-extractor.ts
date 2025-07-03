import { log } from "backend/utils/log";
import { ScrapingConfig } from '../extractors/structure-detector';
import * as cheerio from 'cheerio';

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date;
  extractionMethod: string;
  confidence: number;
}

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
    result.title = extractWithRecovery($, config.titleSelector, 'title');
    log(`[SimpleScraper] Title extracted: "${result.title}" (${result.title?.length || 0} chars)`, "scraper");
  }

  // Extract content with comprehensive recovery
  if (config.contentSelector) {
    const contentResult = extractContentWithRecovery($, config, html);
    result.content = contentResult.content;
    result.confidence = Math.min(result.confidence || 0.9, contentResult.confidence);
    log(`[SimpleScraper] Content extracted: ${result.content?.length || 0} chars (confidence: ${result.confidence})`, "scraper");
  }

  // Extract author with recovery
  if (config.authorSelector) {
    result.author = extractWithRecovery($, config.authorSelector, 'author');
    log(`[SimpleScraper] Author extracted: "${result.author}"`, "scraper");
  }

  return result;
}

/**
 * Phase 1: Debug selector usage with comprehensive logging
 */
function debugSelectorUsage($: cheerio.CheerioAPI, config: ScrapingConfig): void {
  log(`[SelectorDebug] === SELECTOR DEBUGGING START ===`, "scraper");
  
  // Debug each selector
  ['titleSelector', 'contentSelector', 'authorSelector', 'dateSelector'].forEach(selectorType => {
    const selector = config[selectorType as keyof ScrapingConfig] as string;
    if (selector && typeof selector === 'string') {
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
    const elements = $(variation);
    if (elements.length > 0) {
      log(`[SelectorDebug] Working variation found: "${variation}" → ${elements.length} elements`, "scraper");
      foundWorking = true;
      break;
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
  
  // Descendant to direct child
  if (selector.includes(' ')) {
    variations.push(selector.replace(/\s+/g, ' > '));
  }
  
  // Direct child to descendant
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
  const contentElements = $(config.contentSelector!);
  
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
  // Try primary selector
  let result = $(selector).first().text().trim();
  if (result) return result;
  
  // Try variations
  const variations = generateSelectorVariations(selector);
  for (const variation of variations) {
    result = $(variation).first().text().trim();
    if (result) {
      log(`[${fieldType}Recovery] Found using variation: "${variation}"`, "scraper");
      return result;
    }
  }
  
  // Field-specific fallbacks
  const fallbacks = getFieldFallbacks(fieldType);
  for (const fallback of fallbacks) {
    result = $(fallback).first().text().trim();
    if (result) {
      log(`[${fieldType}Recovery] Found using fallback: "${fallback}"`, "scraper");
      return result;
    }
  }
  
  return '';
}

/**
 * Phase 3: Get field-specific fallback selectors
 */
function getFieldFallbacks(fieldType: string): string[] {
  const fallbacks = {
    title: ['h1', 'h2', '.title', '.headline', '[role="heading"]'],
    author: ['.author', '.byline', '[rel="author"]', '.writer'],
    date: ['time', '[datetime]', '.date', '.published']
  };
  
  return fallbacks[fieldType as keyof typeof fallbacks] || [];
}

/**
 * Phase 3: Check if content is low quality (navigation, ads, etc.)
 */
export function isLowQualityContent(content: string): boolean {
  const lowQualityPatterns = [
    /^(menu|navigation|nav|sidebar|footer|header|advertisement|ad|cookie|privacy|terms)/i,
    /^(home|about|contact|login|register|subscribe|newsletter)/i,
    /^[\w\s]{1,20}$/,  // Too short
    /^(.{1,10}\s*){1,5}$/,  // Repeated short phrases
  ];
  
  return lowQualityPatterns.some(pattern => pattern.test(content.trim()));
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