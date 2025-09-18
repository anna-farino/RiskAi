import { log } from "backend/utils/log";
import { ScrapingConfig, ArticleContent } from '../../types';
import * as cheerio from 'cheerio';
import { generateFallbackSelectors } from './fallback-selectors';
import { cleanAndNormalizeContent, stripHtmlTags } from './content-cleaner';
import { extractPublishDate } from './date-extractor';
import { 
  isValidArticleContent, 
  isValidTitle, 
  extractTitleFromUrl, 
  sanitizeContent 
} from '../../validators/content-validator';

/**
 * Sanitize CSS selector by removing invalid patterns
 */
function sanitizeSelector(selector: string | null): string | undefined {
  if (!selector || selector === "null" || selector === "undefined") {
    return undefined;
  }

  let cleaned = selector.trim();
  
  // Remove jQuery pseudo-selectors that don't work in standard CSS
  cleaned = cleaned.replace(/:contains\([^)]*\)/g, '');
  cleaned = cleaned.replace(/:eq\(\d+\)/g, '');
  cleaned = cleaned.replace(/:first\b/g, ':first-child');
  cleaned = cleaned.replace(/:last\b/g, ':last-child');
  
  // Clean up empty selectors or malformed ones
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove empty :not() patterns
  cleaned = cleaned.replace(/:not\(\s*\)/g, '');
  
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Main content extraction function - replaces all the redundant extractors
 * This is the ONLY content extraction function needed
 */
export async function extractArticleContent(html: string, config: ScrapingConfig, sourceUrl?: string): Promise<ArticleContent> {
  try {
    log(`[ContentExtractor] Starting unified content extraction`, "scraper");

    // Use selector-based extraction
    const extracted = extractContentWithSelectors(html, config);
    
    // Extract publish date
    let publishDate: Date | null = null;
    try {
      publishDate = await extractPublishDate(html, {
        dateSelector: config.dateSelector,
        dateAlternatives: []
      });
    } catch (dateError) {
      log(`[ContentExtractor] Date extraction failed: ${dateError}`, "scraper");
    }

    // Clean and sanitize the extracted content
    // Strip HTML tags first, then normalize whitespace, then sanitize
    let title = stripHtmlTags(extracted.title || "");
    title = cleanAndNormalizeContent(title);
    title = sanitizeContent(title);
    
    let content = stripHtmlTags(extracted.content || "");
    content = cleanAndNormalizeContent(content);
    content = sanitizeContent(content);
    
    // Validate title - if invalid or missing, try to extract from URL
    if (!isValidTitle(title) && sourceUrl) {
      log(`[ContentExtractor] Title invalid or missing, attempting URL extraction`, "scraper");
      const urlTitle = extractTitleFromUrl(sourceUrl);
      if (urlTitle) {
        title = urlTitle;
        log(`[ContentExtractor] Using title from URL: "${title}"`, "scraper");
      } else {
        title = "Untitled"; // Keep as fallback but validation will catch this
      }
    }
    
    // Validate content quality
    if (!isValidArticleContent(content)) {
      log(`[ContentExtractor] Content validation failed - appears corrupted or too short`, "scraper");
      // Mark as failed extraction with very low confidence
      return {
        title: title || "Content Validation Failed",
        content: content || "Article content could not be extracted properly",
        author: extracted.author,
        publishDate,
        extractionMethod: "validation_failed",
        confidence: 0.1 // Very low confidence to signal rejection
      };
    }

    // Clean author field as well if it exists
    let cleanedAuthor = extracted.author;
    if (cleanedAuthor) {
      cleanedAuthor = stripHtmlTags(cleanedAuthor);
      cleanedAuthor = cleanAndNormalizeContent(cleanedAuthor);
      cleanedAuthor = sanitizeContent(cleanedAuthor);
    }
    
    const result: ArticleContent = {
      title,
      content,
      author: cleanedAuthor,
      publishDate,
      extractionMethod: extracted.extractionMethod || "selectors",
      confidence: extracted.confidence || 0.9
    };

    log(`[ContentExtractor] Extraction completed - Method: ${result.extractionMethod}, Confidence: ${result.confidence}`, "scraper");
    return result;

  } catch (error: any) {
    log(`[ContentExtractor] Error during content extraction: ${error.message}`, "scraper-error");
    
    // Return minimal fallback result
    return {
      title: "Extraction Failed",
      content: "Content extraction failed due to technical error",
      author: undefined,
      publishDate: null,
      extractionMethod: "error_fallback",
      confidence: 0
    };
  }
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

// Old debugging functions removed - now using simplified 5-step process in structure-detector.ts

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
  
  // Remove pseudo-selectors if present, but handle empty :not() cases
  const withoutPseudo = selector.replace(/:[\w-]+(\([^)]*\))?/g, '');
  // Clean up any resulting empty :not() or trailing :not patterns
  const cleanedPseudo = withoutPseudo.replace(/:not\(\)/g, '').replace(/:not$/g, '');
  if (cleanedPseudo !== selector && cleanedPseudo.trim() !== '') {
    variations.push(cleanedPseudo);
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
    // Handle selectors with :has() pseudo-class that Cheerio might not support
    let workingSelector = config.contentSelector!;
    
    // Try the selector as-is first
    contentElements = $(workingSelector);
  } catch (error) {
    log(`[ContentRecovery] Invalid content selector "${config.contentSelector}", initiating recovery: ${error.message}`, "scraper-error");
    return recoverContentExtraction($, config, html);
  }
  
  if (contentElements.length === 0) {
    log(`[ContentRecovery] No elements found with primary selector, initiating recovery`, "scraper");
    return recoverContentExtraction($, config, html);
  }
  
  // Extract content from found elements
  log(`[ContentRecovery] Found ${contentElements.length} content elements`, "scraper");
  
  // Log details of each element for debugging
  contentElements.each((i, el) => {
    const text = $(el).text().trim();
    if (i < 3) { // Log first 3 elements
      log(`[ContentRecovery] Element ${i}: "${text.substring(0, 50)}..." (${text.length} chars)`, "scraper");
    }
  });
  
  const content = contentElements.map((_, el) => $(el).text().trim()).get().filter(text => text.length > 0).join('\n\n');
  
  log(`[ContentRecovery] Total content extracted: ${content.length} chars from ${contentElements.length} elements`, "scraper");
  
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
    try {
      const elements = $(variation);
      if (elements.length > 0) {
        const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
        if (content.length >= 100 && !isLowQualityContent(content)) {
          log(`[ContentRecovery] Successful recovery with variation: "${variation}" (${content.length} chars)`, "scraper");
          return { content, confidence: 0.7 };
        }
      }
    } catch (error) {
      log(`[ContentRecovery] Selector variation failed: "${variation}" - ${error.message}`, "scraper");
      // Continue to next variation
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
  const fallbackSelectors = generateFallbackSelectors('content');
  
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
      // Strip any HTML tags that might be in the extracted text
      result = stripHtmlTags(result);
      
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
        // Strip any HTML tags that might be in the extracted text
        result = stripHtmlTags(result);
        
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
          
          // Clean up biographical content - extract just the name part
          result = cleanAuthorName(result);
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
      // Strip any HTML tags that might be in the extracted text
      result = stripHtmlTags(result);
      
      // Validate result based on field type
      if (result && fieldType === 'author') {
        if (/^(CONTACT|CONTACTS:|FOR MORE INFORMATION|PRESS CONTACT|MEDIA CONTACT)/i.test(result)) {
          log(`[${fieldType}Recovery] Rejected contact info as author from fallback: "${result}"`, "scraper");
          continue;
        }
        
        // Additional validation: ensure it looks like a person's name
        if (result.length < 3 || result.length > 80 || !/[a-zA-Z]/.test(result)) {
          log(`[${fieldType}Recovery] Rejected invalid author name: "${result}"`, "scraper");
          continue;
        }
        
        // Clean up biographical content - extract just the name part
        result = cleanAuthorName(result);
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
  // Use centralized fallback selectors
  if (fieldType === 'title') {
    return generateFallbackSelectors('title');
  } else if (fieldType === 'author') {
    return generateFallbackSelectors('author');
  } else if (fieldType === 'date') {
    return generateFallbackSelectors('date');
  } else if (fieldType === 'content') {
    return generateFallbackSelectors('content');
  }
  
  return [];
}

/**
 * Clean author name by extracting just the name part and removing biographical content
 */
export function cleanAuthorName(rawAuthor: string): string {
  if (!rawAuthor) return rawAuthor;
  
  // Remove common biographical indicators and everything after them
  const bioIndicators = [
    /\s+is\s+(a|an)\s+/i,           // "John Smith is a writer..."
    /\s+has\s+(been|worked)/i,      // "John Smith has been working..."
    /\s+worked?\s+(at|for|in)/i,    // "John Smith worked at..."
    /\s+(veteran|former|senior)\s+/i, // "John Smith, veteran journalist..."
    /\s+of\s+more\s+than\s+\d+/i,   // "of more than 20 years"
    /\.\s*[A-Z]/,                   // Period followed by capital letter (new sentence)
    /\s+(received|won|earned)/i,    // Awards/achievements
    /\s+(published|written)/i,      // Publications
    /\s+specializes?\s+in/i,        // Specialization
    /\s+covers?\s+(topics|stories)/i, // Coverage area
  ];
  
  let cleaned = rawAuthor;
  
  // Find the earliest bio indicator and truncate there
  let earliestIndex = cleaned.length;
  for (const pattern of bioIndicators) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }
  
  if (earliestIndex < cleaned.length) {
    cleaned = cleaned.substring(0, earliestIndex).trim();
  }
  
  // Remove trailing commas and periods
  cleaned = cleaned.replace(/[,.]$/, '').trim();
  
  // If it's still too long (>100 chars), likely still has bio content
  if (cleaned.length > 100) {
    // Try to extract just the first line or sentence
    const lines = cleaned.split(/\n+/);
    if (lines.length > 1 && lines[0].length < 80) {
      cleaned = lines[0].trim();
    } else {
      // Try to find the first sentence ending
      const sentenceEnd = cleaned.match(/^[^.!?]*[.!?]/);
      if (sentenceEnd && sentenceEnd[0].length < 80) {
        cleaned = sentenceEnd[0].replace(/[.!?]$/, '').trim();
      }
    }
  }
  
  // Final length check - if still too long, truncate aggressively
  if (cleaned.length > 80) {
    // Look for common name patterns at the beginning
    const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?){0,3}(?:,?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)/;
    const nameMatch = cleaned.match(namePattern);
    if (nameMatch) {
      cleaned = nameMatch[1].trim();
    } else {
      // Last resort: take first 60 characters and truncate at last space
      cleaned = cleaned.substring(0, 60);
      const lastSpace = cleaned.lastIndexOf(' ');
      if (lastSpace > 20) {
        cleaned = cleaned.substring(0, lastSpace);
      }
    }
  }
  
  return cleaned.trim();
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

